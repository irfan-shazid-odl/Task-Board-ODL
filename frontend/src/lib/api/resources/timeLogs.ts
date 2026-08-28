import { supabase } from '@/lib/supabase';
import { ApiError } from '../client';
import type { TimeLog } from '@/lib/types';

export interface TimeLogListParams {
  taskIds?: string[];
  memberId?: string;
  logDateGte?: string;
  logDateLte?: string;
  include?: string; // 'task.project'
}

function buildSelect(include?: string): string {
  const inc = include ?? '';
  if (inc.includes('task.project')) return '*, task:tasks(*, project:projects(id,name,category))';
  return '*';
}

export const timeLogsApi = {
  async list(params: TimeLogListParams = {}): Promise<TimeLog[]> {
    let query = supabase.from('time_logs').select(buildSelect(params.include)).order('id', { ascending: true });
    if (params.taskIds?.length) query = query.in('task_id', params.taskIds);
    if (params.memberId) query = query.eq('member_id', params.memberId);
    if (params.logDateGte) query = query.gte('log_date', params.logDateGte);
    if (params.logDateLte) query = query.lte('log_date', params.logDateLte);
    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as unknown as TimeLog[];
  },

  async latest(taskId: string): Promise<{ id: string; log_date: string } | null> {
    const { data, error } = await supabase
      .from('time_logs')
      .select('id, log_date')
      .eq('task_id', taskId)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    return data ?? null;
  },

  async create(input: {
    task_id: string;
    member_id?: string | null;
    hours_logged: number;
    billing_hours?: number;
    log_date: string;
  }): Promise<TimeLog> {
    const { data, error } = await supabase
      .from('time_logs')
      .insert({
        task_id: input.task_id,
        member_id: input.member_id ?? null,
        hours_logged: input.hours_logged,
        billing_hours: input.billing_hours ?? 0,
        log_date: input.log_date,
      })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    return data as TimeLog;
  },

  async update(
    id: string,
    input: { log_date?: string; hours_logged?: number; billing_hours?: number },
  ): Promise<TimeLog> {
    const patch: Record<string, unknown> = {};
    if (input.log_date !== undefined) patch.log_date = input.log_date;
    if (input.hours_logged !== undefined) patch.hours_logged = input.hours_logged;
    if (input.billing_hours !== undefined) patch.billing_hours = input.billing_hours;
    const { data, error } = await supabase.from('time_logs').update(patch).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return data as TimeLog;
  },
};
