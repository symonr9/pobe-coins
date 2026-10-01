import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { del, get, patch, post, put } from './client';
import type {
  AuditEntry,
  Challenge,
  Device,
  DeviceLinkInfo,
  Member,
  MeResponse,
  PurchaseDetail,
  ShopResponse,
  StatsResponse,
  TaskView,
  TimelinePage,
  WishlistGoal,
  WrappedResponse,
  Comment,
  Reaction,
  WidgetSnapshot,
} from './types';

/** Query keys are scoped to the active profile so switching profiles never mixes data. */
export function useKey() {
  const { active } = useSession();
  const pid = active?.id ?? 'anon';
  return (...parts: unknown[]): QueryKey => [pid, ...parts];
}

export function useMe() {
  const k = useKey();
  const { active } = useSession();
  return useQuery({ queryKey: k('me'), queryFn: () => get<MeResponse>('/me'), enabled: !!active });
}

/** True once the active profile has a household (so household endpoints won't 403). */
function useReady() {
  const me = useMe();
  return !!me.data && me.data.household !== null;
}

export function useMembers() {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('members'), queryFn: () => get<Member[]>('/members'), enabled: ready });
}

export function useTasks() {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('tasks'), queryFn: () => get<TaskView[]>('/tasks'), enabled: ready });
}

export function useTimeline(memberId?: string) {
  const k = useKey();
  const ready = useReady();
  return useInfiniteQuery({
    queryKey: k('timeline', memberId ?? 'all'),
    queryFn: ({ pageParam }) =>
      get<TimelinePage>(`/timeline?limit=30${memberId ? `&memberId=${memberId}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: ready,
  });
}

export function useShop() {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('shop'), queryFn: () => get<ShopResponse>('/shop'), enabled: ready });
}

export function useGoals() {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('goals'), queryFn: () => get<WishlistGoal[]>('/goals'), enabled: ready });
}

export function useApprovals() {
  const k = useKey();
  const ready = useReady();
  return useQuery({
    queryKey: k('approvals'),
    queryFn: () => get<{ completions: any[]; purchases: any[] }>('/approvals'),
    refetchInterval: 60_000,
    enabled: ready,
  });
}

export function useStats(memberId?: string, weeks = 12) {
  const k = useKey();
  const ready = useReady();
  return useQuery({
    queryKey: k('stats', memberId ?? 'all', weeks),
    queryFn: () => get<StatsResponse>(`/stats?weeks=${weeks}${memberId ? `&memberId=${memberId}` : ''}`),
    enabled: ready,
  });
}

export function useWrapped(period: string, memberId?: string) {
  const k = useKey();
  const ready = useReady();
  return useQuery({
    queryKey: k('wrapped', period, memberId ?? 'me'),
    queryFn: () => get<WrappedResponse>(`/wrapped/${period}${memberId ? `?memberId=${memberId}` : ''}`),
    enabled: ready,
  });
}

export function useChallenges() {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('challenges'), queryFn: () => get<Challenge[]>('/challenges'), enabled: ready });
}

export function usePurchase(id: string) {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('purchase', id), queryFn: () => get<PurchaseDetail>(`/purchases/${id}`), enabled: ready });
}

export function useSocial(itemId: string) {
  const k = useKey();
  const ready = useReady();
  return useQuery({
    queryKey: k('social', itemId),
    queryFn: () => get<{ reactions: Reaction[]; comments: Comment[] }>(`/items/${itemId}/social`),
    enabled: ready,
  });
}

export function useLinks(enabled = true) {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('links'), queryFn: () => get<DeviceLinkInfo[]>('/links'), enabled: enabled && ready });
}

export function useDevices() {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('devices'), queryFn: () => get<Device[]>('/devices'), enabled: ready });
}

export function useAudit() {
  const k = useKey();
  const ready = useReady();
  return useQuery({ queryKey: k('audit'), queryFn: () => get<AuditEntry[]>('/audit'), enabled: ready });
}

export function useWidgetSnapshot(enabled: boolean) {
  const k = useKey();
  const ready = useReady();
  return useQuery({
    queryKey: k('widget'),
    queryFn: () => get<WidgetSnapshot>('/widget'),
    enabled: enabled && ready,
    staleTime: 5 * 60_000,
  });
}

/** Invalidates everything money-related after a change. */
export function useRefreshAll() {
  const qc = useQueryClient();
  const { active } = useSession();
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === (active?.id ?? 'anon') });
}

/** Generic mutation that refreshes the household's data afterwards. */
export function useAction<TVars, TResult = any>(fn: (vars: TVars) => Promise<TResult>) {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: fn, onSettled: () => refresh() });
}

