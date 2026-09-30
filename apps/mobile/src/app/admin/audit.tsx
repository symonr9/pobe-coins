import { useAudit } from '@/api/hooks';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { Header, Loading } from '@/ui/bits';
import { Card, Screen } from '@/ui/layout';
import { Text } from '@/ui/Text';

const ACTIONS: Record<string, string> = {
  'household.update': 'Changed household settings',
  'household.coinTypes': 'Changed coin types',
  'member.add': 'Added a member',
  'member.role': 'Changed a role',
  'member.remove': 'Removed a member',
  'deviceLink.create': 'Created a join link',
  'device.revoke': 'Signed out a device',
  'shop.create': 'Added a reward',
  'shop.delete': 'Deleted a reward',
  'challenge.create': 'Started a challenge',
  bonus: 'Gave a bonus',
  correction: 'Corrected a balance',
};

export default function Audit() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const q = useAudit();
  return (
    <Screen>
      <Header title={t('Activity log')} />
      {q.isLoading ? <Loading /> : null}
      <Card style={{ gap: 12 }}>
        {q.data?.length === 0 ? <Text color="soft">{t('Nothing yet.')}</Text> : null}
        {q.data?.map((a) => (
          <Text key={a.id}>
            <Text variant="bodyBold">{hh.name(a.actorId)}</Text> {t(ACTIONS[a.action] ?? a.action)}
            {a.target && hh.members.some((m) => m.id === a.target) ? ` · ${hh.name(a.target)}` : ''}
            {a.details && 'reason' in a.details ? ` · “${String(a.details.reason)}”` : ''}
            {a.details && 'delta' in a.details ? ` (${Number(a.details.delta) > 0 ? '+' : ''}${String(a.details.delta)})` : ''}
            {a.details && 'amount' in a.details ? ` (+${String(a.details.amount)})` : ''}
            <Text variant="small" color="soft">{`\n${new Date(a.createdAt).toLocaleString()}`}</Text>
          </Text>
        ))}
      </Card>
    </Screen>
  );
}
