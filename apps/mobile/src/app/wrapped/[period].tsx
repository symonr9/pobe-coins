import { Children, cloneElement, isValidElement, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEMES, type ChubbyPose } from '@pobe/core';
import { useWrapped } from '@/api/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { Chubby } from '@/features/chubby/Chubby';
import { Loading } from '@/ui/bits';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { say } from '@/features/chubby/say';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Wrapped() {
  const { period } = useLocalSearchParams<{ period: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const q = useWrapped(period);
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  if (q.isLoading || !q.data) return <Loading label={t('Chubbybara is wrapping your recap…')} />;
  const w = q.data;
  const label = /^\d{4}$/.test(period)
    ? period
    : new Date(`${period}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const bgs = [THEMES.pink, THEMES.blue, THEMES.yellow, THEMES.purple, THEMES.green].map((x) => x[theme.dark ? 'dark' : 'light']);

  const cards: { pose: ChubbyPose; body: ReactNode }[] = [
    {
      pose: 'wave',
      body: (
        <>
          <Text variant="label">{t('Pobe Wrapped')}</Text>
          <Text variant="h1" center>
            {t('{{name}}, your {{period}} in coins', { name: hh.me?.name ?? '', period: label })}
          </Text>
          <Text center>{t('Tap to see what you got up to.')}</Text>
        </>
      ),
    },
    {
      pose: 'cheer',
      body: (
        <>
          <Text variant="label">{t('You earned')}</Text>
          <Text variant="hero" style={{ fontSize: 72, lineHeight: 80 }}>
            {w.earned}
          </Text>
          <Text center>{t('coins from {{n}} chores', { n: w.completions })}</Text>
          {w.bonuses ? <Text center>{t('…including {{n}} bonus coins ✨', { n: w.bonuses })}</Text> : null}
        </>
      ),
    },
    {
      pose: 'thinking',
      body: (
        <>
          <Text variant="label">{t('Your top chores')}</Text>
          {w.topChores.length ? (
            w.topChores.map((c, i) => (
              <Animated.View key={c.label} entering={FadeInUp.delay(150 * i).springify()}>
                <Text variant="h2" center>
                  {['🥇', '🥈', '🥉'][i]} {c.label}
                </Text>
                <Text center>{t('{{n}} times · {{coins}} coins', { n: c.count, coins: c.coins })}</Text>
              </Animated.View>
            ))
          ) : (
            <Text center>{t('A quiet stretch. Rest counts too.')}</Text>
          )}
        </>
      ),
    },
    {
      pose: 'happy',
      body: (
        <>
          <Text variant="label">{t('Best streak')}</Text>
          <Text variant="hero" style={{ fontSize: 72, lineHeight: 80 }}>
            🔥 {w.bestStreak}
          </Text>
          {w.busiestWeekday ? <Text center>{t('Your busiest day was {{day}}.', { day: t(WEEKDAYS[w.busiestWeekday.weekday]!) })}</Text> : null}
        </>
      ),
    },
    {
      pose: 'shopkeeper',
      body: (
        <>
          <Text variant="label">{t('At the POBE Shop')}</Text>
          <Text variant="h1" center>
            {t('You spent {{n}} coins', { n: w.spent })}
          </Text>
          {w.biggestPurchase ? <Text center>{t('Biggest treat: {{item}} ({{n}})', { item: w.biggestPurchase.label, n: w.biggestPurchase.amount })}</Text> : null}
          {w.giftsGiven ? <Text center>{t('You gave {{n}} coins as gifts 💝', { n: w.giftsGiven })}</Text> : null}
          {w.giftsReceived ? <Text center>{t('…and got {{n}} back in gifts', { n: w.giftsReceived })}</Text> : null}
        </>
      ),
    },
    {
      pose: 'cheer',
      body: (
        <>
          <Text variant="h1" center>
            {t('Thank you for making home cozy.')}
          </Text>
          <Text center>{say('affirmation', { seed: period }).text}</Text>
        </>
      ),
    },
  ];

  const go = (i: number) => {
    const next = Math.max(0, Math.min(cards.length - 1, i));
    setPage(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgs[page % bgs.length]!.primary }}>
      <View style={[styles.progress, { top: insets.top + 8 }]}>
        {cards.map((_, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i <= page ? bgs[page % bgs.length]!.onPrimary : 'rgba(0,0,0,0.12)' }]} />
        ))}
      </View>
      <Pressable style={[styles.close, { top: insets.top + 22 }]} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('Close')}>
        <Icon name="x" color={bgs[page % bgs.length]!.onPrimary} />
      </Pressable>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {cards.map((c, i) => {
          const bg = bgs[i % bgs.length]!;
          return (
            <Pressable
              key={i}
              onPress={(e) => go(e.nativeEvent.locationX < width / 3 ? i - 1 : i + 1)}
              style={{ width, height, backgroundColor: bg.primary, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}
              accessibilityLabel={t('Card {{n}} of {{total}}', { n: i + 1, total: cards.length })}
            >
              {page === i ? (
                <Animated.View entering={ZoomIn.springify().damping(12)}>
                  <Chubby pose={c.pose} accessory={hh.me?.equipped.accessory} size={150} bounceKey={page} />
                </Animated.View>
              ) : (
                <View style={{ height: 150 }} />
              )}
              <View style={{ gap: 10, alignItems: 'center', maxWidth: 440 }}>
                <ThemedCardText color={bg.onPrimary}>{c.body}</ThemedCardText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Card text inherits the card's ink color. */
function ThemedCardText({ children, color }: { children: ReactNode; color: string }) {
  return <View style={{ gap: 10, alignItems: 'center' }}>{wrapColor(children, color)}</View>;
}

function wrapColor(node: ReactNode, color: string): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const props = child.props as { children?: ReactNode; color?: string };
    if (child.type === Text) return cloneElement(child as never, { color } as never);
    return props.children ? cloneElement(child as never, {} as never, wrapColor(props.children, color)) : child;
  });
}

const styles = StyleSheet.create({
  progress: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4, zIndex: 2 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  close: { position: 'absolute', right: 16, zIndex: 3, padding: 8 },
});
