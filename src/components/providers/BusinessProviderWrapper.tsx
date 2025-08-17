"use client";

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { BusinessProvider } from '@/lib/user/BusinessContext';
import { Spinner } from '@/components/ui/spinner';

interface BusinessProviderWrapperProps {
  children: React.ReactNode;
}

export function BusinessProviderWrapper({ children }: BusinessProviderWrapperProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <BusinessProvider user={user}>
      {children}
    </BusinessProvider>
  );
}
