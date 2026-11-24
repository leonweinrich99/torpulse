import type {
  BlTableTeam,
  GlobalResultInfo,
  GoalGetter,
  Group,
  League,
  Match,
  ResultInfo,
  Sport,
  Team,
} from '../types/openligadb';

const BASE_URL = 'https://api.openligadb.de';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const requestTimestamps: number[] = [];

const STORAGE_PREFIX = 'torpulse_api_cache_v1_';

export const TTL = {
  LIVE: 20 * 1000, // 20s for live/current matchday data
  SHORT: 2 * 60 * 1000, // 2 min for matchdays, tables, goalgetters
  MEDIUM: 10 * 60 * 1000, // 10 min for full season matches, H2H, team schedules
  LONG: 60 * 60 * 1000, // 1h for leagues list, groups, teams, sports, result types
} as const;

function trackRequest() {
  const now = Date.now();
  requestTimestamps.push(now);
  // Keep rolling 60s window
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }
}

export function getApiTelemetry() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }
  return {
    requestsLastMinute: requestTimestamps.length,
    rateLimitPerMinute: 60,
    memoryCacheEntries: memoryCache.size,
  };
}

export function clearApiCache() {
  memoryCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

function readPersistentCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writePersistentCache<T>(key: string, entry: CacheEntry<T>) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or private mode — fail silently
  }
}

