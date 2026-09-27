import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { supabase } from './supabase';
import type { Profile, Shop } from './types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  shop: Shop | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  shop: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setShop(null);
      return;
    }
    const [{ data: p }, { data: sh }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('shops').select('*').eq('owner_id', s.user.id).maybeSingle(),
    ]);
    setProfile((p as Profile) ?? null);
    setShop((sh as Shop) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer so we don't call Supabase inside the auth callback.
      setTimeout(() => loadProfile(s), 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setShop(null);
    router.replace('/sign-in');
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, shop, loading, refresh, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
