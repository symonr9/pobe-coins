/** Haptics and sounds, respecting the user's preferences. */
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { loadPrefs, type Prefs } from './prefs';

let prefs: Pick<Prefs, 'sounds' | 'haptics'> = { sounds: true, haptics: true };
void loadPrefs().then((p) => (prefs = p));
export function setFeedbackPrefs(p: Pick<Prefs, 'sounds' | 'haptics'>) {
  prefs = p;
}

const canHaptic = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  tap: () => canHaptic && prefs.haptics && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  select: () => canHaptic && prefs.haptics && void Haptics.selectionAsync().catch(() => undefined),
  success: () => canHaptic && prefs.haptics && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warn: () => canHaptic && prefs.haptics && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
  heavy: () => canHaptic && prefs.haptics && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined),
};

let coinPlayer: AudioPlayer | null = null;
export function playCoin() {
  if (!prefs.sounds) return;
  try {
    coinPlayer ??= createAudioPlayer(require('../../assets/sounds/coin.wav'));
    void coinPlayer.seekTo(0);
    coinPlayer.play();
  } catch {
    // Audio can be unavailable (e.g. web before a user gesture); that's fine.
  }
}
