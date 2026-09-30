/**
 * Profiles on this device. A device can hold several: e.g. a shared tablet with both
 * partners, or one person in two households. Each profile is either
 *  - a device profile (joined with a one-time link; bound to one member), or
 *  - a user profile (Google/Apple; can belong to several households).
 * Tokens live in secure storage; metadata in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setAuthBridge } from '@/api/client';
import { deleteSecret, getSecret, setSecret } from '@/lib/secure';

export interface Profile {
  id: string;
  kind: 'device' | 'user';
  name: string;
  householdId?: string;
  householdName?: string;
  memberId?: string;
  addedAt: string;
}

interface SessionValue {
  ready: boolean;
  profiles: Profile[];
  active: Profile | null;
  /** Adds a profile (token already verified by the API) and makes it active. */
  addProfile: (p: Omit<Profile, 'id' | 'addedAt'>, token: string) => Promise<Profile>;
  updateActive: (patch: Partial<Profile>) => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  signOut: (id?: string) => Promise<void>;
  token: () => Promise<string | null>;
}

const INDEX = 'pobe.profiles';
const ACTIVE = 'pobe.active';
const tokenKey = (id: string) => `pobe.token.${id}`;

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children, onSwitch }: { children: ReactNode; onSwitch?: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const tokenCache = useRef(new Map<string, string>());
  const activeRef = useRef<Profile | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = JSON.parse((await AsyncStorage.getItem(INDEX)) ?? '[]') as Profile[];
        const id = await AsyncStorage.getItem(ACTIVE);
        const valid: Profile[] = [];
        for (const p of list) {
          const t = await getSecret(tokenKey(p.id));
          if (t) {
            tokenCache.current.set(p.id, t);
            valid.push(p);
          }
        }
        setProfiles(valid);
        setActiveId(valid.find((p) => p.id === id)?.id ?? valid[0]?.id ?? null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (list: Profile[], id: string | null) => {
    setProfiles(list);
    setActiveId(id);
    await AsyncStorage.setItem(INDEX, JSON.stringify(list));
    if (id) await AsyncStorage.setItem(ACTIVE, id);
    else await AsyncStorage.removeItem(ACTIVE);
  }, []);

  const active = useMemo(() => profiles.find((p) => p.id === activeId) ?? null, [profiles, activeId]);
  activeRef.current = active;

  const token = useCallback(async () => {
    const a = activeRef.current;
    if (!a) return null;
    return tokenCache.current.get(a.id) ?? (await getSecret(tokenKey(a.id)));
  }, []);

  const signOut = useCallback(
    async (id?: string) => {
      const target = id ?? activeRef.current?.id;
      if (!target) return;
      tokenCache.current.delete(target);
      await deleteSecret(tokenKey(target));
      const rest = profiles.filter((p) => p.id !== target);
      await persist(rest, activeId === target ? (rest[0]?.id ?? null) : activeId);
      onSwitch?.();
    },
    [profiles, activeId, persist, onSwitch],
  );

  useEffect(() => {
    setAuthBridge({
      token,
      householdId: () => (activeRef.current?.kind === 'user' ? activeRef.current.householdId : undefined),
      onRefreshed: (t) => {
        const a = activeRef.current;
        if (!a) return;
        tokenCache.current.set(a.id, t);
        void setSecret(tokenKey(a.id), t);
      },
      onUnauthorized: () => {
        void signOut();
      },
    });
  }, [token, signOut]);

  const addProfile = useCallback(
    async (p: Omit<Profile, 'id' | 'addedAt'>, t: string) => {
      // Re-use an existing profile for the same member/user.
      const existing = profiles.find((x) => x.kind === p.kind && (p.kind === 'device' ? x.memberId === p.memberId : x.name === p.name && x.householdId === p.householdId));
      const profile: Profile = { ...p, id: existing?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, addedAt: new Date().toISOString() };
      tokenCache.current.set(profile.id, t);
      await setSecret(tokenKey(profile.id), t);
      await persist([...profiles.filter((x) => x.id !== profile.id), profile], profile.id);
      onSwitch?.();
      return profile;
    },
    [profiles, persist, onSwitch],
  );

  const updateActive = useCallback(
    async (patch: Partial<Profile>) => {
      const a = activeRef.current;
      if (!a) return;
      await persist(profiles.map((p) => (p.id === a.id ? { ...p, ...patch } : p)), a.id);
    },
    [profiles, persist],
  );

  const switchTo = useCallback(
    async (id: string) => {
      await persist(profiles, id);
      onSwitch?.();
    },
    [profiles, persist, onSwitch],
  );

  const value = useMemo(
    () => ({ ready, profiles, active, addProfile, updateActive, switchTo, signOut, token }),
    [ready, profiles, active, addProfile, updateActive, switchTo, signOut, token],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/** Exchanges a provider ID token for an app session and stores the profile. */
export async function exchangeAndStore(session: SessionValue, idToken: string) {
  const r = await api<{ token: string; user: { sub: string; name?: string; email?: string } }>('POST', '/auth/exchange', { idToken }, { token: null });
  const me = await api<any>('GET', '/me', undefined, { token: r.token });
  const household = me.household;
  return session.addProfile(
    {
      kind: 'user',
      name: me.member?.name ?? r.user.name ?? r.user.email ?? 'Me',
      householdId: household?.id,
      householdName: household?.name,
      memberId: me.member?.id,
    },
    r.token,
  );
}
