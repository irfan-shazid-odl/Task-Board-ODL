import { supabase } from '@/lib/supabase';
import { ApiError } from '../client';
import type { Task } from '@/lib/types';

const CARRY_STATUSES = ['Todo', 'Working', 'On Review'];

export interface TaskListParams {
  project_id?: string;
  ids?: string[];
  status?: string[];
  log_date?: string;
  log_date_lt?: string;
  log_date_lte?: string;
  log_date_gte?: string;
  created_from?: string;
  created_to?: string;
  board_date?: string;
  carry_over?: boolean;
  order_by?: 'created_at' | 'deadline' | 'id';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  include?: string; // 'project,reference_doc'
  count?: boolean;
}

export interface TaskData {
  project_id?: string | null;
  description: string;
  status?: string;
  priority?: string;
  deadline?: string | null;
  reference_doc_id?: string | null;
  category?: string | null;
  estimated_time?: number | null;
  log_date?: string;
}

function inList(values: string[]): string {
  return `(${values.map((v) => `"${v}"`).join(',')})`;
}

function buildSelect(include?: string): string {
  const inc = include ?? '';
  const parts = ['*'];
  if (inc.includes('project')) parts.push('project:projects(id,name,category)');
  if (inc.includes('reference_doc')) parts.push('reference_doc:project_documents(*)');
  return parts.join(', ');
}

function applyFilters(query: any, p: TaskListParams) {
  if (p.project_id) query = query.eq('project_id', p.project_id);
  if (p.ids?.length) query = query.in('id', p.ids);
  if (p.status?.length) query = query.in('status', p.status);

  if (p.board_date && p.carry_over) {
    query = query.or(
      `log_date.eq.${p.board_date},and(log_date.lt.${p.board_date},status.in.${inList(CARRY_STATUSES)})`,
    );
  }

  if (p.log_date) query = query.eq('log_date', p.log_date);
  if (p.log_date_lt) query = query.lt('log_date', p.log_date_lt);
  if (p.log_date_lte) query = query.lte('log_date', p.log_date_lte);
  if (p.log_date_gte) query = query.gte('log_date', p.log_date_gte);

  if (p.created_from) query = query.gte('created_at', p.created_from);
  if (p.created_to) query = query.lte('created_at', p.created_to);

  return query;
}

function applyOrder(query: any, p: TaskListParams) {
  const dir = p.order ?? 'desc';
  if (p.order_by === 'deadline') return query.order('deadline', { ascending: dir === 'asc', nullsFirst: false });
  if (p.order_by === 'id') return query.order('id', { ascending: (p.order ?? 'asc') === 'asc' });
  return query.order('created_at', { ascending: dir === 'asc' });
}

async function runList(params: TaskListParams, withCount: boolean) {
  let query = supabase
    .from('tasks')
    .select(buildSelect(params.include), withCount ? { count: 'exact' } : undefined);
  query = applyFilters(query, params);
  query = applyOrder(query, params);
  if (params.limit !== undefined || params.offset !== undefined) {
    const from = params.offset ?? 0;
    const to = params.limit !== undefined ? from + params.limit - 1 : from + 100000;
    query = query.range(from, to);
  }
  const { data, error, count } = await query;
  if (error) throw new ApiError(500, error.message);
  return { data: (data ?? []) as unknown as Task[], count: count ?? 0 };
}

function toTaskWrite(d: Partial<TaskData>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.project_id !== undefined) out.project_id = d.project_id;
  if (d.description !== undefined) out.description = d.description;
  if (d.status !== undefined) out.status = d.status;
  if (d.priority !== undefined) out.priority = d.priority;
  if (d.deadline !== undefined) out.deadline = d.deadline;
  if (d.reference_doc_id !== undefined) out.reference_doc_id = d.reference_doc_id;
  if (d.category !== undefined) out.category = d.category;
  if (d.estimated_time !== undefined) out.estimated_time = d.estimated_time;
  if (d.log_date !== undefined) out.log_date = d.log_date;
  return out;
}

export const tasksApi = {
  async list(params: TaskListParams = {}): Promise<Task[]> {
    const { data } = await runList(params, false);
    return data;
  },

  async listWithCount(params: TaskListParams = {}): Promise<{ data: Task[]; count: number }> {
    return runList(params, true);
  },

  // Not a real DB transaction over PostgREST — inserts sequentially, same as
  // any plain direct-Supabase app (this mirrors Project-tracker-example).
  async create(input: {
    task: TaskData;
    assigneeIds?: string[];
    anchor?: { member_id: string | null; log_date: string } | null;
  }): Promise<Task> {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert(toTaskWrite(input.task))
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);

    if (input.assigneeIds?.length) {
      const rows = input.assigneeIds.map((member_id) => ({ task_id: task.id, member_id }));
      const { error: aErr } = await supabase
        .from('task_assignments')
        .upsert(rows, { onConflict: 'task_id,member_id', ignoreDuplicates: true });
      if (aErr) throw new ApiError(500, aErr.message);
    }

    if (input.anchor) {
      const { error: lErr } = await supabase.from('time_logs').insert({
        task_id: task.id,
        member_id: input.anchor.member_id,
        hours_logged: 0,
        billing_hours: 0,
        log_date: input.anchor.log_date,
      });
      if (lErr) throw new ApiError(500, lErr.message);
    }

    return task as unknown as Task;
  },

  async update(id: string, patch: Partial<TaskData>): Promise<Task> {
    const { data, error } = await supabase.from('tasks').update(toTaskWrite(patch)).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return data as unknown as Task;
  },

  async remove(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },
};
