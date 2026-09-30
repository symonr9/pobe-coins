import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useMutation } from '@tanstack/react-query';
import { actions, usePurchase, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { Comments } from '@/features/Comments';
import { Button } from '@/ui/Button';
import { Avatar, ErrorState, Header, Loading } from '@/ui/bits';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Pressy } from '@/ui/Pressy';
import { Text } from '@/ui/Text';
import { CoinAmount } from '@/ui/Coins';
import { useFeedback } from '@/ui/Feedback';

export default function PurchaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const q = usePurchase(id);
  const refresh = useRefreshAll();
  const { toast, confirm } = useFeedback();
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onError: (e) => toast(e instanceof ApiError ? e.message : t('That didn\'t work.'), 'error'),
    onSettled: () => refresh(),
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => router.back()} />;
  const { purchase: p, photoUrls, fundedBy } = q.data;
  const mine = p.memberId === hh.me?.id;
  const recent = Date.now() - Date.parse(p.createdAt) < hh.settings.undoWindowMinutes * 60_000;
  const total = fundedBy.reduce((s, f) => s + f.amount, 0) || 1;

  return (
    <Screen>
      <Header title={p.title} />
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Avatar name={hh.name(p.memberId)} color={hh.color(p.memberId)} />
            <View>
              <Text variant="bodyBold">{hh.name(p.memberId)}</Text>
              <Text variant="small" color="soft">
                {new Date(p.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </View>
          </Row>
          <CoinAmount amount={-p.amount} sign variant="h2" size={26} />
        </Row>
        {p.status !== 'approved' ? (
          <Text variant="smallBold" color={p.status === 'pending' ? 'warning' : 'soft'}>
            {p.status === 'pending' ? `⏳ ${t('Waiting for approval')}` : p.status === 'rejected' ? t('Declined, coins returned') : t('Undone, coins returned')}
          </Text>
        ) : null}
        {p.kind === 'reward' ? (
          <Text variant="smallBold" color={p.redemption === 'fulfilled' ? 'success' : 'accent'}>
            {p.redemption === 'fulfilled' ? `✓ ${t('Delivered by {{name}}', { name: hh.name(p.fulfilledBy) })}` : `🎁 ${t('Shop reward, waiting to be delivered')}`}
          </Text>
        ) : null}
        {p.description ? <Text>{p.description}</Text> : null}
        {photoUrls.length ? (
          <Row wrap gap={8}>
            {photoUrls.map((u) => (
              <Image key={u} source={{ uri: u }} style={{ width: 150, height: 150, borderRadius: 18 }} contentFit="cover" accessibilityLabel={t('Photo of {{item}}', { item: p.title })} />
            ))}
          </Row>
        ) : null}
        {p.url ? (
          <Pressy onPress={() => WebBrowser.openBrowserAsync(p.url!)} scaleTo={0.98}>
            <Row style={{ backgroundColor: theme.c.surfaceAlt, borderRadius: 16, padding: 10 }}>
              {p.preview?.image ? <Image source={{ uri: p.preview.image }} style={{ width: 56, height: 56, borderRadius: 10 }} /> : null}
              <View style={{ flex: 1 }}>
                <Text variant="smallBold" numberOfLines={2}>
                  {p.preview?.title ?? p.url}
                </Text>
                <Text variant="small" color="accent" numberOfLines={1}>
                  {p.preview?.siteName ?? t('Open link')} ↗
                </Text>
              </View>
            </Row>
          </Pressy>
        ) : null}
      </Card>

      {fundedBy.length ? (
        <Section title={t('Paid for by')}>
          <Card style={{ gap: 10 }}>
            {fundedBy.map((f) => (
              <View key={f.label} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="bodyBold" color={f.iou ? 'warning' : 'ink'}>
                    {f.iou ? t('IOU (still to earn)') : f.count > 1 ? `${f.label} ×${f.count}` : f.label}
                  </Text>
                  <Text variant="number">{f.amount}</Text>
                </Row>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.c.surfaceAlt }}>
                  <View style={{ width: `${(f.amount / total) * 100}%`, height: 8, borderRadius: 4, backgroundColor: f.iou ? theme.c.warning : theme.c.accent }} />
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Stack gap={8}>
        {p.kind === 'reward' && p.redemption === 'redeemed' && p.status === 'approved' ? (
          <Button kind="secondary" icon="check" title={t('Mark delivered')} onPress={() => act.mutate(() => actions.fulfill({ id: p.id }))} />
        ) : null}
        {mine && recent && (p.status === 'approved' || p.status === 'pending') && p.kind !== 'goal' ? (
          <Button
            kind="ghost"
            icon="undo"
            title={t('Undo purchase')}
            onPress={async () => {
              if (await confirm({ title: t('Undo this purchase?'), message: t('Your coins come back.'), confirm: t('Undo') })) act.mutate(() => actions.undoPurchase({ id: p.id }), { onSuccess: () => router.back() });
            }}
          />
        ) : null}
      </Stack>
      {p.ledgerEntryIds[0] ? <Comments itemId={p.ledgerEntryIds[0]} ownerId={p.memberId} /> : null}
    </Screen>
  );
}
