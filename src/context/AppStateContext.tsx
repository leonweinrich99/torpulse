import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CURATED_LEAGUES, DEFAULT_HOME_LEAGUES } from '../config/leagues';
import type { FavoriteTeam } from '../types/openligadb';

export type ThemeMode = 'dark' | 'light' | 'system';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DEFAULT_LEAGUE_ORDER = CURATED_LEAGUES.map((l) => l.shortcut);

function moveItem<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list;
  }
  const copy = [...list];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

interface AppStateContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: 'dark' | 'light';
  favoriteTeams: FavoriteTeam[];
  toggleFavoriteTeam: (team: FavoriteTeam) => void;
  isFavoriteTeam: (teamId: number) => boolean;
  reorderFavoriteTeams: (fromIndex: number, toIndex: number) => void;
  moveFavoriteTeam: (teamId: number, direction: 'up' | 'down') => void;
  favoriteLeagues: string[];
  toggleFavoriteLeague: (shortcut: string) => void;
  isFavoriteLeague: (shortcut: string) => boolean;
  reorderFavoriteLeagues: (fromIndex: number, toIndex: number) => void;
  moveFavoriteLeague: (shortcut: string, direction: 'up' | 'down') => void;
  leagueOrder: string[];
  reorderLeagues: (fromIndex: number, toIndex: number) => void;
  moveLeague: (shortcut: string, direction: 'up' | 'down') => void;
  resetLeagueOrder: () => void;
  pinFavoriteLeaguesFirst: boolean;
  setPinFavoriteLeaguesFirst: (val: boolean) => void;
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
  LEAGUE_ORDER: 'torpulse_league_order_v1',
  PIN_FAV_LEAGUES: 'torpulse_pin_fav_leagues_v1',
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

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function normalizeLeagueOrder(saved: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sc of saved) {
    const lower = sc.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      // Match canonical casing from curated list when available
      const canonical =
        DEFAULT_LEAGUE_ORDER.find((d) => d.toLowerCase() === lower) ?? sc;
      result.push(canonical);
    }
  }
  for (const sc of DEFAULT_LEAGUE_ORDER) {
    if (!seen.has(sc.toLowerCase())) {
      seen.add(sc.toLowerCase());
      result.push(sc);
    }
  }
  return result;
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
  const [leagueOrder, setLeagueOrder] = useState<string[]>(() =>
    normalizeLeagueOrder(readStorage<string[]>(KEYS.LEAGUE_ORDER, DEFAULT_LEAGUE_ORDER))
  );
  const [pinFavoriteLeaguesFirst, setPinFavoriteLeaguesFirstState] = useState<boolean>(() =>
    readStorage<boolean>(KEYS.PIN_FAV_LEAGUES, true)
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
      meta.setAttribute('content', resolvedTheme === 'dark' ? '#0B0D10' : '#F3F5F8');
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
    writeStorage(KEYS.THEME, next);
  }, []);

  const setRefreshIntervalSec = useCallback((sec: number) => {
    setRefreshIntervalState(sec);
    writeStorage(KEYS.REFRESH, sec);
  }, []);

  const setPinFavoriteLeaguesFirst = useCallback((val: boolean) => {
    setPinFavoriteLeaguesFirstState(val);
    writeStorage(KEYS.PIN_FAV_LEAGUES, val);
  }, []);

  const toggleFavoriteTeam = useCallback((team: FavoriteTeam) => {
    setFavoriteTeams((prev) => {
      const exists = prev.some((t) => t.teamId === team.teamId);
      const next = exists
        ? prev.filter((t) => t.teamId !== team.teamId)
        : [team, ...prev];
      writeStorage(KEYS.FAV_TEAMS, next);
      return next;
    });
  }, []);

  const reorderFavoriteTeams = useCallback((fromIndex: number, toIndex: number) => {
    setFavoriteTeams((prev) => {
      const next = moveItem(prev, fromIndex, toIndex);
      writeStorage(KEYS.FAV_TEAMS, next);
      return next;
    });
  }, []);

  const moveFavoriteTeam = useCallback((teamId: number, direction: 'up' | 'down') => {
    setFavoriteTeams((prev) => {
      const idx = prev.findIndex((t) => t.teamId === teamId);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      const next = moveItem(prev, idx, target);
      writeStorage(KEYS.FAV_TEAMS, next);
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
        : [...prev, shortcut];
      writeStorage(KEYS.FAV_LEAGUES, next);
      return next;
    });
  }, []);

  const reorderFavoriteLeagues = useCallback((fromIndex: number, toIndex: number) => {
    setFavoriteLeagues((prev) => {
      const next = moveItem(prev, fromIndex, toIndex);
      writeStorage(KEYS.FAV_LEAGUES, next);
      return next;
    });
  }, []);

  const moveFavoriteLeague = useCallback((shortcut: string, direction: 'up' | 'down') => {
    setFavoriteLeagues((prev) => {
      const idx = prev.findIndex((s) => s.toLowerCase() === shortcut.toLowerCase());
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      const next = moveItem(prev, idx, target);
      writeStorage(KEYS.FAV_LEAGUES, next);
      return next;
    });
  }, []);

  const isFavoriteLeague = useCallback(
    (shortcut: string) =>
      favoriteLeagues.some((s) => s.toLowerCase() === shortcut.toLowerCase()),
    [favoriteLeagues]
  );

  const reorderLeagues = useCallback((fromIndex: number, toIndex: number) => {
    setLeagueOrder((prev) => {
      const next = moveItem(prev, fromIndex, toIndex);
      writeStorage(KEYS.LEAGUE_ORDER, next);
      return next;
    });
  }, []);

  const moveLeague = useCallback((shortcut: string, direction: 'up' | 'down') => {
    setLeagueOrder((prev) => {
      const idx = prev.findIndex((s) => s.toLowerCase() === shortcut.toLowerCase());
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      const next = moveItem(prev, idx, target);
      writeStorage(KEYS.LEAGUE_ORDER, next);
      return next;
    });
  }, []);

  const resetLeagueOrder = useCallback(() => {
    setLeagueOrder(DEFAULT_LEAGUE_ORDER);
    writeStorage(KEYS.LEAGUE_ORDER, DEFAULT_LEAGUE_ORDER);
  }, []);

  const toggleHomeLeague = useCallback((shortcut: string) => {
    setHomeLeagues((prev) => {
      const lower = shortcut.toLowerCase();
      const exists = prev.some((s) => s.toLowerCase() === lower);
      const next = exists
        ? prev.length > 1
          ? prev.filter((s) => s.toLowerCase() !== lower)
          : prev
        : [...prev, shortcut];
      writeStorage(KEYS.HOME_LEAGUES, next);
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
        reorderFavoriteTeams,
        moveFavoriteTeam,
        favoriteLeagues,
        toggleFavoriteLeague,
        isFavoriteLeague,
        reorderFavoriteLeagues,
        moveFavoriteLeague,
        leagueOrder,
        reorderLeagues,
        moveLeague,
        resetLeagueOrder,
        pinFavoriteLeaguesFirst,
        setPinFavoriteLeaguesFirst,
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
