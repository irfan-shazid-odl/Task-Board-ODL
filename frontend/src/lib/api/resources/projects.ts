import { supabase } from '@/lib/supabase';
import { ApiError, type ApiInput } from '../client';
import type { Project } from '@/lib/types';

interface ListOpts {
  include?: string; // 'lead,client'
  orderBy?: 'sort_order' | 'name' | 'created_at';
  order?: 'asc' | 'desc';
}

function buildSelect(include?: string): string {
  const inc = include ?? '';
  const parts = ['*'];
  if (inc.includes('lead')) parts.push('project_lead:team_members(*)');
  if (inc.includes('client')) parts.push('client:clients(*)');
  return parts.join(', ');
}

export const projectsApi = {
  async list(opts: ListOpts = {}): Promise<Project[]> {
    const orderField = opts.orderBy ?? 'sort_order';
    const { data, error } = await supabase
      .from('projects')
      .select(buildSelect(opts.include))
      .order(orderField, { ascending: (opts.order ?? 'asc') === 'asc' });
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as unknown as Project[];
  },

  async count(): Promise<{ count: number }> {
    const { count, error } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    if (error) throw new ApiError(500, error.message);
    return { count: count ?? 0 };
  },

  async get(id: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_lead:team_members(*), client:clients(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    if (!data) throw new ApiError(404, 'Project not found');
    return data as unknown as Project;
  },

  async create(data: ApiInput<Project> & { name: string; category: string }): Promise<Project> {
    let sortOrder = data.sort_order ?? undefined;
    if (sortOrder === undefined) {
      const { data: maxRow } = await supabase
        .from('projects')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      sortOrder = (maxRow?.sort_order ?? 0) + 1;
    }
    const { data: row, error } = await supabase
      .from('projects')
      .insert({ ...data, sort_order: sortOrder })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    return row as unknown as Project;
  },

  async update(id: string, data: ApiInput<Project>): Promise<Project> {
    const { data: row, error } = await supabase.from('projects').update(data).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as unknown as Project;
  },

  async reorder(updates: Array<{ id: string; sort_order: number }>): Promise<{ ok: boolean }> {
    // No cross-row transaction over PostgREST — apply each update independently,
    // same as a plain direct-Supabase app would.
    const results = await Promise.all(
      updates.map((u) => supabase.from('projects').update({ sort_order: u.sort_order }).eq('id', u.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new ApiError(500, failed.error.message);
    return { ok: true };
  },

  async remove(id: string): Promise<{ ok: boolean }> {
    // Cascade delete relies on the FK ON DELETE CASCADE rules already defined
    // on the live schema (tasks, credentials, documents, activity → project).
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },

  // Destructive project-level hours override: deletes ALL time logs for the
  // project's tasks and writes a single aggregate row.
  async overrideHours(
    id: string,
    input: { hours_logged: number; billing_hours: number; log_date: string },
  ): Promise<{ ok: boolean }> {
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('id').eq('project_id', id);
    if (tasksError) throw new ApiError(500, tasksError.message);
    const taskIds = (tasks ?? []).map((t) => t.id as string);
    if (taskIds.length === 0) return { ok: true };

    const { error: deleteError } = await supabase.from('time_logs').delete().in('task_id', taskIds);
    if (deleteError) throw new ApiError(500, deleteError.message);

    const { data: firstAssignment } = await supabase
      .from('task_assignments')
      .select('task_id, member_id')
      .in('task_id', taskIds)
      .limit(1)
      .maybeSingle();
    const targetTaskId = firstAssignment?.task_id ?? taskIds[0];
    const memberId = firstAssignment?.member_id ?? null;

    const { error: insertError } = await supabase.from('time_logs').insert({
      task_id: targetTaskId,
      member_id: memberId,
      hours_logged: input.hours_logged,
      billing_hours: input.billing_hours,
      log_date: input.log_date,
    });
    if (insertError) throw new ApiError(500, insertError.message);
    return { ok: true };
  },
};
