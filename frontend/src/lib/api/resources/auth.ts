import { supabase } from '@/lib/supabase';
import { ApiError, callServerApi } from '../client';
import type { TeamMember } from '@/lib/types';

export interface LoginResult {
  token: string;
  user: TeamMember;
}

async function meFromId(id: string): Promise<TeamMember> {
  const { data, error } = await supabase.from('team_members').select('*').eq('id', id).maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(401, 'Account no longer exists');
  return data as TeamMember;
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new ApiError(401, error?.message || 'Invalid email or password');
    }
    const user = await meFromId(data.user.id);
    return { token: data.session.access_token, user };
  },

  logout() {
    // Fire-and-forget: callers here don't await (matches prior sync behavior).
    void supabase.auth.signOut();
  },

  async me(): Promise<TeamMember> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new ApiError(401, 'Not authenticated');
    return meFromId(session.user.id);
  },

  async changePassword(newPassword: string, currentPassword?: string): Promise<{ success: boolean }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new ApiError(401, 'Not authenticated');

    if (currentPassword !== undefined) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email!,
        password: currentPassword,
      });
      if (verifyError) throw new ApiError(400, 'Current password is incorrect');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new ApiError(400, error.message);

    await supabase.from('team_members').update({ is_first_login: false }).eq('id', session.user.id);
    return { success: true };
  },

  // Public "forgot password" flow — no prior auth, mirrors the original app.
  resetPassword(email: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return callServerApi('/api/auth/reset-password', { email, newPassword });
  },
};
