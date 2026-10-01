/** Android home-screen widget (react-native-android-widget). */
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { chubbybaraSvg } from '@pobe/core';
import type { WidgetSnapshot } from '@/api/types';
import { widgetColors } from '../snapshot';

export function PurseWidget({ snapshot }: { snapshot: WidgetSnapshot | null }) {
  const c = widgetColors(snapshot?.theme ?? 'pink');
  if (!snapshot) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: c.bg as `#${string}`,
          borderRadius: 24,
          padding: 14,
          justifyContent: 'center',
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget text="Open Pobe Coins to set up your widget" style={{ fontSize: 14, color: c.ink as `#${string}` }} />
      </FlexWidget>
    );
  }
  const svg = chubbybaraSvg({ pose: snapshot.pose as never, accessory: snapshot.accessory as never, accent: c.card, id: 'w' });
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.bg as `#${string}`,
        borderRadius: 24,
        padding: 14,
        flexDirection: 'row',
      }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'space-between', height: 'match_parent' }}>
        <TextWidget text={`${snapshot.name}'s purse`} style={{ fontSize: 13, fontWeight: 'bold', color: c.ink as `#${string}` }} />
        <TextWidget text={`${snapshot.balance}`} style={{ fontSize: 34, fontWeight: 'bold', color: c.ink as `#${string}` }} />
        <TextWidget
          text={snapshot.today === 0 ? 'All done today!' : `${snapshot.today} chore${snapshot.today === 1 ? '' : 's'} today`}
          style={{ fontSize: 13, color: c.ink as `#${string}` }}
        />
        {snapshot.next[0] ? (
          <TextWidget text={`• ${snapshot.next[0].title}`} style={{ fontSize: 12, color: c.ink as `#${string}` }} maxLines={1} />
        ) : null}
      </FlexWidget>
      <SvgWidget svg={svg} style={{ height: 84, width: 84 }} />
    </FlexWidget>
  );
}
