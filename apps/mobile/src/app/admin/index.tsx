import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMutation } from '@tanstack/react-query';
import { validateCoinTypes, type Visibility } from '@pobe/core';
import { actions, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { AmountPicker } from '@/features/AmountPicker';
import { Button } from '@/ui/Button';
import { Chip, Field, ListRow, Segmented, ToggleRow } from '@/ui/Field';
import { Avatar, Header, Sheet } from '@/ui/bits';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { Coin } from '@/ui/Coins';
import { useFeedback } from '@/ui/Feedback';
import { useSession } from '@/auth/session';

export default function Admin() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const session = useSession();
  const refresh = useRefreshAll();
  const { toast, confirm } = useFeedback();
  const s = hh.settings;
  const [name, setName] = useState(hh.household?.name ?? '');
  const [threshold, setThreshold] = useState<number | null>(s.purchaseApprovalThreshold);
  const [debtLimit, setDebtLimit] = useState(s.debtLimit);
  const [visibility, setVisibility] = useState<Visibility>(s.visibility);
  const [leaderboard, setLeaderboard] = useState(s.leaderboardEnabled);
  const [undo, setUndo] = useState(s.undoWindowMinutes);
  const [timeZone, setTimeZone] = useState(s.timeZone);
  const [coinTypes, setCoinTypes] = useState<number[]>(s.coinTypes);
  const [newCoin, setNewCoin] = useState('');
  const [newMember, setNewMember] = useState('');
  const [money, setMoney] = useState<null | 'bonus' | 'correction'>(null);
  const [target, setTarget] = useState<string | undefined>();
  const [amount, setAmount] = useState(10);
  const [negative, setNegative] = useState(false);
  const [reason, setReason] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setName(hh.household?.name ?? '');
  }, [hh.household?.name]);

  const save = useMutation({
    mutationFn: () => {
      validateCoinTypes(coinTypes);
      return actions.updateHousehold({
        name: name.trim(),
        settings: {
          purchaseApprovalThreshold: threshold,
          debtLimit,
          visibility,
          leaderboardEnabled: leaderboard,
          undoWindowMinutes: undo,
          timeZone,
          coinTypes,
        },
      });
    },
    onSuccess: () => toast(t('Household saved'), 'success'),
    onError: (e) => toast(e instanceof Error ? e.message : t("Couldn't save."), 'error'),
    onSettled: () => refresh(),
  });
  const addMember = useMutation({
    mutationFn: () => actions.addMember({ name: newMember.trim() }),
    onSuccess: (m: any) => {
      setNewMember('');
      router.push({ pathname: '/admin/member/[id]', params: { id: m.id, fresh: '1' } });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : t("Couldn't add them."), 'error'),
    onSettled: () => refresh(),
  });
  const giveMoney = useMutation({
    mutationFn: () =>
      money === 'bonus'
        ? actions.bonus({ memberId: target!, amount, reason: reason.trim() })
        : actions.correction({ memberId: target!, delta: negative ? -amount : amount, reason: reason.trim() }),
    onSuccess: () => {
      setMoney(null);
      setReason('');
      toast(money === 'bonus' ? t('Bonus sent!') : t('Correction saved'), 'success');
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : t("That didn't work."), 'error'),
    onSettled: () => refresh(),
  });

  const exportData = async () => {
    setExporting(true);
    try {
      const job = await actions.requestExport();
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await actions.exportStatus(job.id);
        if (st.status === 'ready' && st.downloadUrl) {
          await WebBrowser.openBrowserAsync(st.downloadUrl);
          return;
        }
        if (st.status === 'failed') throw new Error(t('The export failed. Please try again.'));
      }
      toast(t("Still working on it. We'll notify you when it's ready."));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Export failed.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!hh.isAdmin) {
    return (
      <Screen>
        <Header title={t('Admin')} />
        <Text color="soft">{t('Only household admins can change these settings.')}</Text>
      </Screen>
    );
  }

  return (
    <Screen
      footer={<Button full icon="check" title={t('Save household settings')} loading={save.isPending} onPress={() => save.mutate()} />}
    >
      <Header title={t('Admin')} />

      <Section title={t('Members')}>
        <Card style={{ paddingVertical: 6 }}>
          {hh.members.map((m) => (
            <ListRow
              key={m.id}
              title={m.name}
              subtitle={m.role === 'admin' ? t('Admin') : t('Member')}
              onPress={() => router.push({ pathname: '/admin/member/[id]', params: { id: m.id } })}
              right={<Avatar name={m.name} color={m.color} size={30} />}
            />
          ))}
          <Row style={{ paddingVertical: 8 }} gap={8}>
            <View style={{ flex: 1 }}>
              <Field label={t('Add someone')} value={newMember} onChangeText={setNewMember} placeholder={t('Name')} maxLength={40} />
            </View>
            <Button
              small
              icon="plus"
              title={t('Add')}
              disabled={!newMember.trim()}
              loading={addMember.isPending}
              onPress={() => addMember.mutate()}
              style={{ marginTop: 22 }}
            />
          </Row>
          <Text variant="small" color="soft">
            {t("After adding someone, you'll get a one-time QR code or link for their phone.")}
          </Text>
        </Card>
      </Section>

      <Section title={t('Coins & rules')}>
        <Card style={{ gap: 14 }}>
          <Field label={t('Household name')} value={name} onChangeText={setName} maxLength={60} />
          <Text variant="smallBold" color="soft">
            {t('Coin types')}
          </Text>
          <Row wrap gap={8}>
            {[...coinTypes]
              .sort((a, b) => a - b)
              .map((d) => (
                <Chip key={d} label={`${d}`} selected onPress={() => d !== 1 && setCoinTypes(coinTypes.filter((x) => x !== d))} />
              ))}
          </Row>
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <Field
                label={t('Add a coin type')}
                value={newCoin}
                onChangeText={(v) => setNewCoin(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="20"
              />
            </View>
            <Button
              small
              kind="soft"
              title={t('Add')}
              style={{ marginTop: 22 }}
              disabled={!newCoin || coinTypes.includes(Number(newCoin))}
              onPress={() => (setCoinTypes([...coinTypes, Number(newCoin)]), setNewCoin(''))}
            />
          </Row>
          <Text variant="small" color="soft">
            {t("Tap a coin to remove it (the 1-coin always stays). Changing coin types re-mints everyone's purse at the same value.")}
          </Text>
          <ToggleRow label={t('Big purchases need approval')} value={threshold !== null} onChange={(on) => setThreshold(on ? 100 : null)} />
          {threshold !== null ? (
            <Field
              label={t('Needs approval above')}
              value={String(threshold)}
              keyboardType="number-pad"
              onChangeText={(v) => setThreshold(Number(v.replace(/\D/g, '')) || 0)}
            />
          ) : null}
          <Field
            label={t('IOU limit per person (0 = no IOUs)')}
            value={String(debtLimit)}
            keyboardType="number-pad"
            onChangeText={(v) => setDebtLimit(Number(v.replace(/\D/g, '')) || 0)}
          />
          <Field
            label={t('Undo window (minutes)')}
            value={String(undo)}
            keyboardType="number-pad"
            onChangeText={(v) => setUndo(Math.min(60, Number(v.replace(/\D/g, '')) || 0))}
          />
          <Field
            label={t('Time zone')}
            value={timeZone}
            onChangeText={setTimeZone}
            autoCapitalize="none"
            hint={t('Decides when "daily" chores reset, e.g. America/Chicago')}
          />
          <Text variant="smallBold" color="soft">
            {t('What members can see of each other')}
          </Text>
          <Segmented<Visibility>
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'full', label: t('Everything') },
              { value: 'balances', label: t('Balances only') },
            ]}
          />
          <ToggleRow
            label={t('Friendly leaderboard')}
            hint={t('Weekly "who earned most". Off by default.')}
            value={leaderboard}
            onChange={setLeaderboard}
          />
        </Card>
      </Section>

      <Section title={t('Coins by hand')}>
        <Card style={{ paddingVertical: 6 }}>
          <ListRow
            icon="star"
            title={t('Give a bonus')}
            subtitle={t('Reward something special')}
            onPress={() => (setTarget(hh.members[0]?.id), setMoney('bonus'))}
          />
          <ListRow
            icon="edit"
            title={t('Correct a balance')}
            subtitle={t('Fix a mistake, with a reason for the log')}
            onPress={() => (setTarget(hh.members[0]?.id), setMoney('correction'))}
          />
        </Card>
      </Section>

      <Section title={t('More')}>
        <Card style={{ paddingVertical: 6 }}>
          <ListRow icon="shop" title={t('Shop rewards')} onPress={() => router.push('/admin/shop')} />
          <ListRow icon="target" title={t('Team challenges')} onPress={() => router.push('/challenges')} />
          <ListRow icon="shield" title={t('Activity log')} subtitle={t('Who changed what')} onPress={() => router.push('/admin/audit')} />
          <ListRow
            icon="download"
            title={exporting ? t('Preparing export…') : t('Export all data')}
            subtitle={t('ZIP with records, ledger CSV and photos')}
            onPress={exporting ? undefined : exportData}
          />
          <ListRow
            icon="trash"
            danger
            title={t('Delete household')}
            subtitle={t("Deletes everything for everyone. Can't be undone.")}
            onPress={async () => {
              const ok = await confirm({
                title: t('Delete {{name}}?', { name: hh.household?.name ?? '' }),
                message: t('All members, chores, coins, photos and history are deleted forever.'),
                confirm: t('Delete forever'),
                danger: true,
              });
              if (!ok) return;
              await actions.deleteHousehold().catch((e) => toast(e.message, 'error'));
              await session.updateActive({ householdId: undefined, householdName: undefined, memberId: undefined });
              await refresh();
              router.replace('/');
            }}
          />
        </Card>
      </Section>

      <Sheet visible={!!money} onClose={() => setMoney(null)} title={money === 'bonus' ? t('Give a bonus') : t('Correct a balance')}>
        <Row wrap gap={8}>
          {hh.members.map((m) => (
            <Chip key={m.id} label={m.name} color={m.color} selected={target === m.id} onPress={() => setTarget(m.id)} />
          ))}
        </Row>
        {money === 'correction' ? (
          <Segmented
            value={negative ? 'remove' : 'add'}
            onChange={(v) => setNegative(v === 'remove')}
            options={[
              { value: 'add', label: t('Add coins') },
              { value: 'remove', label: t('Remove coins') },
            ]}
          />
        ) : null}
        <AmountPicker label={t('Coins')} value={amount} onChange={setAmount} coinTypes={s.coinTypes} />
        <Field
          label={t('Reason')}
          value={reason}
          onChangeText={setReason}
          placeholder={money === 'bonus' ? t('Birthday!') : t('Counted twice')}
          maxLength={200}
        />
        <Button
          full
          title={t('Confirm')}
          disabled={!target || !amount || reason.trim().length < (money === 'bonus' ? 1 : 3)}
          loading={giveMoney.isPending}
          onPress={() => giveMoney.mutate()}
        />
      </Sheet>
      <Stack>
        <Row gap={6}>
          <Coin denom={1} size={18} />
          <Text variant="small" color="soft">
            {t('Tip: coins can only be earned, never bought with real money.')}
          </Text>
        </Row>
      </Stack>
    </Screen>
  );
}
