import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface Actor {
  id: string;
  email: string;
  role: string;
}

// Resolves the calling user from the `Authorization: Bearer <access_token>`
// header a Route Handler receives, using the service-role client so this
// works regardless of RLS. Mirrors what the old Express `requireAuth`
// middleware derived from the JWT.
export async function getActor(req: Request): Promise<Actor | null> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const { data: member, error: memberError } = await supabaseAdmin
    .from('team_members')
    .select('id, email, role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (memberError || !member) return null;

  return { id: member.id, email: member.email, role: member.role };
}

export const SYSTEM_ADMIN_EMAIL = 'system@sys.com';
