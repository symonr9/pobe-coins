import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from './prefs';

interface PrefsValue {
  prefs: Prefs;
  ready: boolean;
  update: (patch: Partial<Prefs>) => void;
}

const PrefsContext = createContext<PrefsValue>({ prefs: DEFAULT_PREFS, ready: false, update: () => undefined });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void loadPrefs().then((p) => {
      setPrefs(p);
      setReady(true);
    });
  }, []);
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      void savePrefs(next);
      return next;
    });
  }, []);
  return <PrefsContext.Provider value={{ prefs, ready, update }}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
