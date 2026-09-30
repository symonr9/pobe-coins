import { useState } from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { actions, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { AmountPicker } from '@/features/AmountPicker';
import { useCelebrate } from '@/features/celebrate';
import { Button } from '@/ui/Button';
import { Chip, Field } from '@/ui/Field';
import { Header } from '@/ui/bits';
import { Card, Row, Screen } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { say } from '@/features/chubby/say';

export default function Gift() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const others = hh.members.filter((m) => m.id !== hh.me?.id);
  const [to, setTo] = useState<string | undefined>(others[0]?.id);
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => actions.gift({ toMemberId: to!, amount, message: message.trim() || undefined }),
    onSuccess: () => {
      void refresh();
      celebrate({ pose: 'happy', title: t('Gift sent!'), line: say('giftSent', { vars: { partner: hh.name(to), coins: amount } }).text });
      router.back();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('Couldn\'t send the gift.')),
  });
  return (
    <Screen footer={<Button full icon="gift" title={t('Send {{n}} coins', { n: amount })} disabled={!to || !amount || amount > hh.balance} loading={send.isPending} onPress={() => send.mutate()} />}>
      <Header title={t('Send a gift')} />
      {others.length === 0 ? (
        <Text color="soft">{t('Add someone to your household first.')}</Text>
      ) : (
        <Card style={{ gap: 14 }}>
          <Text variant="smallBold" color="soft">
            {t('To')}
          </Text>
          <Row wrap gap={8}>
            {others.map((m) => (
              <Chip key={m.id} label={m.name} color={m.color} selected={to === m.id} onPress={() => setTo(m.id)} />
            ))}
          </Row>
          <AmountPicker label={t('How many coins? (you have {{n}})', { n: hh.balance })} value={amount} onChange={setAmount} coinTypes={hh.settings.coinTypes} />
          <Field label={t('Message (optional)')} value={message} onChangeText={setMessage} placeholder={t('Thanks for dinner!')} maxLength={200} />
        </Card>
      )}
      {error ? <Text color="danger">{error}</Text> : null}
    </Screen>
  );
}
