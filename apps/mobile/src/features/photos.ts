/**
 * Photos: pick (camera/library) → shrink on the device (max 1600px JPEG) → upload with a
 * presigned POST → return the storage key to attach to a purchase/chore/goal.
 */
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { post } from '@/api/client';

export type PhotoPurpose = 'purchase' | 'completion' | 'goal' | 'avatar';

export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: false };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  return r.canceled ? null : (r.assets[0]?.uri ?? null);
}

export async function shrink(uri: string): Promise<string> {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: 1600 });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri; // fall back to the original if resizing isn't available
  }
}

export async function uploadPhoto(uri: string, purpose: PhotoPurpose): Promise<string> {
  const small = await shrink(uri);
  const blob = await (await fetch(small)).blob();
  const bytes = Math.max(1, blob.size || 500_000);
  const target = await post<{ key: string; url: string; fields: Record<string, string> }>('/uploads', { contentType: 'image/jpeg', bytes, purpose });
  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  if (Platform.OS === 'web') form.append('file', blob, 'photo.jpg');
  else form.append('file', { uri: small, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok && res.status !== 204) throw new Error('The photo didn\'t upload. Please try again.');
  return target.key;
}
