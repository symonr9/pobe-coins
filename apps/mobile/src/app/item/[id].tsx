import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from '@/i18n';
import { Comments } from '@/features/Comments';
import { Header } from '@/ui/bits';
import { Screen } from '@/ui/layout';

/** Comments/reactions for a timeline entry that isn't a purchase. */
export default function Item() {
  const { id, owner, label } = useLocalSearchParams<{ id: string; owner?: string; label?: string }>();
  const { t } = useTranslation();
  return (
    <Screen>
      <Header title={label ?? t('Moment')} />
      <Comments itemId={id} ownerId={owner} />
    </Screen>
  );
}
