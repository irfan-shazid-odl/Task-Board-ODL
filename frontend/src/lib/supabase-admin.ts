import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS and can call the Auth admin API
// (create/delete users, reset passwords). Only ever import this from
// server-side code (Next.js Route Handlers under src/app/api/**). The
// `server-only` import above makes any accidental client-component import
// fail the build instead of shipping the service-role key to the browser.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || 'placeholder-key', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
