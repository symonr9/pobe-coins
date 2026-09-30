import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { balance, pickLine, type ChubbyAccessory } from '@pobe/core';
import { actions, useGoals, useRefreshAll, useShop } from '@/api/hooks';
import { ApiError } from '@/api/client';
import type { WishlistGoal } from '@/api/types';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { useSpend } from '@/features/spending';
import { useCelebrate } from '@/features/celebrate';
import { Chubby, Bubble } from '@/features/chubby/Chubby';
import { AmountPicker } from '@/features/AmountPicker';
import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/Field';
import { EmptyState, Loading, ProgressRing, Sheet } from '@/ui/bits';
import { Card, Row, Screen, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { CoinAmount } from '@/ui/Coins';
import { useFeedback } from '@/ui/Feedback';

type Tab = 'rewards' | 'wishlist' | 'cosmetics';

export default function Shop() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { t } = useTranslation();
  const hh = useHousehold();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'rewards');
  const line = pickLine('shopGreeting', { seed: `${new Date().toDateString()}:${hh.me?.id}`, vars: { coins: hh.balance } });
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h1" accessibilityRole="header">
          {t('POBE Shop')}
        </Text>
        <CoinAmount amount={hh.balance} size={24} variant="title" />
      </Row>
      <Row style={{ alignItems: 'flex-end' }} gap={4}>
        <Chubby pose="shopkeeper" accessory={hh.me?.equipped.accessory} size={100} />
        <View style={{ flex: 1, paddingBottom: 30 }}>
          <Bubble text={t(line.text)} />
        </View>
      </Row>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'rewards', label: t('Rewards') },
          { value: 'wishlist', label: t('Wishlist') },
          { value: 'cosmetics', label: t('Dress-up') },
        ]}
      />
      {tab === 'rewards' ? <Rewards /> : tab === 'wishlist' ? <Wishlist /> : <Cosmetics />}
    </Screen>
  );
}

function Rewards() {
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const shop = useShop();
  const spend = useSpend();
  const [busy, setBusy] = useState<string | null>(null);
  if (shop.isLoading) return <Loading />;
  const items = (shop.data?.items ?? []).filter((i) => i.active);
  return (
    <Stack>
      {items.length === 0 ? (
        <EmptyState pose="shopkeeper" line={t(pickLine('emptyShop', { seed: 'x' }).text)} action={hh.isAdmin ? { title: t('Stock the shop'), onPress: () => router.push('/admin/shop') } : undefined} />
      ) : (
        <Row wrap gap={12}>
          {items.map((item) => {
            const soldOut = item.remaining === 0;
            return (
              <Card key={item.id} style={{ flexBasis: '46%', flexGrow: 1, gap: 8, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: theme.c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 34, lineHeight: 42 }}>{item.emoji ?? '🎁'}</Text>
                </View>
                <Text variant="title" center numberOfLines={2}>
                  {item.title}
                </Text>
                {item.remaining !== null ? (
                  <Text variant="small" color={soldOut ? 'danger' : 'soft'}>
                    {soldOut ? t('Sold out') : t('{{n}} left', { n: item.remaining })}
                  </Text>
                ) : null}
                <Button
                  small
                  full
                  title={t('Buy · {{n}}', { n: item.price })}
                  disabled={soldOut}
                  loading={busy === item.id}
                  onPress={async () => {
                    setBusy(item.id);
                    await spend(item.title, item.price, (allowIou) => actions.buyShopItem({ id: item.id, allowIou }));
                    setBusy(null);
                  }}
                />
              </Card>
            );
          })}
        </Row>
      )}
      {hh.isAdmin && items.length > 0 ? <Button kind="ghost" icon="edit" title={t('Manage rewards')} onPress={() => router.push('/admin/shop')} /> : null}
    </Stack>
  );
}

