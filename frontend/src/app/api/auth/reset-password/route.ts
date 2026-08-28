import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Public "forgot password" — resets by email with no prior auth check. This
// intentionally mirrors the original application's open reset flow; it is
// not a new behavior introduced by this migration.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email as string | undefined;
  const newPassword = body?.newPassword as string | undefined;

  if (!email || !newPassword) {
    return NextResponse.json({ error: 'email and newPassword are required' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: 'No account found with that email address.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(member.id, { password: newPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, message: 'Password has been reset successfully.' });
}
