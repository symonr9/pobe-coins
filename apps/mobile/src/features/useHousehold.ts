import { useMemo } from 'react';
import { DEFAULT_SETTINGS, balance } from '@pobe/core';
import { useMe } from '@/api/hooks';
import { hasHousehold } from '@/api/types';

/** The active household, me, and the member list — with safe defaults while loading. */
export function useHousehold() {
  const me = useMe();
  return useMemo(() => {
    const s = hasHousehold(me.data) ? me.data : null;
    const members = s?.members ?? [];
    return {
      query: me,
      session: s,
      household: s?.household,
      settings: s?.household.settings ?? DEFAULT_SETTINGS,
      me: s?.member,
      members,
      isAdmin: s?.member.role === 'admin',
      name: (id?: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? 'Former member') : 'Anyone'),
      color: (id?: string | null) => members.find((m) => m.id === id)?.color ?? '#D8C8C0',
      balance: s ? balance(s.member.purse) : 0,
    };
  }, [me]);
}
