import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActor, SYSTEM_ADMIN_EMAIL } from '@/lib/api/server/actor';

const RANK: Record<string, number> = { 'super-admin': 3, Admin: 2, Lead: 1, Member: 0 };

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if ((RANK[actor.role] ?? -1) < RANK.Admin) {
    return NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data: target } = await supabaseAdmin.from('team_members').select('email').eq('id', id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.email === SYSTEM_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'The system administrator account cannot be deleted.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('team_members').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: also remove the Auth account so the login stops working.
  await supabaseAdmin.auth.admin.deleteUser(id).catch(() => {});

  return NextResponse.json({ ok: true });
}
