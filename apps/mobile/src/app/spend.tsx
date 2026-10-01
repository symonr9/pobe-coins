import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { actions } from '@/api/hooks';
import type { LinkPreview } from '@/api/types';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { AmountPicker } from '@/features/AmountPicker';
import { describeCoins, previewPayment, useSpend } from '@/features/spending';
import { pickPhoto, uploadPhoto } from '@/features/photos';
import { Chubby } from '@/features/chubby/Chubby';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Header } from '@/ui/bits';
import { Card, Row, Screen, Section } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { useFeedback } from '@/ui/Feedback';

export default function Spend() {
  const params = useLocalSearchParams<{ url?: string; title?: string; image?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const spend = useSpend();
  const { toast } = useFeedback();
  const [title, setTitle] = useState(params.title ?? '');
  const [amount, setAmount] = useState(0);
  const [url, setUrl] = useState(params.url ?? '');
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<{ uri: string; key?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const loadPreview = async (u: string) => {
    if (!/^https?:\/\//i.test(u.trim())) return;
    setPreviewing(true);
    try {
      const p = await actions.linkPreview(u.trim());
      setPreview(p);
      if (!title.trim() && p.title) setTitle(p.title.slice(0, 120));
    } catch {
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };
  useEffect(() => {
    if (params.url) void loadPreview(params.url);
    if (params.image) void addPhoto(params.image);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPhoto = async (uri: string | null) => {
    if (!uri) return;
    setPhotos((p) => [...p, { uri }]);
    try {
      const key = await uploadPhoto(uri, 'purchase');
      setPhotos((p) => p.map((x) => (x.uri === uri ? { ...x, key } : x)));
    } catch (e) {
      setPhotos((p) => p.filter((x) => x.uri !== uri));
      toast(e instanceof Error ? e.message : t("The photo didn't upload."), 'error');
    }
  };

  const me = hh.me;
  const change = me ? previewPayment(me.purse, me.debt, amount, hh.settings.coinTypes, hh.settings.debtLimit) : null;
  const threshold = hh.settings.purchaseApprovalThreshold;
  const needsApproval = threshold !== null && amount > threshold && hh.members.length > 1;
  const uploading = photos.some((p) => !p.key);

  const submit = async () => {
    setBusy(true);
    const r = await spend(title.trim(), amount, (allowIou) =>
      actions.createPurchase({
        title: title.trim(),
        amount,
        url: url.trim() || undefined,
        description: description.trim() || undefined,
        photoKeys: photos.flatMap((p) => (p.key ? [p.key] : [])),
        allowIou,
      }),
    );
    setBusy(false);
    if (r) router.back();
  };

  return (
    <Screen
      footer={
        <Button
          full
          icon="shop"
          title={amount ? t('Spend {{n}} coins', { n: amount }) : t('Spend')}
          disabled={!title.trim() || !amount || uploading || change?.kind === 'short'}
          loading={busy}
          onPress={submit}
        />
      }
    >
      <Header title={t('Log a purchase')} />
      <Row style={{ alignItems: 'center' }}>
        <Chubby pose="shopkeeper" size={70} animate={false} />
        <Text color="soft" style={{ flex: 1 }}>
          {t('What did you get? Add the link or a photo so we remember what the coins paid for.')}
        </Text>
      </Row>
      <Card style={{ gap: 14 }}>
        <Field label={t('What is it?')} value={title} onChangeText={setTitle} placeholder={t('Cozy blanket')} maxLength={120} />
        <AmountPicker label={t('Cost in coins')} value={amount} onChange={setAmount} coinTypes={hh.settings.coinTypes} />
        {change ? (
          <View style={{ backgroundColor: theme.c.surfaceAlt, borderRadius: 16, padding: 12, gap: 4 }} accessibilityLiveRegion="polite">
            {change.kind === 'exact' ? (
              <Text variant="smallBold">{t('You hand over {{coins}}. Exact, no change.', { coins: describeCoins(change.out) })}</Text>
            ) : null}
            {change.kind === 'change' ? (
              <Text variant="smallBold">
                {t('You hand over {{out}} and get {{back}} back.', { out: describeCoins(change.out), back: describeCoins(change.back) })}
              </Text>
            ) : null}
            {change.kind === 'iou' ? (
              <Text variant="smallBold" color="warning">
                {t('You have {{have}}. {{n}} would go on an IOU.', { have: hh.balance, n: change.borrow })}
              </Text>
            ) : null}
            {change.kind === 'short' ? (
              <Text variant="smallBold" color="danger">
                {t('You need {{n}} more coins for this.', { n: change.borrow })}
              </Text>
            ) : null}
            {needsApproval ? (
              <Text variant="small" color="soft">
                {t('Over {{n}} coins, so someone else approves it first.', { n: threshold })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>
      <Section title={t('Link (optional)')}>
        <Card style={{ gap: 12 }}>
          <Field
            label={t('Where from?')}
            value={url}
            onChangeText={setUrl}
            onBlur={() => loadPreview(url)}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
            hint={previewing ? t('Getting the preview…') : undefined}
          />
          {preview ? (
            <Row style={{ alignItems: 'flex-start' }}>
              {preview.image ? (
                <Image source={{ uri: preview.image }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />
              ) : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="smallBold" numberOfLines={2}>
                  {preview.title ?? preview.url}
                </Text>
                <Text variant="small" color="soft" numberOfLines={1}>
                  {preview.siteName}
                </Text>
              </View>
            </Row>
          ) : null}
        </Card>
      </Section>
      <Section title={t('Photos (optional)')}>
        <Card style={{ gap: 12 }}>
          {photos.length ? (
            <Row wrap gap={8}>
              {photos.map((p) => (
                <View key={p.uri}>
                  <Image source={{ uri: p.uri }} style={{ width: 76, height: 76, borderRadius: 14, opacity: p.key ? 1 : 0.5 }} />
                </View>
              ))}
            </Row>
          ) : null}
          <Row wrap>
            <Button
              small
              kind="soft"
              icon="camera"
              title={t('Take photo')}
              onPress={async () => addPhoto(await pickPhoto('camera'))}
              disabled={photos.length >= 6}
            />
            <Button
              small
              kind="soft"
              title={t('Choose photo')}
              onPress={async () => addPhoto(await pickPhoto('library'))}
              disabled={photos.length >= 6}
            />
          </Row>
          <Field
            label={t('Notes')}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
            placeholder={t('Why it was worth it…')}
          />
        </Card>
      </Section>
    </Screen>
  );
}
