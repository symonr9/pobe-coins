import { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { actions, useRefreshAll, useSocial } from '@/api/hooks';
import { useTranslation } from '@/i18n';
import { useHousehold } from './useHousehold';
import { REACTIONS } from './timeline/EntryRow';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Avatar } from '@/ui/bits';
import { Card, Row, Section, Stack } from '@/ui/layout';
import { Pressy } from '@/ui/Pressy';
import { Text } from '@/ui/Text';
import { useTheme } from '@/theme';

/** Reactions and comments for a timeline item (keyed by its ledger entry id). */
export function Comments({ itemId, ownerId }: { itemId: string; ownerId?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const social = useSocial(itemId);
  const refresh = useRefreshAll();
  const [text, setText] = useState('');
  const comment = useMutation({ mutationFn: actions.comment, onSuccess: () => setText(''), onSettled: () => refresh() });
  const react = useMutation({ mutationFn: actions.react, onSettled: () => refresh() });
  const remove = useMutation({ mutationFn: actions.deleteComment, onSettled: () => refresh() });
  const mine = social.data?.reactions.find((r) => r.memberId === hh.me?.id);
  return (
    <Section title={t('Reactions & comments')}>
      <Card style={{ gap: 12 }}>
        <Row gap={8} wrap>
          {REACTIONS.map((emoji) => {
            const n = social.data?.reactions.filter((r) => r.emoji === emoji).length ?? 0;
            const on = mine?.emoji === emoji;
            return (
              <Pressy
                key={emoji}
                onPress={() => react.mutate({ itemId, emoji: on ? null : emoji })}
                style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? theme.c.primary : theme.c.surfaceAlt }}
                accessibilityState={{ selected: on }}
              >
                <Text>{emoji}</Text>
                {n ? <Text variant="smallBold">{n}</Text> : null}
              </Pressy>
            );
          })}
        </Row>
        <Stack gap={10}>
          {social.data?.comments.map((c) => (
            <Row key={c.id} style={{ alignItems: 'flex-start' }}>
              <Avatar name={hh.name(c.memberId)} color={hh.color(c.memberId)} size={28} />
              <View style={{ flex: 1 }}>
                <Text variant="smallBold">{hh.name(c.memberId)}</Text>
                <Text>{c.text}</Text>
              </View>
              {c.memberId === hh.me?.id || hh.isAdmin ? (
                <Button small kind="ghost" title="✕" accessibilityLabel={t('Delete comment')} onPress={() => remove.mutate({ itemId, id: c.id })} />
              ) : null}
            </Row>
          ))}
        </Stack>
        <Field
          label={t('Say something nice')}
          value={text}
          onChangeText={setText}
          maxLength={500}
          onSubmitEditing={() => text.trim() && comment.mutate({ itemId, text: text.trim(), ownerId })}
          right={<Button small title={t('Send')} disabled={!text.trim()} loading={comment.isPending} onPress={() => comment.mutate({ itemId, text: text.trim(), ownerId })} />}
        />
      </Card>
    </Section>
  );
}
