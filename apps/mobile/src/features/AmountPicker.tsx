import { TextInput, View } from 'react-native';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { haptic } from '@/lib/feedback';
import { Coin } from '@/ui/Coins';
import { Pressy } from '@/ui/Pressy';
import { Row } from '@/ui/layout';
import { Text } from '@/ui/Text';

/** Big number + tap-a-coin-to-add buttons (like dropping coins in a jar). */
export function AmountPicker({
  value,
  onChange,
  coinTypes,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  coinTypes: number[];
  label: string;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View style={{ gap: 10 }}>
      <Text variant="smallBold" color="soft">
        {label}
      </Text>
      <Row style={{ justifyContent: 'center' }} gap={8}>
        <Coin denom={25} size={34} />
        <TextInput
          value={value ? String(value) : ''}
          onChangeText={(s) => onChange(Math.min(1_000_000, Number(s.replace(/[^0-9]/g, '')) || 0))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={t.c.inkSoft}
          accessibilityLabel={label}
          style={{ fontFamily: t.fonts.displayHeavy, fontSize: 44, color: t.c.ink, minWidth: 90, textAlign: 'center', padding: 0 }}
        />
        {value ? (
          <Pressy onPress={() => onChange(0)} accessibilityLabel={tr('Clear')} style={{ padding: 6 }}>
            <Text variant="smallBold" color="accent">
              {tr('Clear')}
            </Text>
          </Pressy>
        ) : null}
      </Row>
      <Row gap={8} wrap style={{ justifyContent: 'center' }}>
        {[...coinTypes]
          .sort((a, b) => a - b)
          .map((d) => (
            <Pressy
              key={d}
              accessibilityLabel={tr('Add {{n}}', { n: d })}
              noHaptic
              onPress={() => {
                haptic.select();
                onChange(Math.min(1_000_000, value + d));
              }}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <Coin denom={d} size={42} />
              <Text variant="smallBold" color="soft">
                +{d}
              </Text>
            </Pressy>
          ))}
      </Row>
    </View>
  );
}
