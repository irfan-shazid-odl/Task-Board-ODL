import { supabase } from '@/lib/supabase';
import { ApiError, callServerApi } from '../client';
import type { TeamMember, Role } from '@/lib/types';

export const usersApi = {
  async list(): Promise<TeamMember[]> {
    const { data, error } = await supabase.from('team_members').select('*').order('name', { ascending: true });
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as TeamMember[];
  },

  async get(id: string): Promise<TeamMember> {
    const { data, error } = await supabase.from('team_members').select('*').eq('id', id).maybeSingle();
    if (error) throw new ApiError(500, error.message);
    if (!data) throw new ApiError(404, 'User not found');
    return data as TeamMember;
  },

  // Privileged — creates a Supabase Auth account + team_members row via a
  // server route (needs the service-role key).
  create(input: { name: string; email: string; password: string; role: Role }): Promise<{ user: TeamMember }> {
    return callServerApi('/api/users/create', input);
  },

  update(
    id: string,
    input: Partial<{
      name: string;
      role: Role;
      phone: string | null;
      location: string | null;
      department: string | null;
      bio: string | null;
      avatar_url: string | null;
      is_first_login: boolean;
    }>,
  ): Promise<{ user: TeamMember }> {
    return callServerApi('/api/users/update', { id, ...input });
  },

  remove(id: string): Promise<{ ok: boolean }> {
    return callServerApi('/api/users/delete', { id });
  },

  setPaused(id: string, isPaused: boolean): Promise<{ user: TeamMember }> {
    return callServerApi('/api/users/pause', { id, isPaused });
  },
};
