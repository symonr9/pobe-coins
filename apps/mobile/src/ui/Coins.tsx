import { memo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { balance, coinSvg, purseEntries, type Purse } from '@pobe/core';
import { useTheme } from '@/theme';
import { Row } from './layout';
import { Text } from './Text';

/** SVG strings from @pobe/core carry web a11y attributes; natively we label the wrapper instead. */
export const forSvgXml = (xml: string) => xml.replace(/ (role|aria-label)="[^"]*"/g, '');

export const Coin = memo(function Coin({ denom, size = 32 }: { denom: number; size?: number }) {
  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <SvgXml xml={forSvgXml(coinSvg(denom, size))} width={size} height={size} />
    </View>
  );
});

/** "+30" with a coin. */
export function CoinAmount({
  amount,
  size = 20,
  sign,
  variant = 'number',
}: {
  amount: number;
  size?: number;
  sign?: boolean;
  variant?: 'number' | 'title' | 'h2';
}) {
  const t = useTheme();
  const color = sign ? (amount >= 0 ? t.c.success : t.c.danger) : t.c.ink;
  return (
    <Row gap={4}>
      <Coin denom={25} size={size} />
      <Text variant={variant} color={color} style={{ fontVariant: ['tabular-nums'] }}>
        {sign && amount > 0 ? '+' : ''}
        {amount}
      </Text>
    </Row>
  );
}

/** Coins by denomination: a little stack per coin type with its count. */
export function PurseView({
  purse,
  coinTypes,
  size = 36,
  compact,
}: {
  purse: Purse;
  coinTypes: number[];
  size?: number;
  compact?: boolean;
}) {
  const entries = purseEntries(purse, coinTypes).filter((e) => !compact || e.count > 0);
  const step = Math.round(size * 0.16);
  return (
    <Row gap={compact ? 8 : 10} wrap accessibilityLabel={`Purse: ${entries.map((e) => `${e.count} of ${e.denom}`).join(', ')}`}>
      {entries.map((e) => {
        const layers = Math.max(1, Math.min(e.count, 3));
        return (
          <View key={e.denom} style={{ alignItems: 'center', gap: 2, opacity: e.count ? 1 : 0.35 }}>
            <View style={{ width: size, height: size + (layers - 1) * step }}>
              {Array.from({ length: layers }).map((_, i) => (
                <View key={i} style={{ position: 'absolute', left: 0, top: (layers - 1 - i) * step }}>
                  <Coin denom={e.denom} size={size} />
                </View>
              ))}
            </View>
            <Text variant="smallBold" color="soft">
              ×{e.count}
            </Text>
          </View>
        );
      })}
    </Row>
  );
}

export function purseTotal(purse: Purse) {
  return balance(purse);
}
