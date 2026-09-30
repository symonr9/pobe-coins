/**
 * Chubbybara art registry. Today every pose is the placeholder vector art from @pobe/core.
 * When the commissioned art arrives, add files under assets/chubbybara/ and point a pose
 * at them here, e.g.  happy: { kind: 'image', source: require('../../../assets/chubbybara/happy.png') }
 * Keep the art square (it's drawn in a 240×240 box) so layouts don't shift.
 */
import type { ImageSourcePropType } from 'react-native';
import { chubbybaraSvg, type ChubbyAccessory, type ChubbyPose } from '@pobe/core';

export type ChubbyArt = { kind: 'svg'; xml: string } | { kind: 'image'; source: ImageSourcePropType };

const COMMISSIONED: Partial<Record<ChubbyPose, ImageSourcePropType>> = {
  // idle: require('../../../assets/chubbybara/idle.png'),
};

export function chubbyArt(pose: ChubbyPose, accessory: ChubbyAccessory, accent: string, eyesClosed = false): ChubbyArt {
  const image = COMMISSIONED[pose];
  if (image && accessory === 'none') return { kind: 'image', source: image };
  return { kind: 'svg', xml: chubbybaraSvg({ pose, accessory, accent, eyesClosed, id: `${pose}-${accessory}` }).replace(/ (role|aria-label)="[^"]*"/g, '') };
}
