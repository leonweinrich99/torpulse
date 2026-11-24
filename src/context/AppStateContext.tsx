import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DEFAULT_HOME_LEAGUES } from '../config/leagues';
import type { FavoriteTeam } from '../types/openligadb';

export type ThemeMode = 'dark' | 'light' | 'system';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface AppStateContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: 'dark' | 'light';
  favoriteTeams: FavoriteTeam[];
  toggleFavoriteTeam: (team: FavoriteTeam) => void;
  isFavoriteTeam: (teamId: number) => boolean;
  favoriteLeagues: string[];
  toggleFavoriteLeague: (shortcut: string) => void;
  isFavoriteLeague: (shortcut: string) => boolean;
  homeLeagues: string[];
  toggleHomeLeague: (shortcut: string) => void;
  refreshIntervalSec: number;
  setRefreshIntervalSec: (sec: number) => void;
  canInstallPwa: boolean;
  isInstalledPwa: boolean;
  installPwa: () => Promise<boolean>;
  isOnline: boolean;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const KEYS = {
  THEME: 'torpulse_theme_v1',
  FAV_TEAMS: 'torpulse_fav_teams_v1',
  FAV_LEAGUES: 'torpulse_fav_leagues_v1',
  HOME_LEAGUES: 'torpulse_home_leagues_v1',
  REFRESH: 'torpulse_refresh_sec_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    readStorage<ThemeMode>(KEYS.THEME, 'dark')
  );
  const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>(() =>
    readStorage<FavoriteTeam[]>(KEYS.FAV_TEAMS, [])
  );
  const [favoriteLeagues, setFavoriteLeagues] = useState<string[]>(() =>
    readStorage<string[]>(KEYS.FAV_LEAGUES, ['bl1', 'bl2', 'dfb', 'ucl'])
  );
  const [homeLeagues, setHomeLeagues] = useState<string[]>(() =>
    readStorage<string[]>(KEYS.HOME_LEAGUES, DEFAULT_HOME_LEAGUES)
  );
  const [refreshIntervalSec, setRefreshIntervalState] = useState<number>(() =>
    readStorage<number>(KEYS.REFRESH, 30)
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  });
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  const resolvedTheme: 'dark' | 'light' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolvedTheme === 'dark' ? '#0B0D10' : '#FFFFFF');
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalledPwa(true);
      setDeferredPrompt(null);
    };
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      localStorage.setItem(KEYS.THEME, JSON.stringify(next));
    } catch {}
  }, []);

  const setRefreshIntervalSec = useCallback((sec: number) => {
    setRefreshIntervalState(sec);
    try {
      localStorage.setItem(KEYS.REFRESH, JSON.stringify(sec));
    } catch {}
  }, []);

  const toggleFavoriteTeam = useCallback((team: FavoriteTeam) => {
    setFavoriteTeams((prev) => {
      const exists = prev.some((t) => t.teamId === team.teamId);
      const next = exists
        ? prev.filter((t) => t.teamId !== team.teamId)
        : [team, ...prev];
      try {
        localStorage.setItem(KEYS.FAV_TEAMS, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isFavoriteTeam = useCallback(
    (teamId: number) => favoriteTeams.some((t) => t.teamId === teamId),
    [favoriteTeams]
  );

  const toggleFavoriteLeague = useCallback((shortcut: string) => {
    setFavoriteLeagues((prev) => {
      const lower = shortcut.toLowerCase();
      const exists = prev.some((s) => s.toLowerCase() === lower);
      const next = exists
        ? prev.filter((s) => s.toLowerCase() !== lower)
        : [shortcut, ...prev];
      try {
        localStorage.setItem(KEYS.FAV_LEAGUES, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isFavoriteLeague = useCallback(
    (shortcut: string) =>
      favoriteLeagues.some((s) => s.toLowerCase() === shortcut.toLowerCase()),
    [favoriteLeagues]
  );

  const toggleHomeLeague = useCallback((shortcut: string) => {
    setHomeLeagues((prev) => {
      const lower = shortcut.toLowerCase();
      const exists = prev.some((s) => s.toLowerCase() === lower);
      const next = exists
        ? prev.length > 1
          ? prev.filter((s) => s.toLowerCase() !== lower)
          : prev
        : [...prev, shortcut];
      try {
        localStorage.setItem(KEYS.HOME_LEAGUES, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const installPwa = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  }, [deferredPrompt]);

  return (
    <AppStateContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        favoriteTeams,
        toggleFavoriteTeam,
        isFavoriteTeam,
        favoriteLeagues,
        toggleFavoriteLeague,
        isFavoriteLeague,
        homeLeagues,
        toggleHomeLeague,
        refreshIntervalSec,
        setRefreshIntervalSec,
        canInstallPwa: deferredPrompt !== null,
        isInstalledPwa,
        installPwa,
        isOnline,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