export const actions = {
  completeTask: (v: { id: string; note?: string; photoKey?: string; checklistItemId?: string }) =>
    post(`/tasks/${v.id}/complete`, { note: v.note, photoKey: v.photoKey, checklistItemId: v.checklistItemId }),
  claimTask: (v: { id: string; claim: boolean }) => post(`/tasks/${v.id}/${v.claim ? 'claim' : 'release'}`),
  rotateTask: (v: { id: string; by: number }) => post(`/tasks/${v.id}/rotate`, { by: v.by }),
  createTask: (v: any) => post('/tasks', v),
  updateTask: (v: { id: string } & Record<string, unknown>) => patch(`/tasks/${v.id}`, { ...v, id: undefined }),
  archiveTask: (v: { id: string }) => del(`/tasks/${v.id}`),
  decideCompletion: (v: { id: string; approve: boolean }) => post(`/completions/${v.id}/decide`, { approve: v.approve }),
  undoCompletion: (v: { id: string }) => post(`/completions/${v.id}/undo`),
  createPurchase: (v: any) => post('/purchases', v),
  decidePurchase: (v: { id: string; approve: boolean }) => post(`/purchases/${v.id}/decide`, { approve: v.approve }),
  undoPurchase: (v: { id: string }) => post(`/purchases/${v.id}/undo`),
  fulfill: (v: { id: string }) => post(`/purchases/${v.id}/fulfill`),
  buyShopItem: (v: { id: string; allowIou?: boolean }) => post(`/shop/items/${v.id}/buy`, { allowIou: !!v.allowIou }),
  createShopItem: (v: any) => post('/shop/items', v),
  updateShopItem: (v: { id: string } & Record<string, unknown>) => patch(`/shop/items/${v.id}`, { ...v, id: undefined }),
  deleteShopItem: (v: { id: string }) => del(`/shop/items/${v.id}`),
  buyCosmetic: (v: { cosmeticId: string }) => post('/shop/cosmetics/buy', v),
  equip: (v: { accessory?: string; icon?: string; background?: string }) => post('/me/equip', v),
  createGoal: (v: any) => post('/goals', v),
  contribute: (v: { id: string; amount: number }) => post(`/goals/${v.id}/contribute`, { amount: v.amount }),
  buyGoal: (v: { id: string; allowIou?: boolean }) => post(`/goals/${v.id}/buy`, { allowIou: !!v.allowIou }),
  cancelGoal: (v: { id: string }) => post(`/goals/${v.id}/cancel`),
  gift: (v: { toMemberId: string; amount: number; message?: string }) => post('/gifts', v),
  bonus: (v: { memberId: string; amount: number; reason: string }) => post('/bonuses', v),
  correction: (v: { memberId: string; delta: number; reason: string }) => post('/corrections', v),
  createChallenge: (v: any) => post('/challenges', v),
  deleteChallenge: (v: { id: string }) => del(`/challenges/${v.id}`),
  react: (v: { itemId: string; emoji: string | null }) =>
    v.emoji ? put(`/items/${v.itemId}/reaction`, { emoji: v.emoji }) : del(`/items/${v.itemId}/reaction`),
  comment: (v: { itemId: string; text: string; ownerId?: string }) =>
    post(`/items/${v.itemId}/comments`, { text: v.text, ownerId: v.ownerId }),
  deleteComment: (v: { itemId: string; id: string }) => del(`/items/${v.itemId}/comments/${v.id}`),
  updateHousehold: (v: any) => patch('/household', v),
  deleteHousehold: () => del('/household'),
  addMember: (v: { name: string; role?: string }) => post('/members', v),
  updateMember: (v: { id: string } & Record<string, unknown>) => patch(`/members/${v.id}`, { ...v, id: undefined }),
  removeMember: (v: { id: string }) => del(`/members/${v.id}`),
  createLink: (v: { memberId: string; expiresInHours?: number }) =>
    post<{ token: string; url: string; expiresAt: string; id: string }>('/links', v),
  deleteLink: (v: { id: string }) => del(`/links/${v.id}`),
  revokeDevice: (v: { id: string }) => del(`/devices/${v.id}`),
  createHousehold: (v: { name: string; memberName: string; timeZone: string; templateIds: string[] }) => post('/households', v),
  calendar: () => post<{ url: string }>('/calendar'),
  removeCalendar: () => del('/calendar'),
  requestExport: () => post<{ id: string }>('/export'),
  exportStatus: (id: string) => get<{ status: string; downloadUrl?: string }>(`/export/${id}`),
  linkPreview: (url: string) => post('/link-preview', { url }),
  deleteAccount: () => del('/me'),
  linkAccount: (idToken: string) => post('/me/link-account', { idToken }),
};