async function apiFetch<T>(
  path: string,
  options: { ttl?: number; persist?: boolean; forceRefresh?: boolean } = {}
): Promise<T> {
  const { ttl = TTL.SHORT, persist = false, forceRefresh = false } = options;
  const cacheKey = path;
  const now = Date.now();

  if (!forceRefresh) {
    const mem = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
    if (mem && now - mem.timestamp < mem.ttl) {
      return mem.data;
    }

    if (persist) {
      const stored = readPersistentCache<T>(cacheKey);
      if (stored && now - stored.timestamp < stored.ttl) {
        memoryCache.set(cacheKey, stored);
        return stored.data;
      }
    }
  }

  const existing = inFlight.get(cacheKey) as Promise<T> | undefined;
  if (existing && !forceRefresh) {
    return existing;
  }

  const promise = (async () => {
    trackRequest();
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`OpenLigaDB HTTP ${response.status} für ${path}`);
      }
      const text = await response.text();
      if (!text || text.trim() === '') {
        return ([] as unknown) as T;
      }
      const data = JSON.parse(text) as T;
      const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
      memoryCache.set(cacheKey, entry);
      if (persist) {
        writePersistentCache(cacheKey, entry);
      }
      return data;
    } catch (err) {
      // Offline / network error fallback: return stale cached data if available
      const staleMem = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
      if (staleMem) return staleMem.data;
      const staleStored = readPersistentCache<T>(cacheKey);
      if (staleStored) return staleStored.data;
      throw err;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

function enc(val: string | number): string {
  return encodeURIComponent(String(val));
}

/**
 * Full OpenLigaDB REST API Client (100% endpoint coverage)
 * Docs: https://api.openligadb.de/index.html
 */
export const openLigaApi = {
  // 1. Leagues & Sports
  getAvailableLeagues(forceRefresh = false): Promise<League[]> {
    return apiFetch<League[]>('/getavailableleagues', {
      ttl: TTL.LONG,
      persist: true,
      forceRefresh,
    });
  },

  getAvailableLeaguesBySeason(season: number | string, forceRefresh = false): Promise<League[]> {
    return apiFetch<League[]>(`/getavailableleagues/${enc(season)}`, {
      ttl: TTL.LONG,
      persist: true,
      forceRefresh,
    });
  },

  getAvailableSports(forceRefresh = false): Promise<Sport[]> {
    return apiFetch<Sport[]>('/getavailablesports', {
      ttl: TTL.LONG,
      persist: true,
      forceRefresh,
    });
  },

  // 2. Match Data
  getMatchById(matchId: number, forceRefresh = false): Promise<Match> {
    return apiFetch<Match>(`/getmatchdata/${enc(matchId)}`, {
      ttl: TTL.LIVE,
      forceRefresh,
    });
  },

  getCurrentMatchdayMatches(leagueShortcut: string, forceRefresh = false): Promise<Match[]> {
    return apiFetch<Match[]>(`/getmatchdata/${enc(leagueShortcut)}`, {
      ttl: TTL.LIVE,
      forceRefresh,
    });
  },

  getMatchdayMatches(
    leagueShortcut: string,
    leagueSeason: number | string,
    groupOrderId: number,
    forceRefresh = false
  ): Promise<Match[]> {
    return apiFetch<Match[]>(
      `/getmatchdata/${enc(leagueShortcut)}/${enc(leagueSeason)}/${enc(groupOrderId)}`,
      { ttl: TTL.SHORT, forceRefresh }
    );
  },

  getSeasonMatches(
    leagueShortcut: string,
    leagueSeason: number | string,
    forceRefresh = false
  ): Promise<Match[]> {
    return apiFetch<Match[]>(
      `/getmatchdata/${enc(leagueShortcut)}/${enc(leagueSeason)}`,
      { ttl: TTL.MEDIUM, forceRefresh }
    );
  },

  getTeamSeasonMatches(
    leagueShortcut: string,
    leagueSeason: number | string,
    teamFilterstring: string,
    forceRefresh = false
  ): Promise<Match[]> {
    return apiFetch<Match[]>(
      `/getmatchdata/${enc(leagueShortcut)}/${enc(leagueSeason)}/${enc(teamFilterstring)}`,
      { ttl: TTL.MEDIUM, forceRefresh }
    );
  },

  getHeadToHeadMatches(teamId1: number, teamId2: number, forceRefresh = false): Promise<Match[]> {
    return apiFetch<Match[]>(`/getmatchdata/${enc(teamId1)}/${enc(teamId2)}`, {
      ttl: TTL.MEDIUM,
      forceRefresh,
    });
  },

  // 3. Smart Change Polling
  getLastChangeDate(
    leagueShortcut: string,
    leagueSeason: number | string,
    groupOrderId: number
  ): Promise<string> {
    return apiFetch<string>(
      `/getlastchangedate/${enc(leagueShortcut)}/${enc(leagueSeason)}/${enc(groupOrderId)}`,
      { ttl: 10 * 1000, forceRefresh: true }
    );
  },

  // 4. Next / Last Match Spotlights
  getNextMatchByLeagueTeam(leagueId: number, teamId: number): Promise<Match | null> {
    return apiFetch<Match | null>(
      `/getnextmatchbyleagueteam/${enc(leagueId)}/${enc(teamId)}`,
      { ttl: TTL.SHORT }
    ).catch(() => null);
  },

  getLastMatchByLeagueTeam(leagueId: number, teamId: number): Promise<Match | null> {
    return apiFetch<Match | null>(
      `/getlastmatchbyleagueteam/${enc(leagueId)}/${enc(teamId)}`,
      { ttl: TTL.SHORT }
    ).catch(() => null);
  },

  getNextMatchByLeagueShortcut(leagueShortcut: string): Promise<Match | null> {
    return apiFetch<Match | null>(
      `/getnextmatchbyleagueshortcut/${enc(leagueShortcut)}`,
      { ttl: TTL.SHORT }
    ).catch(() => null);
  },

  getLastMatchByLeagueShortcut(leagueShortcut: string): Promise<Match | null> {
    return apiFetch<Match | null>(
      `/getlastmatchbyleagueshortcut/${enc(leagueShortcut)}`,
      { ttl: TTL.SHORT }
    ).catch(() => null);
  },

  // 5. Groups / Matchdays
  getCurrentGroup(leagueShortcut: string, forceRefresh = false): Promise<Group> {
    return apiFetch<Group>(`/getcurrentgroup/${enc(leagueShortcut)}`, {
      ttl: TTL.SHORT,
      forceRefresh,
    });
  },

  getAvailableGroups(
    leagueShortcut: string,
    leagueSeason: number | string,
    forceRefresh = false
  ): Promise<Group[]> {
    return apiFetch<Group[]>(
      `/getavailablegroups/${enc(leagueShortcut)}/${enc(leagueSeason)}`,
      { ttl: TTL.LONG, persist: true, forceRefresh }
    );
  },

  // 6. Tables & Standings
  getTable(
    leagueShortcut: string,
    leagueSeason: number | string,
    forceRefresh = false
  ): Promise<BlTableTeam[]> {
    return apiFetch<BlTableTeam[]>(
      `/getbltable/${enc(leagueShortcut)}/${enc(leagueSeason)}`,
      { ttl: TTL.SHORT, forceRefresh }
    );
  },

  getGroupTable(
    leagueShortcut: string,
    leagueSeason: number | string,
    forceRefresh = false
  ): Promise<BlTableTeam[]> {
    return apiFetch<BlTableTeam[]>(
      `/getgrouptable/${enc(leagueShortcut)}/${enc(leagueSeason)}`,
      { ttl: TTL.SHORT, forceRefresh }
    );
  },

  // 7. Scorers & Teams
  getGoalGetters(
    leagueShortcut: string,
    leagueSeason: number | string,
    forceRefresh = false
  ): Promise<GoalGetter[]> {
    return apiFetch<GoalGetter[]>(
      `/getgoalgetters/${enc(leagueShortcut)}/${enc(leagueSeason)}`,
      { ttl: TTL.SHORT, forceRefresh }
    );
  },

  getAvailableTeams(
    leagueShortcut: string,
    leagueSeason: number | string,
    forceRefresh = false
  ): Promise<Team[]> {
    return apiFetch<Team[]>(
      `/getavailableteams/${enc(leagueShortcut)}/${enc(leagueSeason)}`,
      { ttl: TTL.LONG, persist: true, forceRefresh }
    );
  },

  // 8. Result Types & League Result Info
  getResultInfos(leagueId: number): Promise<ResultInfo[]> {
    return apiFetch<ResultInfo[]>(`/getresultinfos/${enc(leagueId)}`, {
      ttl: TTL.LONG,
      persist: true,
    });
  },

  getResultTypes(): Promise<GlobalResultInfo[]> {
    return apiFetch<GlobalResultInfo[]>('/getresulttypes', {
      ttl: TTL.LONG,
      persist: true,
    });
  },

  // 9. Cross-Competition Team Fixtures
  getMatchesByTeamFilter(
    teamFilterstring: string,
    weekCountPast = 4,
    weekCountFuture = 4
  ): Promise<Match[]> {
    return apiFetch<Match[]>(
      `/getmatchesbyteam/${enc(teamFilterstring)}/${enc(weekCountPast)}/${enc(weekCountFuture)}`,
      { ttl: TTL.SHORT }
    );
  },

  getMatchesByTeamId(
    teamId: number,
    weekCountPast = 8,
    weekCountFuture = 8
  ): Promise<Match[]> {
    return apiFetch<Match[]>(
      `/getmatchesbyteamid/${enc(teamId)}/${enc(weekCountPast)}/${enc(weekCountFuture)}`,
      { ttl: TTL.SHORT }
    );
  },
};
