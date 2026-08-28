import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActor } from '@/lib/api/server/actor';

// Which roles each rank may assign to a new account — mirrors the old
// Express backend's ASSIGNABLE_ROLES (and the frontend's getAvailableRoles
// in features/users/constants.tsx).
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  'super-admin': ['super-admin', 'Admin', 'Lead', 'Member'],
  Admin: ['Lead', 'Member'],
  Lead: ['Member'],
};

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { name, email, password, role } = body ?? {};
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'name, email, password, and role are required' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const allowed = ASSIGNABLE_ROLES[actor.role] ?? [];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'You do not have permission to assign that role.' }, { status: 403 });
  }

  // A member invited by a Lead is "under" that Lead — scopes their board/reports.
  const managed_by_id = actor.role === 'Lead' ? actor.id : null;

  const { data: existing } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (authError || !authData?.user) {
    return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 400 });
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('team_members')
    .insert({
      id: authData.user.id,
      name,
      email,
      role,
      managed_by_id,
      is_first_login: true,
    })
    .select('*')
    .single();

  if (memberError || !member) {
    // Roll back the auth account so we don't leave a login with no profile.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return NextResponse.json({ error: memberError?.message || 'Failed to create user profile' }, { status: 500 });
  }

  return NextResponse.json({ user: member }, { status: 201 });
}
