import { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { actions, useRefreshAll, useShop } from '@/api/hooks';
import { ApiError } from '@/api/client';
import type { ShopItem } from '@/api/types';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { AmountPicker } from '@/features/AmountPicker';
import { Button } from '@/ui/Button';
import { Field, ToggleRow } from '@/ui/Field';
import { Header, Loading, Sheet } from '@/ui/bits';
import { Card, Row, Screen, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { useFeedback } from '@/ui/Feedback';

const EMPTY = { title: '', emoji: '🎁', price: 25, stock: '', cooldownHours: '', requiresApproval: false, active: true };

export default function AdminShop() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const shop = useShop();
  const refresh = useRefreshAll();
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const e = editing!;
      const body = {
        title: e.title.trim(),
        emoji: e.emoji.trim() || undefined,
        price: e.price,
        stock: e.stock === '' ? null : Number(e.stock),
        cooldownHours: e.cooldownHours === '' ? undefined : Number(e.cooldownHours),
        requiresApproval: e.requiresApproval,
        active: e.active,
      };
      return e.id ? actions.updateShopItem({ id: e.id, ...body }) : actions.createShopItem(body);
    },
    onSuccess: () => setEditing(null),
    onError: (e) => toast(e instanceof ApiError ? e.message : t('Couldn\'t save.'), 'error'),
    onSettled: () => refresh(),
  });
  const edit = (i: ShopItem) =>
    setEditing({ id: i.id, title: i.title, emoji: i.emoji ?? '', price: i.price, stock: i.stock === null ? '' : String(i.stock), cooldownHours: i.cooldownHours ? String(i.cooldownHours) : '', requiresApproval: i.requiresApproval, active: i.active });
  return (
    <Screen>
      <Header title={t('Shop rewards')} right={<Button small icon="plus" title={t('New')} onPress={() => setEditing({ ...EMPTY })} />} />
      <Text color="soft">{t('Rewards your household can buy with coins. Delivered by whoever the reward is for.')}</Text>
      {shop.isLoading ? <Loading /> : null}
      <Stack>
        {shop.data?.items.map((i) => (
          <Card key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: i.active ? 1 : 0.5 }}>
            <Text style={{ fontSize: 28 }}>{i.emoji ?? '🎁'}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="title">{i.title}</Text>
              <Text variant="small" color="soft">
                {[
                  t('{{n}} coins', { n: i.price }),
                  i.stock !== null ? t('{{n}} left', { n: i.remaining ?? 0 }) : null,
                  i.cooldownHours ? t('once per {{h}}h', { h: i.cooldownHours }) : null,
                  i.requiresApproval ? t('needs approval') : null,
                  !i.active ? t('hidden') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Button small kind="soft" title={t('Edit')} onPress={() => edit(i)} />
          </Card>
        ))}
      </Stack>
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('Edit reward') : t('New reward')}>
        {editing ? (
          <Stack gap={12}>
            <Row gap={10} style={{ alignItems: 'flex-end' }}>
              <View style={{ width: 72 }}>
                <Field label={t('Emoji')} value={editing.emoji} onChangeText={(v) => setEditing({ ...editing, emoji: [...v].slice(-2).join('') })} style={{ textAlign: 'center', fontSize: 22 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('Reward')} value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} placeholder={t('Breakfast in bed')} maxLength={120} />
              </View>
            </Row>
            <AmountPicker label={t('Price')} value={editing.price} onChange={(price) => setEditing({ ...editing, price })} coinTypes={hh.settings.coinTypes} />
            <Row gap={10}>
              <View style={{ flex: 1 }}>
                <Field label={t('Stock (blank = unlimited)')} value={editing.stock} keyboardType="number-pad" onChangeText={(v) => setEditing({ ...editing, stock: v.replace(/\D/g, '') })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('Cooldown hours')} value={editing.cooldownHours} keyboardType="number-pad" onChangeText={(v) => setEditing({ ...editing, cooldownHours: v.replace(/\D/g, '') })} />
              </View>
            </Row>
            <ToggleRow label={t('Needs approval')} value={editing.requiresApproval} onChange={(requiresApproval) => setEditing({ ...editing, requiresApproval })} />
            <ToggleRow label={t('For sale')} value={editing.active} onChange={(active) => setEditing({ ...editing, active })} />
            <Button full title={t('Save')} disabled={!editing.title.trim() || !editing.price} loading={save.isPending} onPress={() => save.mutate()} />
            {editing.id ? (
              <Button
                kind="danger"
                title={t('Delete reward')}
                onPress={async () => {
                  if (await confirm({ title: t('Delete this reward?'), confirm: t('Delete'), danger: true })) {
                    await actions.deleteShopItem({ id: editing.id! });
                    setEditing(null);
                    void refresh();
                  }
                }}
              />
            ) : null}
          </Stack>
        ) : null}
      </Sheet>
    </Screen>
  );
}
