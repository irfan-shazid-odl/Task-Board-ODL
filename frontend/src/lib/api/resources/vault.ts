import { supabase } from '@/lib/supabase';
import { ApiError } from '../client';

export interface VaultItem {
  id: string;
  member_id: string;
  title: string;
  username: string;
  encrypted_password: string;
  url: string;
  notes: string;
  folder: string;
  created_at?: string;
  updated_at?: string;
}

type VaultInput = Partial<Omit<VaultItem, 'id' | 'member_id' | 'created_at' | 'updated_at'>> & {
  title: string;
};

async function currentMemberId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, 'Not authenticated');
  return session.user.id;
}

// `password_vault` RLS restricts rows to `member_id = auth.uid()`, so these
// reads/writes are already scoped to the signed-in user by the database.
export const vaultApi = {
  async list(): Promise<VaultItem[]> {
    const { data, error } = await supabase.from('password_vault').select('*').order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as VaultItem[];
  },
  async create(data: VaultInput): Promise<VaultItem> {
    const memberId = await currentMemberId();
    const { data: row, error } = await supabase
      .from('password_vault')
      .insert({ ...data, member_id: memberId })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    return row as VaultItem;
  },
  async update(id: string, data: Partial<VaultInput>): Promise<VaultItem> {
    const { data: row, error } = await supabase.from('password_vault').update(data).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as VaultItem;
  },
  async remove(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('password_vault').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },
};
