/**
 * iOS home-screen widget (expo-widgets + SwiftUI via @expo/ui).
 * The layout function runs in the widget extension, so it may only use the SwiftUI
 * components and the props passed in (no app state, no hooks).
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

const PurseWidgetLayout = (props: PurseWidgetProps) => {
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
};

export const purseWidget = createWidget<PurseWidgetProps>('PurseWidget', PurseWidgetLayout);
