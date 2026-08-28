import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActor, SYSTEM_ADMIN_EMAIL } from '@/lib/api/server/actor';

const ALLOWED_FIELDS = [
  'name',
  'role',
  'phone',
  'location',
  'department',
  'bio',
  'avatar_url',
  'is_first_login',
] as const;

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const isSelf = actor.id === id;
  const isAdmin = actor.role === 'Admin' || actor.role === 'super-admin';
  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (body.role !== undefined && !isAdmin) {
    return NextResponse.json({ error: 'Only administrators can change roles' }, { status: 403 });
  }

  const { data: target } = await supabaseAdmin.from('team_members').select('*').eq('id', id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (target.email === SYSTEM_ADMIN_EMAIL && body.role !== undefined && body.role !== target.role) {
    return NextResponse.json({ error: 'The system administrator account cannot be modified.' }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: member, error } = await supabaseAdmin
    .from('team_members')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !member) {
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 500 });
  }

  // Keep Auth user_metadata roughly in sync (best-effort — not load-bearing).
  if (patch.name !== undefined || patch.role !== undefined) {
    await supabaseAdmin.auth.admin
      .updateUserById(id, { user_metadata: { name: member.name, role: member.role } })
      .catch(() => {});
  }

  return NextResponse.json({ user: member });
}
