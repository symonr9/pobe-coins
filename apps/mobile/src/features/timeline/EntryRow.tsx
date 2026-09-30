import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useMutation } from '@tanstack/react-query';
import type { LedgerKind } from '@pobe/core';
import { actions, useRefreshAll } from '@/api/hooks';
import type { TimelineItem } from '@/api/types';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { haptic } from '@/lib/feedback';
import { Icon, type IconName } from '@/ui/Icon';
import { Pressy } from '@/ui/Pressy';
import { Row } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { Avatar } from '@/ui/bits';

export const REACTIONS = ['💖', '🎉', '👏', '😂', '🥹'];

const KIND: Record<LedgerKind, { icon: IconName; label: string }> = {
  EARN: { icon: 'check', label: 'Chore' },
  BONUS: { icon: 'star', label: 'Bonus' },
  GIFT_IN: { icon: 'gift', label: 'Gift' },
  GIFT_OUT: { icon: 'gift', label: 'Gift' },
  SPEND: { icon: 'shop', label: 'Purchase' },
  COSMETIC: { icon: 'sparkle', label: 'Dress-up' },
  GOAL_CONTRIBUTE: { icon: 'target', label: 'Saved' },
  GOAL_REFUND: { icon: 'target', label: 'Returned' },
  REFUND: { icon: 'undo', label: 'Refund' },
  UNDO: { icon: 'undo', label: 'Undo' },
  CORRECTION: { icon: 'edit', label: 'Correction' },
  CONVERT: { icon: 'swap', label: 'Re-minted' },
};

export function EntryRow({ item }: { item: TimelineItem }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const hh = useHousehold();
  const refresh = useRefreshAll();
  const [picking, setPicking] = useState(false);
  const e = item.entry;
  const k = KIND[e.kind];
  const positive = e.value > 0;
  const mine = item.reactions.find((r) => r.memberId === hh.me?.id);
  const react = useMutation({ mutationFn: actions.react, onSettled: () => refresh() });
  const counts = new Map<string, number>();
  for (const r of item.reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const open = () =>
    item.purchase ? router.push({ pathname: '/purchase/[id]', params: { id: item.purchase.id } }) : router.push({ pathname: '/item/[id]', params: { id: e.id, owner: e.memberId, label: e.label } });

  return (
    <View style={{ paddingVertical: 10, gap: 8 }}>
      <Pressy onPress={open} scaleTo={0.985} accessibilityLabel={`${hh.name(e.memberId)}: ${e.label}, ${positive ? '+' : ''}${e.value}`}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View>
            <Avatar name={hh.name(e.memberId)} color={hh.color(e.memberId)} size={38} />
            <View style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k.icon} size={13} color={positive ? theme.c.success : theme.c.accent} strokeWidth={2.6} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyBold" numberOfLines={2}>
              {e.label}
            </Text>
            <Text variant="small" color="soft">
              {hh.name(e.memberId)} · {t(k.label)} · {new Date(e.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              {e.debtDelta > 0 ? ` · ${t('IOU {{n}}', { n: e.debtDelta })}` : ''}
              {item.purchase?.status === 'pending' ? ` · ⏳ ${t('pending')}` : ''}
              {item.purchase?.redemption === 'redeemed' ? ` · ${t('to deliver')}` : item.purchase?.redemption === 'fulfilled' ? ` · ${t('delivered')}` : ''}
            </Text>
          </View>
          {item.thumbUrl ? <Image source={{ uri: item.thumbUrl }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" /> : null}
          {e.value !== 0 ? (
            <Text variant="number" color={positive ? 'success' : 'ink'} style={{ minWidth: 48, textAlign: 'right' }}>
              {positive ? '+' : '−'}
              {Math.abs(e.value)}
            </Text>
          ) : null}
        </Row>
      </Pressy>
      <Row gap={6} style={{ marginLeft: 50 }} wrap>
        {[...counts.entries()].map(([emoji, n]) => (
          <Pressy
            key={emoji}
            onPress={() => react.mutate({ itemId: e.id, emoji: mine?.emoji === emoji ? null : emoji })}
            style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: mine?.emoji === emoji ? theme.c.primary : theme.c.surfaceAlt }}
            accessibilityLabel={t('{{emoji}} {{n}}', { emoji, n })}
          >
            <Text variant="small">{emoji}</Text>
            <Text variant="smallBold">{n}</Text>
          </Pressy>
        ))}
        {picking ? (
          REACTIONS.map((emoji) => (
            <Pressy
              key={emoji}
              noHaptic
              onPress={() => {
                haptic.select();
                setPicking(false);
                react.mutate({ itemId: e.id, emoji });
              }}
              style={{ padding: 4 }}
              accessibilityLabel={t('React {{emoji}}', { emoji })}
            >
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
            </Pressy>
          ))
        ) : (
          <Pressy onPress={() => setPicking(true)} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1.5, borderColor: theme.c.line }} accessibilityLabel={t('Add reaction')}>
            <Text variant="smallBold" color="soft">
              ＋☺
            </Text>
          </Pressy>
        )}
        <Pressy onPress={open} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }} accessibilityLabel={t('{{n}} comments', { n: item.comments })}>
          <Icon name="chat" size={16} color={theme.c.inkSoft} />
          {item.comments ? <Text variant="smallBold" color="soft">{item.comments}</Text> : null}
        </Pressy>
      </Row>
    </View>
  );
}
