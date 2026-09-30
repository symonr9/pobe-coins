/**
 * App-level feedback: toasts and confirm dialogs (Alert isn't available on web, and a
 * themed dialog fits the app better anyway).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';
import { Row } from './layout';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
}

interface FeedbackValue {
  toast: (message: string, kind?: 'info' | 'error' | 'success', action?: { label: string; onPress: () => void }) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackValue>({ toast: () => undefined, confirm: async () => false });
export const useFeedback = () => useContext(Ctx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: string; action?: { label: string; onPress: () => void } }[]>(
    [],
  );
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const idRef = useRef(0);

  const toast = useCallback(
    (message: string, kind: 'info' | 'error' | 'success' = 'info', action?: { label: string; onPress: () => void }) => {
      const id = ++idRef.current;
      setToasts((l) => [...l.slice(-2), { id, message, kind, action }]);
      setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), kind === 'error' || action ? 6000 : 3000);
    },
    [],
  );

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: insets.bottom + 90 }]}
      >
        {toasts.map((x) => (
          <Animated.View
            key={x.id}
            entering={FadeInDown.springify().damping(16)}
            exiting={FadeOutDown}
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              {
                backgroundColor: x.kind === 'error' ? t.c.surface : t.c.ink,
                borderColor: x.kind === 'error' ? t.c.danger : 'transparent',
              },
            ]}
          >
            <Row gap={14} style={{ justifyContent: 'space-between' }}>
              <Text variant="bodyBold" color={x.kind === 'error' ? t.c.danger : t.c.bg} style={{ flexShrink: 1 }}>
                {x.message}
              </Text>
              {x.action ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    x.action!.onPress();
                    setToasts((l) => l.filter((y) => y.id !== x.id));
                  }}
                >
                  <Text variant="bodyBold" color={x.kind === 'error' ? t.c.accent : t.c.primary}>
                    {x.action.label}
                  </Text>
                </Pressable>
              ) : null}
            </Row>
          </Animated.View>
        ))}
      </View>
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable style={[styles.backdrop]} onPress={() => close(false)} accessibilityLabel="Close">
          <Pressable style={[styles.dialog, { backgroundColor: t.c.surface, borderColor: t.c.line }]} onPress={() => undefined}>
            <Text variant="h3">{dialog?.title}</Text>
            {dialog?.message ? <Text color="soft">{dialog.message}</Text> : null}
            <Row style={{ justifyContent: 'flex-end', marginTop: 8 }} wrap>
              <Button kind="ghost" small title={dialog?.cancel ?? 'Cancel'} onPress={() => close(false)} />
              <Button kind={dialog?.danger ? 'danger' : 'primary'} small title={dialog?.confirm ?? 'OK'} onPress={() => close(true)} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    marginTop: 8,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxWidth: 520,
    marginHorizontal: 16,
    borderWidth: 2,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,10,15,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1.5, padding: 20, gap: 10 },
});
