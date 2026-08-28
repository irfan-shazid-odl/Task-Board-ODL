'use client';

import { useEffect } from 'react';
import { useUser } from '@/components/UserContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { currentUser, loading } = useUser();
  const { replace } = useSafeRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        if (currentUser.role === 'Member' || currentUser.role === 'Lead') {
          replace('/board');
        } else {
          replace('/dashboard');
        }
      } else {
        replace('/login');
      }
    }
  }, [currentUser, loading, replace]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p className="text-sm font-medium">Authenticating...</p>
      </div>
    </div>
  );
}
