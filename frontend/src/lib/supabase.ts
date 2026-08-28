import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create a safe client that won't throw during build/SSG when env vars are missing.
function createSafeClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    if (typeof window === 'undefined') {
      return createClient('https://placeholder.supabase.co', 'placeholder-key');
    }
    console.warn('Supabase URL and/or Anon Key are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

// The single browser/client-side Supabase client. Carries the signed-in
// user's session once `supabase.auth.signInWithPassword(...)` succeeds, so
// every table query after that runs as that user (RLS-aware).
export const supabase = createSafeClient();
