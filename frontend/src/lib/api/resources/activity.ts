import { supabase } from '@/lib/supabase';
import { ApiError } from '../client';

export interface ActivityLogRow {
  id: string;
  project_id: string | null;
  member_id: string | null;
  action_type: string;
  description: string;
  created_at: string;
  member?: { id: string; name: string; avatar_url?: string | null; role?: string } | null;
  project?: { id: string; name: string } | null;
}

export const activityApi = {
  async list(
    params: { projectId?: string; memberId?: string; createdFrom?: string; createdTo?: string; limit?: number } = {},
  ): Promise<ActivityLogRow[]> {
    let query = supabase
      .from('activity_logs')
      .select('*, member:team_members(id,name,avatar_url,role), project:projects(id,name)')
      .order('created_at', { ascending: false })
      // Bounded page by default — without this, an unbounded fetch scans the
      // entire (ever-growing) activity log on every request.
      .limit(params.limit ?? 500);
    if (params.projectId) query = query.eq('project_id', params.projectId);
    if (params.memberId) query = query.eq('member_id', params.memberId);
    if (params.createdFrom) query = query.gte('created_at', params.createdFrom);
    if (params.createdTo) query = query.lte('created_at', params.createdTo);
    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as unknown as ActivityLogRow[];
  },

  async create(input: {
    project_id?: string | null;
    member_id?: string | null;
    action_type: string;
    description: string;
  }): Promise<ActivityLogRow> {
    let memberId = input.member_id;
    if (memberId === undefined) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      memberId = session?.user.id ?? null;
    }
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({ ...input, member_id: memberId })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    return data as ActivityLogRow;
  },
};
