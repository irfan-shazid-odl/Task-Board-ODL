import { supabase } from './supabase';

// Matches the bucket + path scheme the live data already uses:
// `team_members.avatar_url` holds a storage *path* like
// "<user-id>/avatar-<timestamp>.<ext>", not a full URL.
export const AVATAR_BUCKET = 'team';

export function getSignedAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return Promise.resolve(null);
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return Promise.resolve(data?.publicUrl || null);
}

export function invalidateAvatarUrl(_path: string | null | undefined) {
  // No-op: public URLs are stable per uploaded path.
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function deleteAvatar(path: string): Promise<void> {
  try {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  } catch {
    /* best-effort cleanup */
  }
}