function Wishlist() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const goals = useGoals();
  const spend = useSpend();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const { toast, confirm } = useFeedback();
  const [giving, setGiving] = useState<WishlistGoal | null>(null);
  const [amount, setAmount] = useState(10);
  const contribute = useMutation({
    mutationFn: actions.contribute,
    onSuccess: (r: any) => {
      setGiving(null);
      if (r.reached) celebrate({ title: r.goal.title, line: t(pickLine('goalReached', { vars: { goal: r.goal.title } }).text), big: true });
      else toast(t('Saved {{n}} toward {{goal}}', { n: r.contributed, goal: r.goal.title }), 'success');
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : t('That didn\'t work.'), 'error'),
    onSettled: () => refresh(),
  });
  if (goals.isLoading) return <Loading />;
  const list = goals.data ?? [];
  return (
    <Stack>
      <Button kind="secondary" icon="plus" title={t('New wish')} onPress={() => router.push('/goal/new')} />
      {list.length === 0 ? <EmptyState line={t(pickLine('emptyGoals', { seed: 'x' }).text)} /> : null}
      {list.map((g) => {
        const shared = g.ownerId === null;
        const saved = shared ? Object.values(g.contributions).reduce((a, b) => a + b, 0) : balance(hh.me?.purse ?? {});
        const ready = saved >= g.target;
        return (
          <Card key={g.id} style={{ gap: 10 }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <ProgressRing progress={saved / g.target} size={70} label={ready ? '✓' : undefined} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">{g.title}</Text>
                <Text variant="small" color="soft">
                  {shared ? t('Shared goal') : t('Personal goal')} · {Math.min(saved, g.target)}/{g.target}
                </Text>
                {shared && Object.keys(g.contributions).length ? (
                  <Text variant="small" color="soft">
                    {Object.entries(g.contributions)
                      .map(([m, n]) => `${hh.name(m)} ${n}`)
                      .join(' · ')}
                  </Text>
                ) : null}
                {!ready ? (
                  <Text variant="smallBold" color="accent">
                    {t(pickLine('goalProgress', { vars: { goal: g.title, left: g.target - saved }, seed: g.id }).text)}
                  </Text>
                ) : null}
              </View>
            </Row>
            <Row wrap gap={8}>
              {shared && !ready ? <Button small kind="soft" icon="plus" title={t('Add coins')} onPress={() => (setAmount(Math.min(10, g.target - saved)), setGiving(g))} /> : null}
              {ready || !shared ? (
                <Button
                  small
                  title={ready ? t('Buy it!') : t('Buy now')}
                  kind={ready ? 'primary' : 'ghost'}
                  onPress={() => spend(g.title, g.target, (allowIou) => actions.buyGoal({ id: g.id, allowIou }))}
                />
              ) : null}
              {(!shared && g.ownerId === hh.me?.id) || hh.isAdmin ? (
                <Button
                  small
                  kind="danger"
                  title={t('Remove')}
                  onPress={async () => {
                    if (await confirm({ title: t('Remove "{{goal}}"?', { goal: g.title }), message: shared ? t('Everyone gets their saved coins back.') : undefined, confirm: t('Remove'), danger: true })) {
                      await actions.cancelGoal({ id: g.id }).catch((e) => toast(e.message, 'error'));
                      void refresh();
                    }
                  }}
                />
              ) : null}
            </Row>
          </Card>
        );
      })}
      <Sheet visible={!!giving} onClose={() => setGiving(null)} title={t('Add coins to {{goal}}', { goal: giving?.title ?? '' })}>
        <AmountPicker label={t('How many?')} value={amount} onChange={setAmount} coinTypes={hh.settings.coinTypes} />
        <Button full title={t('Save {{n}} coins', { n: amount })} disabled={!amount} loading={contribute.isPending} onPress={() => giving && contribute.mutate({ id: giving.id, amount })} />
      </Sheet>
    </Stack>
  );
}

function Cosmetics() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const shop = useShop();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  if (shop.isLoading) return <Loading />;
  const equipped = hh.me?.equipped.accessory ?? 'none';
  const run = async (id: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(id);
    try {
      await fn();
      after?.();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('That didn\'t work.'), 'error');
    } finally {
      setBusy(null);
      void refresh();
    }
  };
  return (
    <Stack>
      <Text color="soft">{t('Treat Chubbybara to something nice. Just for fun: cosmetics never affect chores or rewards.')}</Text>
      <Row wrap gap={12}>
        {(shop.data?.cosmetics ?? []).map((c) => {
          const wearing = c.accessory && c.owned && equipped === c.accessory;
          return (
            <Card key={c.id} style={{ flexBasis: '46%', flexGrow: 1, alignItems: 'center', gap: 6 }}>
              {c.kind === 'accessory' ? (
                <Chubby pose="happy" accessory={c.accessory as ChubbyAccessory} size={88} animate={false} />
              ) : (
                <Text style={{ fontSize: 48, lineHeight: 88 }}>{c.kind === 'background' ? '🖼️' : '📱'}</Text>
              )}
              <Text variant="title" center>
                {c.name}
              </Text>
              <Text variant="small" color="soft" center numberOfLines={2}>
                {c.description}
              </Text>
              {c.owned ? (
                c.kind === 'accessory' ? (
                  <Button
                    small
                    full
                    kind={wearing ? 'soft' : 'secondary'}
                    title={wearing ? t('Take off') : t('Wear')}
                    loading={busy === c.id}
                    onPress={() => run(c.id, () => actions.equip({ accessory: wearing ? 'none' : c.accessory }))}
                  />
                ) : (
                  <Text variant="smallBold" color="success">
                    {t('Owned')}
                  </Text>
                )
              ) : (
                <Button
                  small
                  full
                  title={t('Buy · {{n}}', { n: c.price })}
                  loading={busy === c.id}
                  disabled={hh.balance < c.price}
                  onPress={async () => {
                    if (!(await confirm({ title: t('Buy {{name}}?', { name: c.name }), message: t('{{n}} coins from your purse.', { n: c.price }), confirm: t('Buy') }))) return;
                    await run(
                      c.id,
                      async () => {
                        await actions.buyCosmetic({ cosmeticId: c.id });
                        if (c.accessory) await actions.equip({ accessory: c.accessory });
                      },
                      () => celebrate({ pose: 'cheer', title: c.name, line: t(pickLine('cosmetic', {}).text) }),
                    );
                  }}
                />
              )}
            </Card>
          );
        })}
      </Row>
    </Stack>
  );
}
