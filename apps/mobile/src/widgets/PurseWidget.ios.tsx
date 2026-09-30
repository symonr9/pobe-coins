/**
 * iOS home-screen widget (expo-widgets + SwiftUI via @expo/ui).
 * The layout must be a `function` (not an arrow) with the 'widget' directive: the Expo babel
 * plugin turns it into a string that runs inside the widget extension, where SwiftUI
 * components and modifiers are globals. It can only use its props (no app state, no hooks).
 */
import { createWidget } from 'expo-widgets';
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';

export interface PurseWidgetProps {
  name: string;
  balance: number;
  debt: number;
  today: number;
  next: string[];
  line: string;
  bg: string;
  ink: string;
  soft: string;
}

function PurseWidgetLayout(props: PurseWidgetProps) {
  'widget';
  return (
    <VStack alignment="leading" spacing={4} modifiers={[containerBackground(props.bg, 'widget'), padding({ all: 2 })]}>
      <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle(props.soft)]}>{`${props.name}'s purse`}</Text>
      <HStack spacing={4}>
        <Text modifiers={[font({ size: 36, weight: 'heavy', design: 'rounded' }), foregroundStyle(props.ink)]}>{String(props.balance)}</Text>
        <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle(props.soft)]}>coins</Text>
      </HStack>
      {props.debt > 0 ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(props.soft)]}>{`IOU ${props.debt}`}</Text> : null}
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), foregroundStyle(props.ink)]}>
        {props.today === 0 ? 'All done today!' : `${props.today} chore${props.today === 1 ? '' : 's'} today`}
      </Text>
      {props.next.slice(0, 2).map((n) => (
        <Text key={n} modifiers={[font({ size: 12 }), foregroundStyle(props.soft)]}>{`• ${n}`}</Text>
      ))}
    </VStack>
  );
}

export const purseWidget = createWidget<PurseWidgetProps>('PurseWidget', PurseWidgetLayout);
