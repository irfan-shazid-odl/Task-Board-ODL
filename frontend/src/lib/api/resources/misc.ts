import { supabase } from '@/lib/supabase';
import { ApiError, type ApiInput } from '../client';
import type { Client, Subscription, ProjectCredential, ProjectDocument, Subscription as Sub } from '@/lib/types';

// ── Clients ───────────────────────────────────────────────────────────────
export const clientsApi = {
  async list(): Promise<Client[]> {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as Client[];
  },
  async create(data: ApiInput<Client> & { name: string }): Promise<Client> {
    const { data: row, error } = await supabase.from('clients').insert(data).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as Client;
  },
  async update(id: string, data: ApiInput<Client>): Promise<Client> {
    const { data: row, error } = await supabase.from('clients').update(data).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as Client;
  },
  async remove(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },
};

// ── Subscriptions ───────────────────────────────────────────────────────────
export const subscriptionsApi = {
  async list(): Promise<Subscription[]> {
    const { data, error } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as Subscription[];
  },
  async create(data: ApiInput<Sub> & { name: string; email: string; start_date: string }): Promise<Subscription> {
    const { data: row, error } = await supabase.from('subscriptions').insert(data).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as Subscription;
  },
  async update(id: string, data: ApiInput<Sub>): Promise<Subscription> {
    const { data: row, error } = await supabase.from('subscriptions').update(data).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as Subscription;
  },
  async remove(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },
};

// ── Project credentials ─────────────────────────────────────────────────────
export const credentialsApi = {
  async listForProject(projectId: string): Promise<ProjectCredential[]> {
    const { data, error } = await supabase
      .from('project_credentials')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as ProjectCredential[];
  },
  async create(data: ApiInput<ProjectCredential> & { project_id: string; label: string }): Promise<ProjectCredential> {
    const payload = { ...data, username: data.username ?? '', password: data.password ?? '' };
    const { data: row, error } = await supabase.from('project_credentials').insert(payload).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as ProjectCredential;
  },
  async update(id: string, data: ApiInput<ProjectCredential>): Promise<ProjectCredential> {
    const payload: Record<string, unknown> = { ...data };
    if ('username' in data) payload.username = data.username ?? '';
    if ('password' in data) payload.password = data.password ?? '';
    const { data: row, error } = await supabase.from('project_credentials').update(payload).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as ProjectCredential;
  },
  async remove(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('project_credentials').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },
};

// ── Project documents ───────────────────────────────────────────────────────
type DocInput = { project_id: string; title: string; url: string; doc_type: string };

export const documentsApi = {
  async listForProject(projectId: string): Promise<ProjectDocument[]> {
    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as ProjectDocument[];
  },
  async listByIds(ids: string[]): Promise<ProjectDocument[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from('project_documents').select('*').in('id', ids);
    if (error) throw new ApiError(500, error.message);
    return (data ?? []) as ProjectDocument[];
  },
  async create(data: DocInput): Promise<ProjectDocument> {
    const { data: row, error } = await supabase.from('project_documents').insert(data).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as ProjectDocument;
  },
  async update(id: string, data: Partial<DocInput>): Promise<ProjectDocument> {
    const { data: row, error } = await supabase.from('project_documents').update(data).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    return row as ProjectDocument;
  },
  async remove(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('project_documents').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return { ok: true };
  },
};
