import { supabase } from '@/lib/supabase';
import { ApiError } from '../client';

export interface DashboardStats {
  totalActiveTasks: number;
  statusCounts: { status: string; count: number }[];
  totalWorkingHours: number;
  totalBillingHours: number;
  projectHours: { id: string; name: string; category: string; hours: number }[];
  totalProjects: number;
  totalMembers: number;
}

export interface ProjectsStats {
  [projectId: string]: {
    working: number;
    billing: number;
    taskCount: number;
  };
}

// These used to be computed server-side (with a 2-minute cache) via raw SQL
// aggregates. There's no backend anymore, so this fetches the underlying
// rows and aggregates client-side — a small in-memory TTL cache keeps repeat
// navigations within the same tab cheap, mirroring the old cache window.
const CACHE_TTL = 120_000;
const cache = new Map<string, { value: unknown; expires: number }>();
function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit || hit.expires < Date.now()) return undefined;
  return hit.value as T;
}
function cacheSet(key: string, value: unknown) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}

export const statsApi = {
  async dashboard(params: { memberId?: string; startDate?: string; endDate?: string } = {}): Promise<DashboardStats> {
    const { memberId, startDate, endDate } = params;
    const cacheKey = `dashboard-${memberId || 'all'}-${startDate || 'none'}-${endDate || 'none'}`;
    const cached = cacheGet<DashboardStats>(cacheKey);
    if (cached) return cached;

    let memberTaskIds: string[] | null = null;
    if (memberId) {
      const { data: assignments, error: aErr } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('member_id', memberId);
      if (aErr) throw new ApiError(500, aErr.message);
      memberTaskIds = Array.from(new Set((assignments ?? []).map((a: any) => a.task_id as string)));
    }

    let taskQuery = supabase.from('tasks').select('id, status, created_at');
    if (memberTaskIds) taskQuery = taskQuery.in('id', memberTaskIds.length ? memberTaskIds : ['00000000-0000-0000-0000-000000000000']);
    if (startDate) taskQuery = taskQuery.gte('created_at', `${startDate}T00:00:00Z`);
    if (endDate) taskQuery = taskQuery.lte('created_at', `${endDate}T23:59:59Z`);
    const { data: tasks, error: tErr } = await taskQuery;
    if (tErr) throw new ApiError(500, tErr.message);

    const statusCounts = [
      { status: 'Todo', count: 0 },
      { status: 'Working', count: 0 },
      { status: 'On Review', count: 0 },
      { status: 'Complete', count: 0 },
    ];
    const countMap: Record<string, number> = {};
    (tasks ?? []).forEach((t: any) => {
      countMap[t.status] = (countMap[t.status] ?? 0) + 1;
    });
    let totalActive = 0;
    statusCounts.forEach((s) => {
      s.count = countMap[s.status] ?? 0;
      if (s.status !== 'Complete') totalActive += s.count;
    });

    let logQuery = supabase.from('time_logs').select('hours_logged, billing_hours, log_date, task_id');
    if (memberId) logQuery = logQuery.eq('member_id', memberId);
    if (startDate) logQuery = logQuery.gte('log_date', startDate);
    if (endDate) logQuery = logQuery.lte('log_date', endDate);
    const { data: logs, error: lErr } = await logQuery;
    if (lErr) throw new ApiError(500, lErr.message);

    const totalWorkingHours = (logs ?? []).reduce((s: number, l: any) => s + (Number(l.hours_logged) || 0), 0);
    const totalBillingHours = (logs ?? []).reduce((s: number, l: any) => s + (Number(l.billing_hours) || 0), 0);

    const taskIdsInLogs = Array.from(new Set((logs ?? []).map((l: any) => l.task_id as string).filter(Boolean)));
    let projectHours: DashboardStats['projectHours'] = [];
    if (taskIdsInLogs.length) {
      const { data: taskRows, error: trErr } = await supabase.from('tasks').select('id, project_id').in('id', taskIdsInLogs);
      if (trErr) throw new ApiError(500, trErr.message);
      const taskProjectMap: Record<string, string | null> = {};
      (taskRows ?? []).forEach((t: any) => {
        taskProjectMap[t.id] = t.project_id;
      });

      const hoursByProject: Record<string, number> = {};
      (logs ?? []).forEach((l: any) => {
        const projectId = taskProjectMap[l.task_id];
        if (!projectId) return;
        hoursByProject[projectId] = (hoursByProject[projectId] ?? 0) + (Number(l.hours_logged) || 0);
      });

      const projectIds = Object.keys(hoursByProject);
      if (projectIds.length) {
        const { data: projRows, error: pErr } = await supabase.from('projects').select('id, name, category').in('id', projectIds);
        if (pErr) throw new ApiError(500, pErr.message);
        projectHours = (projRows ?? [])
          .map((p: any) => ({ id: p.id, name: p.name, category: p.category || 'Internal', hours: hoursByProject[p.id] ?? 0 }))
          .sort((a, b) => b.hours - a.hours);
      }
    }

    const [{ count: totalProjects }, { count: totalMembers }] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('team_members').select('*', { count: 'exact', head: true }),
    ]);

    const result: DashboardStats = {
      totalActiveTasks: totalActive,
      statusCounts,
      totalWorkingHours,
      totalBillingHours,
      projectHours,
      totalProjects: totalProjects ?? 0,
      totalMembers: totalMembers ?? 0,
    };
    cacheSet(cacheKey, result);
    return result;
  },

  async projects(): Promise<ProjectsStats> {
    const cacheKey = 'projects-stats';
    const cached = cacheGet<ProjectsStats>(cacheKey);
    if (cached) return cached;

    const [{ data: projects, error: pErr }, { data: tasks, error: tErr }, { data: logs, error: lErr }] = await Promise.all([
      supabase.from('projects').select('id'),
      supabase.from('tasks').select('id, project_id'),
      supabase.from('time_logs').select('task_id, hours_logged, billing_hours'),
    ]);
    if (pErr) throw new ApiError(500, pErr.message);
    if (tErr) throw new ApiError(500, tErr.message);
    if (lErr) throw new ApiError(500, lErr.message);

    const taskToProject: Record<string, string> = {};
    const taskCountByProject: Record<string, number> = {};
    (tasks ?? []).forEach((t: any) => {
      if (!t.project_id) return;
      taskToProject[t.id] = t.project_id;
      taskCountByProject[t.project_id] = (taskCountByProject[t.project_id] ?? 0) + 1;
    });

    const result: ProjectsStats = {};
    (projects ?? []).forEach((p: any) => {
      result[p.id] = { working: 0, billing: 0, taskCount: taskCountByProject[p.id] ?? 0 };
    });
    (logs ?? []).forEach((l: any) => {
      const projectId = taskToProject[l.task_id];
      if (!projectId || !result[projectId]) return;
      result[projectId].working += Number(l.hours_logged) || 0;
      result[projectId].billing += Number(l.billing_hours) || 0;
    });

    cacheSet(cacheKey, result);
    return result;
  },
};
