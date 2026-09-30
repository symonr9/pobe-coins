import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '@/theme';

/** Hand-drawn rounded line icons (24×24, 2px stroke). */
const PATHS: Record<string, string> = {
  home: 'M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z',
  tasks: 'M5 7.5 7 9.5l3.5-4M13 8h6M5 15.5l2 2 3.5-4M13 16h6',
  shop: 'M5 9h14l-1.2 9.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8zM9 9V7a3 3 0 0 1 6 0v2',
  timeline: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5 10 17l9-10',
  x: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2.2.2-1.3-1.3L16.7 4.7 14 4l-1 2h-2l-1-2-2.7.7.2 2.2L6.2 8.2 4 8 3 11l2 1v0l-2 1 1 3 2.2-.2 1.3 1.3-.2 2.2L10 20l1-2h2l1 2 2.7-.7-.2-2.2 1.3-1.3L20 16l1-3z',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
  star: 'M12 4l2.4 5 5.4.6-4 3.8 1.1 5.4L12 16.1 7.1 18.8l1.1-5.4-4-3.8 5.4-.6z',
  flame: 'M12 21c-3.5 0-6-2.4-6-5.8 0-3.4 3-5.2 3.5-8.7 2 1.2 3 3 3 4.5 1-1 1.5-2 1.5-3.5 2.5 2 4 4.7 4 7.7 0 3.4-2.5 5.8-6 5.8z',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  link: 'M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  heart: 'M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.8C19 14.6 12 19 12 19z',
  chat: 'M5 6h14v10H9l-4 3z',
  chart: 'M5 19V11M10 19V6M15 19v-5M20 19V9',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M16 11a2.5 2.5 0 1 0 0-5M17 14c2.3.4 4 2.1 4 4.5',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18h2v2',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  undo: 'M9 7 5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  swap: 'M7 7h11l-3-3M17 17H6l3 3',
  palette: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 21zM7.5 11h.01M10 7h.01M15 7h.01',
  edit: 'M5 19l1-4L16 5l3 3L9 18z',
  share: 'M12 4v11M8 8l4-4 4 4M5 14v5h14v-5',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, color, strokeWidth = 2, filled }: { name: IconName; size?: number; color?: string; strokeWidth?: number; filled?: boolean }) {
  const t = useTheme();
  const c = color ?? t.c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'more' ? (
        [6, 12, 18].map((x) => <Circle key={x} cx={x} cy={12} r={1.8} fill={c} />)
      ) : (
        <Path d={PATHS[name]!} stroke={c} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={filled ? c : 'none'} />
      )}
    </Svg>
  );
}
