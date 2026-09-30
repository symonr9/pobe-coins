import { useState } from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { actions, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { AmountPicker } from '@/features/AmountPicker';
import { Button } from '@/ui/Button';
import { Field, Segmented } from '@/ui/Field';
import { Header } from '@/ui/bits';
import { Card, Screen } from '@/ui/layout';
import { Text } from '@/ui/Text';

export default function NewGoal() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const refresh = useRefreshAll();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(100);
  const [kind, setKind] = useState<'personal' | 'shared'>('personal');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => actions.createGoal({ title: title.trim(), target, shared: kind === 'shared', url: url.trim() || undefined }),
    onSuccess: () => {
      void refresh();
      router.back();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('Couldn\'t save.')),
  });
  return (
    <Screen footer={<Button full icon="target" title={t('Add to wishlist')} disabled={!title.trim() || !target} loading={save.isPending} onPress={() => save.mutate()} />}>
      <Header title={t('New wish')} />
      <Card style={{ gap: 14 }}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'personal', label: t('Just me') },
            { value: 'shared', label: t('Together') },
          ]}
        />
        <Text color="soft">
          {kind === 'personal'
            ? t('Your purse is the progress bar. Buy it whenever you have enough.')
            : t('Everyone can chip in coins. When the jar is full, anyone can buy it for the household.')}
        </Text>
        <Field label={t('What are you saving for?')} value={title} onChangeText={setTitle} placeholder={t('Picnic basket')} maxLength={120} />
        <AmountPicker label={t('Goal')} value={target} onChange={setTarget} coinTypes={hh.settings.coinTypes} />
        <Field label={t('Link (optional)')} value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" />
      </Card>
      {error ? <Text color="danger">{error}</Text> : null}
    </Screen>
  );
}
