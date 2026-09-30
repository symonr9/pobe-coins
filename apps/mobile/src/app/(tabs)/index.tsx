import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { balance, greetingContext, toLocalDate } from '@pobe/core';
import { useApprovals, useChallenges, useGoals, useMembers, useRefreshAll, useTasks } from '@/api/hooks';
import { useTranslation } from '@/i18n';
import { usePrefs } from '@/lib/prefs-context';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { Chubby } from '@/features/chubby/Chubby';
import { TaskRow } from '@/features/tasks/TaskRow';
import { enablePush, pushPermission, pushSupport } from '@/push';
import { Button } from '@/ui/Button';
import { PurseView } from '@/ui/Coins';
import { Avatar, EmptyState, ProgressRing } from '@/ui/bits';
import { Card, Columns, Row, Screen, Section, useWide } from '@/ui/layout';
import { Icon } from '@/ui/Icon';
import { Pressy } from '@/ui/Pressy';
import { Text } from '@/ui/Text';
import { useFeedback } from '@/ui/Feedback';
import { say } from '@/features/chubby/say';

export default function Home() {
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const tasks = useTasks();
  const approvals = useApprovals();
  const challenges = useChallenges();
  const goals = useGoals();
  const refresh = useRefreshAll();
  const { prefs, update } = usePrefs();
  const [refreshing, setRefreshing] = useState(false);
  const wide = useWide();

  const me = hh.me;
  const tz = hh.settings.timeZone;
  const today = toLocalDate(new Date(), tz);
  const hour = new Date().getHours();
  const line = useMemo(() => {
    if (!me) return null;
    return say(greetingContext(hour), { seed: `${today}:${me.id}`, vars: { name: me.name, coins: balance(me.purse) }, recent: prefs.recentLines });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, today, hour]);
  useEffect(() => {
    if (line && !prefs.recentLines.includes(line.raw)) update({ recentLines: [line.raw, ...prefs.recentLines].slice(0, 20) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.raw]);

  if (!me) return null;
  const mine = (tasks.data ?? []).filter(
    (x) => !x.doneThisPeriod && (x.effectiveAssigneeId === me.id || (x.effectiveAssigneeId === null && (!x.claimedBy || x.claimedBy === me.id))),
  );
  const dueToday = mine.filter((x) => !x.nextDueAt || toLocalDate(new Date(x.nextDueAt), tz) <= today);
  const waiting = (approvals.data?.completions.length ?? 0) + (approvals.data?.purchases.length ?? 0);
  const challenge = challenges.data?.find((c) => c.status === 'active' && Date.parse(c.endsAt) > Date.now());
  const openVisibility = hh.settings.visibility === 'full' || hh.isAdmin;

  const greeting = hour < 12 ? t('Good morning, {{name}}', { name: me.name }) : hour < 18 ? t('Good afternoon, {{name}}', { name: me.name }) : t('Good evening, {{name}}', { name: me.name });
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const hero = (
    <Animated.View entering={FadeInDown.springify().damping(16)}>
      <Card style={{ gap: 16, padding: 20, backgroundColor: theme.c.primary, borderColor: theme.c.primary, overflow: 'hidden' }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color="onPrimary" style={{ opacity: 0.8 }}>
              {t('Your purse')}
            </Text>
            <Row gap={8} style={{ alignItems: 'baseline' }}>
              <Text variant="hero" color="onPrimary" accessibilityLabel={t('{{n}} coins', { n: hh.balance })}>
                {hh.balance}
              </Text>
              <Text variant="smallBold" color="onPrimary">
                {t('coins')}
              </Text>
            </Row>
            {me.debt > 0 ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: theme.c.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 }}>
                <Text variant="smallBold" color="warning">
                  {t('IOU {{n}} · your next chores pay it back', { n: me.debt })}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressy onPress={() => router.push('/shop')} noHaptic scaleTo={0.94} accessibilityLabel={t('Chubbybara')} style={{ marginTop: -10, marginRight: -8 }}>
            <Chubby pose={line?.pose ?? 'wave'} accessory={me.equipped.accessory} size={108} />
          </Pressy>
        </Row>
        {line ? (
          <View style={{ backgroundColor: theme.c.surface, borderRadius: 14, borderTopRightRadius: 4, paddingHorizontal: 14, paddingVertical: 12, gap: 2 }}>
            <Text variant="label" color="soft">
              {t('Chubbybara says')}
            </Text>
            <Text variant="body" style={{ fontFamily: theme.fonts.bodySemi }}>
              {line.text}
            </Text>
          </View>
        ) : null}
        <View style={{ backgroundColor: theme.c.surface, borderRadius: 14, padding: 12 }}>
          <PurseView purse={me.purse} coinTypes={hh.settings.coinTypes} size={34} />
        </View>
        <Row gap={8}>
          <Button small kind="soft" icon="shop" title={t('Spend')} style={{ flex: 1 }} onPress={() => router.push('/spend')} />
          <Button small kind="soft" icon="gift" title={t('Gift')} style={{ flex: 1 }} onPress={() => router.push('/gift')} />
          <Button small kind="soft" icon="target" title={t('Goals')} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/shop', params: { tab: 'wishlist' } })} />
        </Row>
      </Card>
    </Animated.View>
  );

  const approvalsCard =
    waiting > 0 ? (
      <Pressy onPress={() => router.push('/approvals')} scaleTo={0.98}>
        <Card tint style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={20} color={theme.c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">{t('{{n}} waiting for your OK', { n: waiting })}</Text>
            <Text variant="small" color="soft">
              {t('Chores and purchases that need someone else to approve.')}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={theme.c.inkSoft} />
        </Card>
      </Pressy>
    ) : null;

  const goalsSection = goals.data?.length ? (
    <Section title={t('Saving for')} action={<Button small kind="ghost" title={t('Wishlist')} onPress={() => router.push({ pathname: '/shop', params: { tab: 'wishlist' } })} />}>
      <Card style={{ paddingVertical: 6 }}>
        {goals.data.slice(0, 3).map((g) => {
          const saved = g.ownerId ? balance(me.purse) : Object.values(g.contributions).reduce((a, b) => a + b, 0);
          return (
            <Pressy key={g.id} scaleTo={0.98} onPress={() => router.push({ pathname: '/shop', params: { tab: 'wishlist' } })}>
              <Row style={{ paddingVertical: 8 }}>
                <ProgressRing progress={saved / g.target} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="title" numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text variant="small" color="soft">
                    {g.ownerId ? t('Personal') : t('Shared')} · {t('{{n}} to go', { n: Math.max(0, g.target - saved) })}
                  </Text>
                </View>
                <Text variant="number">
                  {Math.min(saved, g.target)}
                  <Text variant="small" color="soft">{` / ${g.target}`}</Text>
                </Text>
              </Row>
            </Pressy>
          );
        })}
      </Card>
    </Section>
  ) : null;

  const choresSection = (
    <Section title={t("Today's chores")} action={<Button small kind="ghost" title={t('All chores')} onPress={() => router.push('/tasks')} />}>
      <Card style={{ paddingVertical: 6 }}>
        {tasks.isLoading ? (
          <Text color="soft">{t('Loading…')}</Text>
        ) : dueToday.length === 0 ? (
          <EmptyState pose="happy" line={say(mine.length ? 'allDone' : 'emptyTasks', { vars: { name: me.name }, seed: today }).text} />
        ) : (
          dueToday.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </Card>
    </Section>
  );

  const challengeSection = challenge ? (
    <Section title={t('Team challenge')}>
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <ProgressRing progress={challenge.progress / challenge.target} size={68} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{challenge.title}</Text>
          <Text variant="small" color="soft">
            {t('{{p}} of {{target}} coins together · ends {{date}}', {
              p: Math.min(challenge.progress, challenge.target),
              target: challenge.target,
              date: new Date(challenge.endsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
            })}
          </Text>
          {challenge.bonus ? (
            <Text variant="smallBold" color="accent">
              {t('Everyone gets {{n}} bonus coins', { n: challenge.bonus })}
            </Text>
          ) : null}
        </View>
      </Card>
    </Section>
  ) : null;

  const householdSection =
    openVisibility && hh.members.length > 1 ? (
      <Section title={t('Household')}>
        <Card style={{ gap: 12 }}>
          {hh.members.map((m) => (
            <MemberBalance key={m.id} memberId={m.id} />
          ))}
        </Card>
      </Section>
    ) : null;

  return (
    <Screen
      wide
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" color="soft">
            {dateLabel}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {greeting}
          </Text>
        </View>
        <Pressy onPress={() => router.push('/settings')} accessibilityLabel={t('Profile and settings')}>
          <Avatar name={me.name} color={me.color} size={44} />
        </Pressy>
      </Row>

      {wide ? (
        <Columns
          left={
            <>
              {hero}
              <PushPrompt />
              {approvalsCard}
              {goalsSection}
            </>
          }
          right={
            <>
              {choresSection}
              {challengeSection}
              {householdSection}
            </>
          }
        />
      ) : (
        <>
          {hero}
          <PushPrompt />
          {approvalsCard}
          {choresSection}
          {challengeSection}
          {goalsSection}
          {householdSection}
        </>
      )}
    </Screen>
  );
}

function MemberBalance({ memberId }: { memberId: string }) {
  const hh = useHousehold();
  const { t } = useTranslation();
  const m = hh.members.find((x) => x.id === memberId)!;
  return (
    <Pressy onPress={() => router.push({ pathname: '/timeline', params: { member: memberId } })} scaleTo={0.98}>
      <Row>
        <Avatar name={m.name} color={m.color} size={32} />
        <Text variant="bodyBold" style={{ flex: 1 }}>
          {m.name}
          {m.id === hh.me?.id ? ` (${t('you')})` : ''}
        </Text>
        <MemberCoins memberId={memberId} />
      </Row>
    </Pressy>
  );
}

function MemberCoins({ memberId }: { memberId: string }) {
  const members = useMembers();
  const m = members.data?.find((x) => x.id === memberId);
  if (!m) return null;
  return (
    <Text variant="number" accessibilityLabel={`${balance(m.purse)} coins`}>
      {balance(m.purse)}
      {m.debt ? <Text variant="small" color="warning">{`  −${m.debt}`}</Text> : null}
    </Text>
  );
}

/** Friendly ask for notifications (never on first launch; only once they have a household). */
function PushPrompt() {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const [state, setState] = useState<'hidden' | 'ask' | 'install'>('hidden');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      const support = pushSupport();
      if (support === 'web-needs-install') return setState('install');
      if (support === 'unsupported') return;
      if ((await pushPermission()) === 'undetermined') setState('ask');
    })();
  }, []);
  if (state === 'hidden') return null;
  return (
    <Card tint style={{ gap: 10 }}>
      <Row>
        <Chubby pose="thinking" size={56} animate={false} />
        <View style={{ flex: 1 }}>
          <Text variant="title">{state === 'install' ? t('Add Pobe to your Home Screen') : t('Want a heads-up?')}</Text>
          <Text variant="small" color="soft">
            {state === 'install'
              ? t('On iPhone, notifications work after you tap Share, then "Add to Home Screen", and open Pobe from there.')
              : t('I can tell you when chores need approval, gifts arrive, or something is due.')}
          </Text>
        </View>
      </Row>
      {state === 'ask' ? (
        <Row>
          <Button
            small
            title={t('Turn on notifications')}
            icon="bell"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await enablePush().catch(() => false);
              setBusy(false);
              setState('hidden');
              toast(ok ? t("Notifications are on. I'll keep you posted!") : t('Notifications are off. You can turn them on in Settings.'));
            }}
          />
          <Button small kind="ghost" title={t('Not now')} onPress={() => setState('hidden')} />
        </Row>
      ) : null}
    </Card>
  );
}

