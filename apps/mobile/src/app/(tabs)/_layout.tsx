import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOTION } from '@pobe/core';
import { useSession } from '@/auth/session';
import { useApprovals, useMe } from '@/api/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, type IconName } from '@/ui/Icon';
import { Pressy } from '@/ui/Pressy';
import { Text } from '@/ui/Text';
import { Loading } from '@/ui/bits';
import { RailContext, useWide } from '@/ui/layout';
import { Chubby } from '@/features/chubby/Chubby';
import { useHousehold } from '@/features/useHousehold';

const RAIL = 232;

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'tasks', label: 'Chores', icon: 'tasks' },
  { name: 'shop', label: 'Shop', icon: 'shop' },
  { name: 'timeline', label: 'Timeline', icon: 'timeline' },
  { name: 'more', label: 'More', icon: 'more' },
];

export default function TabsLayout() {
  const { ready, active } = useSession();
  const me = useMe();
  const wide = useWide();
  if (!ready) return <Loading />;
  if (!active) return <Redirect href="/welcome" />;
  if (me.data && me.data.household === null) return <Redirect href="/setup" />;
  if (!me.data && me.isLoading) return <Loading label="Opening your purse…" />;
  return (
    <RailContext.Provider value={wide ? RAIL : 0}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => (wide ? <SideRail {...props} /> : <TabBar {...props} />)}>
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
      </Tabs>
    </RailContext.Provider>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const approvals = useApprovals();
  const pending = (approvals.data?.completions.length ?? 0) + (approvals.data?.purchases.length ?? 0);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View
        style={[styles.bar, { backgroundColor: t.c.surface, borderColor: t.c.line, shadowColor: t.c.shadow }]}
        accessibilityRole="tablist"
      >
        {state.routes.map((route, i) => {
          const tab = TABS.find((x) => x.name === route.name);
          if (!tab) return null;
          const focused = state.index === i;
          return (
            <TabButton
              key={route.key}
              focused={focused}
              icon={tab.icon}
              label={tr(tab.label)}
              badge={tab.name === 'more' ? pending : 0}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Desktop/tablet navigation: a calm left rail with the brand, labels and the purse total. */
function SideRail({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const hh = useHousehold();
  const approvals = useApprovals();
  const pending = (approvals.data?.completions.length ?? 0) + (approvals.data?.purchases.length ?? 0);
  return (
    <View style={[styles.rail, { backgroundColor: t.c.surface, borderRightColor: t.c.line }]} accessibilityRole="tablist">
      <View style={styles.brand}>
        <Chubby pose="idle" accessory={hh.me?.equipped.accessory} size={40} animate={false} />
        <View>
          <Text variant="title">Pobe Coins</Text>
          <Text variant="small" color="soft" numberOfLines={1}>
            {hh.household?.name}
          </Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((x) => x.name === route.name);
          if (!tab) return null;
          const focused = state.index === i;
          const badge = tab.name === 'more' ? pending : 0;
          return (
            <Pressy
              key={route.key}
              scaleTo={0.98}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${tr(tab.label)}, ${badge} waiting` : tr(tab.label)}
              style={[styles.railItem, focused && { backgroundColor: t.c.primary }]}
            >
              <Icon name={tab.icon} size={20} color={focused ? t.c.onPrimary : t.c.inkSoft} strokeWidth={focused ? 2.4 : 2} />
              <Text variant="title" color={focused ? t.c.onPrimary : 'soft'} style={{ flex: 1 }}>
                {tr(tab.label)}
              </Text>
              {badge > 0 ? (
                <View style={[styles.railBadge, { backgroundColor: t.c.accent }]}>
                  <Text variant="smallBold" color={t.c.bg} style={{ fontSize: 11, lineHeight: 14 }}>
                    {badge > 9 ? '9+' : badge}
                  </Text>
                </View>
              ) : null}
            </Pressy>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      {hh.me ? (
        <View style={[styles.railPurse, { backgroundColor: t.c.surfaceAlt }]}>
          <Text variant="label" color="soft">
            {tr('Your purse')}
          </Text>
          <Text variant="h2">{tr('{{n}} coins', { n: hh.balance })}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TabButton({
  focused,
  icon,
  label,
  badge,
  onPress,
}: {
  focused: boolean;
  icon: IconName;
  label: string;
  badge: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const pill = useAnimatedStyle(() => ({
    opacity: withSpring(focused ? 1 : 0, MOTION.spring),
    transform: [{ scale: withSpring(focused ? 1 : 0.6, MOTION.bouncy) }],
  }));
  return (
    <Pressy
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${label}, ${badge} waiting` : label}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.primary, borderRadius: 12 }, pill]} />
        <View style={{ zIndex: 1 }}>
          <Icon name={icon} size={22} color={focused ? t.c.onPrimary : t.c.inkSoft} strokeWidth={focused ? 2.4 : 2} />
        </View>
        {badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: t.c.accent, borderColor: t.c.surface }]}>
            <Text variant="smallBold" color={t.c.bg} style={{ fontSize: 11, lineHeight: 14 }}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="smallBold" color={focused ? 'ink' : 'soft'} style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </Text>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: RAIL,
    borderRightWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 24,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 },
  railItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  railBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  railPurse: { borderRadius: 14, padding: 14, gap: 2 },
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 12 },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { width: 52, height: 32, alignItems: 'center', justifyContent: 'center' },
  badge: {
    zIndex: 2,
    position: 'absolute',
    top: -4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
