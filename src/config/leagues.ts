import type { CuratedLeagueConfig, League } from '../types/openligadb';

export const CURATED_LEAGUES: CuratedLeagueConfig[] = [
  {
    shortcut: 'bl1',
    name: '1. Fußball-Bundesliga',
    shortLabel: 'Bundesliga',
    country: 'Deutschland',
    flag: '🇩🇪',
    season: 2026,
    color: '#D20515',
    category: 'germany',
    hasTable: true,
    zones: {
      ucl: [1, 2, 3, 4],
      uel: [5],
      uecl: [6],
      relegationPlayoff: [16],
      relegation: [17, 18],
    },
  },
  {
    shortcut: 'bl2',
    name: '2. Fußball-Bundesliga',
    shortLabel: '2. Bundesliga',
    country: 'Deutschland',
    flag: '🇩🇪',
    season: 2026,
    color: '#E11D48',
    category: 'germany',
    hasTable: true,
    zones: {
      promotion: [1, 2],
      relegationPlayoff: [3, 16],
      relegation: [17, 18],
    },
  },
  {
    shortcut: 'bl3',
    name: '3. Liga',
    shortLabel: '3. Liga',
    country: 'Deutschland',
    flag: '🇩🇪',
    season: 2026,
    color: '#2563EB',
    category: 'germany',
    hasTable: true,
    zones: {
      promotion: [1, 2],
      relegationPlayoff: [3],
      relegation: [17, 18, 19, 20],
    },
  },
  {
    shortcut: 'dfb',
    name: 'DFB-Pokal',
    shortLabel: 'DFB-Pokal',
    country: 'Deutschland',
    flag: '🏆',
    season: 2026,
    color: '#16A34A',
    category: 'germany',
    hasTable: false,
  },
  {
    shortcut: 'ucl',
    name: 'UEFA Champions League',
    shortLabel: 'Champions League',
    country: 'Europa',
    flag: '⭐',
    season: 2026,
    color: '#1D4ED8',
    category: 'europe',
    hasTable: true,
    zones: {
      ucl: [1, 2, 3, 4, 5, 6, 7, 8],
      uel: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    },
  },
  {
    shortcut: 'uel2026',
    name: 'UEFA Europa League',
    shortLabel: 'Europa League',
    country: 'Europa',
    flag: '🟠',
    season: 2026,
    color: '#EA580C',
    category: 'europe',
    hasTable: true,
    zones: {
      ucl: [1, 2, 3, 4, 5, 6, 7, 8],
      uel: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    },
  },
  {
    shortcut: 'uecl2026',
    name: 'UEFA Conference League',
    shortLabel: 'Conference League',
    country: 'Europa',
    flag: '🟢',
    season: 2026,
    color: '#0D9488',
    category: 'europe',
    hasTable: true,
    zones: {
      ucl: [1, 2, 3, 4, 5, 6, 7, 8],
      uecl: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    },
  },
  {
    shortcut: 'ffb1',
    name: 'Google Pixel Frauen-Bundesliga',
    shortLabel: 'Frauen-BL',
    country: 'Deutschland',
    flag: '🇩🇪',
    season: 2026,
    color: '#9333EA',
    category: 'women',
    hasTable: true,
    zones: {
      ucl: [1, 2, 3],
      relegation: [13, 14],
    },
  },
  {
    shortcut: 'pl',
    name: 'Premier League',
    shortLabel: 'Premier League',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    season: 2026,
    color: '#6D28D9',
    category: 'international',
    hasTable: true,
    zones: {
      ucl: [1, 2, 3, 4],
      uel: [5],
      relegation: [18, 19, 20],
    },
  },
  {
    shortcut: 'öbl',
    name: 'ADMIRAL Bundesliga',
    shortLabel: 'Österr. BL',
    country: 'Österreich',
    flag: '🇦🇹',
    season: 2026,
    color: '#DC2626',
    category: 'international',
    hasTable: true,
    zones: {
      ucl: [1, 2],
      uel: [3],
      uecl: [4],
      relegation: [12],
    },
  },
  {
    shortcut: 'ERE',
    name: 'Eredivisie',
    shortLabel: 'Eredivisie',
    country: 'Niederlande',
    flag: '🇳🇱',
    season: 2026,
    color: '#F97316',
    category: 'international',
    hasTable: true,
    zones: {
      ucl: [1, 2, 3],
      uel: [4],
      relegationPlayoff: [16],
      relegation: [17, 18],
    },
  },
  {
    shortcut: 'unl',
    name: 'UEFA Nations League',
    shortLabel: 'Nations League',
    country: 'Europa',
    flag: '🌍',
    season: 2026,
    color: '#0284C7',
    category: 'international',
    hasTable: true,
  },
  {
    shortcut: 'wm2026',
    name: 'FIFA Weltmeisterschaft 2026',
    shortLabel: 'WM 2026',
    country: 'Welt',
    flag: '🏆',
    season: 2026,
    color: '#CA8A04',
    category: 'international',
    hasTable: true,
  },
  {
    shortcut: 'dfbf',
    name: 'DFB-Pokal Frauen',
    shortLabel: 'DFB-Pokal (F)',
    country: 'Deutschland',
    flag: '🇩🇪',
    season: 2026,
    color: '#A855F7',
    category: 'women',
    hasTable: false,
  },
];

export const DEFAULT_HOME_LEAGUES = ['bl1', 'bl2', 'bl3', 'dfb', 'ucl', 'uel2026', 'pl'];

export function getCuratedLeague(shortcut: string | null | undefined): CuratedLeagueConfig | undefined {
  if (!shortcut) return undefined;
  const lower = shortcut.toLowerCase();
  return CURATED_LEAGUES.find((l) => l.shortcut.toLowerCase() === lower);
}

const TEST_LEAGUE_REGEX = /\b(test|mqtt|claude|selbsteinsch|bastard|dummy|demo|sandbox|outii|outi77|agOD|skaldit|moisty)\b/i;

export function isLikelyTestLeague(league: League): boolean {
  const name = league.leagueName ?? '';
  const shortcut = league.leagueShortcut ?? '';
  if (!name.trim() || name.trim().length <= 2 || /^\?+$/.test(name.trim())) return true;
  if (shortcut.length > 20) return true;
  return TEST_LEAGUE_REGEX.test(name) || TEST_LEAGUE_REGEX.test(shortcut);
}

export function getZoneInfo(
  shortcut: string,
  rank: number
): { color: string; label: string } | null {
  const cfg = getCuratedLeague(shortcut);
  if (!cfg?.zones) return null;
  if (cfg.zones.ucl?.includes(rank)) {
    return {
      color: '#3B82F6',
      label: shortcut.startsWith('u') ? 'Achtelfinale' : 'Champions League',
    };
  }
  if (cfg.zones.promotion?.includes(rank)) {
    return { color: '#00E676', label: 'Aufstieg' };
  }
  if (cfg.zones.uel?.includes(rank)) {
    return {
      color: '#F97316',
      label: shortcut.startsWith('u') ? 'Play-offs' : 'Europa League',
    };
  }
  if (cfg.zones.uecl?.includes(rank)) {
    return {
      color: '#14B8A6',
      label: shortcut.startsWith('u') ? 'Play-offs' : 'Conference League',
    };
  }
  if (cfg.zones.relegationPlayoff?.includes(rank)) {
    return { color: '#F59E0B', label: 'Relegation' };
  }
  if (cfg.zones.relegation?.includes(rank)) {
    return { color: '#EF4444', label: 'Abstieg' };
  }
  return null;
}
