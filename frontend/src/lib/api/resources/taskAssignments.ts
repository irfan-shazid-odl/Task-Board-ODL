import { supabase } from '@/lib/supabase';
import { ApiError } from '../client';
import type { TaskAssignment } from '@/lib/types';

export const taskAssignmentsApi = {
  async list(params: { taskIds?: string[]; memberId?: string } = {}): Promise<TaskAssignment[]> {
    let query = supabase
      .from('task_assignments')
      .select('*')
      .order('task_id', { ascending: true })
      .order('member_id', { ascending: true });
    if (params.taskIds?.length) query = query.in('task_id', params.taskIds);
    if (params.memberId) query = query.eq('member_id', params.memberId);
    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as TaskAssignment[];
  },

  async assign(taskId: string, memberId: string): Promise<TaskAssignment> {
    const { data, error } = await supabase
      .from('task_assignments')
      .upsert({ task_id: taskId, member_id: memberId }, { onConflict: 'task_id,member_id' })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    return data as TaskAssignment;
  },

  async unassign(taskId: string, memberId: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId)
      .eq('member_id', memberId);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },

  async updateStatus(taskId: string, memberId: string, status: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('task_assignments')
      .update({ status })
      .eq('task_id', taskId)
      .eq('member_id', memberId);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },

  // Replace all assignees for a task, preserving prior per-assignee status
  // where possible (not atomic over PostgREST — delete then insert, same as
  // the rest of this direct-Supabase layer).
  async replaceForTask(
    taskId: string,
    assignees: Array<{ member_id: string; status?: string }>,
  ): Promise<TaskAssignment[]> {
    const { data: existing, error: existingErr } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('task_id', taskId);
    if (existingErr) throw new ApiError(500, existingErr.message);
    const prevStatus = new Map((existing ?? []).map((a: any) => [a.member_id, a.status]));

    const { error: delErr } = await supabase.from('task_assignments').delete().eq('task_id', taskId);
    if (delErr) throw new ApiError(500, delErr.message);

    if (assignees.length > 0) {
      const rows = assignees.map((a) => ({
        task_id: taskId,
        member_id: a.member_id,
        status: a.status ?? prevStatus.get(a.member_id) ?? 'Todo',
      }));
      const { error: insErr } = await supabase.from('task_assignments').upsert(rows, { onConflict: 'task_id,member_id' });
      if (insErr) throw new ApiError(500, insErr.message);
    }

    const { data, error } = await supabase.from('task_assignments').select('*').eq('task_id', taskId);
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as TaskAssignment[];
  },
};
