/**
 * Privacy policy and terms. DRAFTS for the owner to review with the actual operator name,
 * contact email and jurisdiction before publishing to the app stores.
 */
import { useTranslation } from '@/i18n';
import { Header } from '@/ui/bits';
import { Card, Screen, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';

const UPDATED = 'October 2026';

const PRIVACY: [string, string][] = [
  ['What Pobe Coins is', 'Pobe Coins is a household app for tracking chores and a play currency called coins. Coins have no cash value and can never be bought, sold or exchanged for money.'],
  ['What we store', 'Your household name, member names, chores, coin history, purchases you log (titles, notes, links and photos you add), reactions and comments, and the devices you sign in on. If you sign in with Apple or Google we receive an account identifier and, if you allow it, your name and email.'],
  ['What we don\'t do', 'We don\'t sell your data, show ads, or share your household\'s content with anyone outside your household. Link previews are fetched by our server so your device doesn\'t contact the linked site until you open it.'],
  ['Who can see what', 'Members of your household can see what your household settings allow: either everything, or only balances. Admins can see an activity log of admin actions.'],
  ['Crash reports and analytics', 'If enabled in this build, we collect crash reports and anonymous usage events (like "chore completed") without names, chore titles or purchase details. You can turn analytics off in Settings.'],
  ['Where data lives', 'Data is stored with Amazon Web Services in the United States, encrypted in transit and at rest. Photos are private and only reachable through short-lived links.'],
  ['Your choices', 'You can export all household data (Admin → Export), delete your account (Settings → Delete my account), or delete the whole household (Admin). Deleting removes the data from our systems; backups expire within 35 days.'],
  ['Children', 'Pobe Coins isn\'t directed at children under 13, and household admins are responsible for who they invite.'],
  ['Contact', 'Questions? Contact the app operator at the email listed in the app store listing.'],
];

const TERMS: [string, string][] = [
  ['Using Pobe Coins', 'Pobe Coins is provided for personal, household use. Be kind to the people in your household.'],
  ['Coins are pretend', 'Coins are a game inside your household. They have no monetary value, can\'t be purchased, and aren\'t redeemable for money or goods from us.'],
  ['Your content', 'You own what you add (chores, notes, photos). You give us permission to store and show it to your household so the app works.'],
  ['Acceptable use', 'Don\'t use Pobe Coins to harass anyone, to store illegal content, or to try to break or overload the service.'],
  ['Availability', 'We work to keep Pobe Coins running but can\'t promise it will always be available. We may change or end features with notice where practical.'],
  ['Liability', 'Pobe Coins is provided "as is". To the extent the law allows, we aren\'t liable for indirect losses from using it.'],
  ['Changes', 'If these terms change in a meaningful way, we\'ll let you know in the app.'],
];

export function Legal({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t } = useTranslation();
  const sections = doc === 'privacy' ? PRIVACY : TERMS;
  return (
    <Screen>
      <Header title={doc === 'privacy' ? t('Privacy policy') : t('Terms of use')} />
      <Text variant="small" color="soft">
        {t('Last updated {{date}}', { date: UPDATED })}
      </Text>
      <Card>
        <Stack gap={16}>
          {sections.map(([title, body]) => (
            <Stack key={title} gap={4}>
              <Text variant="title">{t(title)}</Text>
              <Text>{t(body)}</Text>
            </Stack>
          ))}
        </Stack>
      </Card>
    </Screen>
  );
}
