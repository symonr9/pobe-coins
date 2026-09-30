import { router } from 'expo-router';
import { useTranslation } from '@/i18n';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/bits';
import { Screen } from '@/ui/layout';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState pose="thinking" line={t("Hmm, I can't find that page.")} />
      <Button title={t('Go home')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
