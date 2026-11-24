import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { openLigaApi } from '../api/openligadb';
import { CURATED_LEAGUES, getCuratedLeague } from '../config/leagues';
import { useAppState } from '../context/AppStateContext';
import type { Group, Match } from '../types/openligadb';
import {
  deriveMatchScore,
  generateDateStrip,
  getKickoffDate,
  toLocalDateKey,
} from '../utils/matchUtils';
import { MatchCard } from '../components/MatchCard';
import { LeagueGroupSkeleton } from '../components/Skeletons';

type FeedMode = 'matchday' | 'date';

interface LeagueMatchBundle {
  shortcut: string;
  season: number;
  leagueName: string;
  flag: string;
  color: string;
  groupName: string;
  groupOrderId?: number;
  matches: Match[];
}

export const MatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { homeLeagues, favoriteLeagues, refreshIntervalSec } = useAppState();

  const [feedMode, setFeedMode] = useState<FeedMode>('matchday');
  const [liveOnly, setLiveOnly] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toLocalDateKey(new Date()));
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});

  // Data state for "all active leagues current matchday" + date mode
  const [bundles, setBundles] = useState<LeagueMatchBundle[]>([]);
  const [seasonMatchesByLeague, setSeasonMatchesByLeague] = useState<Record<string, Match[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Single-league matchday explorer state (when a specific league pill is picked)
  const [singleGroups, setSingleGroups] = useState<Group[]>([]);
  const [singleGroupOrderId, setSingleGroupOrderId] = useState<number | null>(null);
  const [singleMatches, setSingleMatches] = useState<Match[]>([]);
  const [singleLoading, setSingleLoading] = useState(false);

  const lastChangeHashRef = useRef<Record<string, string>>({});
  const dateStripRef = useRef<HTMLDivElement>(null);

  const activeShortcuts = useMemo(() => {
    const merged = Array.from(new Set([...favoriteLeagues, ...homeLeagues]));
    return merged.length ? merged : ['bl1', 'bl2', 'bl3', 'dfb', 'ucl'];
  }, [favoriteLeagues, homeLeagues]);

  const dateStrip = useMemo(() => generateDateStrip(new Date(), 7), []);

  // Tick every 30s so live minutes & kickoff countdowns stay fresh
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Fetch current matchday across all active leagues
  const fetchAllCurrentBundles = useCallback(
    async (forceRefresh = false) => {
      try {
        if (forceRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const results = await Promise.allSettled(
          activeShortcuts.map(async (shortcut) => {
            const cfg = getCuratedLeague(shortcut);
            const matches = await openLigaApi.getCurrentMatchdayMatches(shortcut, forceRefresh);
            if (!matches.length) return null;
            const first = matches[0];
            return {
              shortcut,
              season: first.leagueSeason || cfg?.season || 2026,
              leagueName: cfg?.shortLabel || first.leagueName || shortcut.toUpperCase(),
              flag: cfg?.flag || '⚽',
              color: cfg?.color || '#00E676',
              groupName: first.group?.groupName || 'Aktueller Spieltag',
              groupOrderId: first.group?.groupOrderID,
              matches: [...matches].sort((a, b) => {
                const da = getKickoffDate(a)?.getTime() ?? 0;
                const db = getKickoffDate(b)?.getTime() ?? 0;
                return da - db;
              }),
            } as LeagueMatchBundle;
          })
        );

        const valid = results
          .filter(
            (r): r is PromiseFulfilledResult<LeagueMatchBundle | null> =>
              r.status === 'fulfilled' && r.value !== null
          )
          .map((r) => r.value!);

        setBundles(valid);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Spieldaten');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeShortcuts]
  );

  useEffect(() => {
    fetchAllCurrentBundles(false);
  }, [fetchAllCurrentBundles]);

  // Load full season matches lazily when entering Date Mode so every day (+/- 7d or any date) has matches!
  useEffect(() => {
    if (feedMode !== 'date') return;
    let cancelled = false;
    (async () => {
      const missing = activeShortcuts.filter((sc) => !seasonMatchesByLeague[sc]);
      if (!missing.length) return;
      const entries = await Promise.allSettled(
        missing.map(async (sc) => {
          const cfg = getCuratedLeague(sc);
          const season = cfg?.season ?? 2026;
          const matches = await openLigaApi.getSeasonMatches(sc, season);
          return [sc, matches] as const;
        })
      );
      if (cancelled) return;
      setSeasonMatchesByLeague((prev) => {
        const next = { ...prev };
        for (const r of entries) {
          if (r.status === 'fulfilled') {
            next[r.value[0]] = r.value[1];
          }
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [feedMode, activeShortcuts, seasonMatchesByLeague]);

  // Single-league matchday mode loader
  useEffect(() => {
    if (selectedLeague === 'all') {
      setSingleGroups([]);
      setSingleGroupOrderId(null);
      setSingleMatches([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setSingleLoading(true);
      try {
        const cfg = getCuratedLeague(selectedLeague);
        const season = cfg?.season ?? 2026;
        const [currentGroup, groups, currentMatches] = await Promise.all([
          openLigaApi.getCurrentGroup(selectedLeague).catch(() => null),
          openLigaApi.getAvailableGroups(selectedLeague, season).catch(() => []),
          openLigaApi.getCurrentMatchdayMatches(selectedLeague),
        ]);
        if (cancelled) return;
        const sortedGroups = [...groups].sort((a, b) => a.groupOrderID - b.groupOrderID);
        setSingleGroups(sortedGroups);
        const orderId =
          currentGroup?.groupOrderID ??
          currentMatches[0]?.group?.groupOrderID ??
          sortedGroups[0]?.groupOrderID ??
          1;
        setSingleGroupOrderId(orderId);
        setSingleMatches(
          [...currentMatches].sort(
            (a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0)
          )
        );
      } catch {
        // fallback handled by empty state
      } finally {
        if (!cancelled) setSingleLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedLeague]);

  const loadSpecificMatchday = useCallback(
    async (shortcut: string, groupOrderId: number) => {
      const cfg = getCuratedLeague(shortcut);
      const season = cfg?.season ?? 2026;
      setSingleGroupOrderId(groupOrderId);
      setSingleLoading(true);
      try {
        const data = await openLigaApi.getMatchdayMatches(shortcut, season, groupOrderId);
        setSingleMatches(
          [...data].sort(
            (a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0)
          )
        );
      } finally {
        setSingleLoading(false);
      }
    },
    []
  );

  // Smart change-detection polling using OpenLigaDB /getlastchangedate
  useEffect(() => {
    if (!refreshIntervalSec || refreshIntervalSec <= 0 || !bundles.length) return;

    const timer = window.setInterval(async () => {
      // Check if any match is currently live or starting within 15 min
      const hasActiveOrSoon = bundles.some((b) =>
        b.matches.some((m) => {
          const d = deriveMatchScore(m, Date.now());
          if (d.status === 'live' || d.status === 'halftime') return true;
          const k = getKickoffDate(m);
          if (!k) return false;
          const diff = k.getTime() - Date.now();
          return diff > -180 * 60_000 && diff < 15 * 60_000;
        })
      );

      if (!hasActiveOrSoon) return;

      let changed = false;
      for (const b of bundles) {
        if (!b.groupOrderId) continue;
        try {
          const stamp = await openLigaApi.getLastChangeDate(b.shortcut, b.season, b.groupOrderId);
          const key = `${b.shortcut}_${b.season}_${b.groupOrderId}`;
          if (lastChangeHashRef.current[key] && lastChangeHashRef.current[key] !== stamp) {
            changed = true;
          }
          lastChangeHashRef.current[key] = stamp;
        } catch {
          // ignore transient poll error
        }
      }

      if (changed) {
        fetchAllCurrentBundles(true);
      }
    }, refreshIntervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [refreshIntervalSec, bundles, fetchAllCurrentBundles]);

  // Compute all matches across bundles for live count
  const liveCount = useMemo(() => {
    let count = 0;
    for (const b of bundles) {
      for (const m of b.matches) {
        const s = deriveMatchScore(m, nowMs);
        if (s.status === 'live' || s.status === 'halftime') count++;
      }
    }
    return count;
  }, [bundles, nowMs]);

  // Filter bundles for Matchday Mode vs Date Mode
  const displayedBundles = useMemo<LeagueMatchBundle[]>(() => {
    if (feedMode === 'date') {
      const grouped: LeagueMatchBundle[] = [];
      for (const sc of activeShortcuts) {
        const cfg = getCuratedLeague(sc);
        const allSeason = seasonMatchesByLeague[sc] ?? bundles.find((b) => b.shortcut === sc)?.matches ?? [];
        const dayMatches = allSeason
          .filter((m) => {
            const k = getKickoffDate(m);
            if (!k) return false;
            return toLocalDateKey(k) === selectedDateKey;
          })
          .filter((m) => {
            if (!liveOnly) return true;
            const s = deriveMatchScore(m, nowMs);
            return s.status === 'live' || s.status === 'halftime';
          })
          .sort((a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0));

        if (dayMatches.length > 0) {
          grouped.push({
            shortcut: sc,
            season: dayMatches[0].leagueSeason || cfg?.season || 2026,
            leagueName: cfg?.shortLabel || dayMatches[0].leagueName || sc.toUpperCase(),
            flag: cfg?.flag || '⚽',
            color: cfg?.color || '#00E676',
            groupName: dayMatches[0].group?.groupName || '',
            matches: dayMatches,
          });
        }
      }
      return grouped;
    }

    // Matchday mode
    return bundles
      .map((b) => {
        const filtered = liveOnly
          ? b.matches.filter((m) => {
              const s = deriveMatchScore(m, nowMs);
              return s.status === 'live' || s.status === 'halftime';
            })
          : b.matches;
        return { ...b, matches: filtered };
      })
      .filter((b) => b.matches.length > 0);
  }, [feedMode, activeShortcuts, seasonMatchesByLeague, bundles, selectedDateKey, liveOnly, nowMs]);

  const toggleCollapse = (shortcut: string) => {
    setCollapsedLeagues((prev) => ({ ...prev, [shortcut]: !prev[shortcut] }));
  };

  // Scroll today pill into view in date mode
  useEffect(() => {
    if (feedMode === 'date' && dateStripRef.current) {
      const el = dateStripRef.current.querySelector('[data-active="true"]');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [feedMode]);

  const currentGroupIdx = singleGroups.findIndex((g) => g.groupOrderID === singleGroupOrderId);

  return (
    <div className="flex flex-col">
      {/* Sticky OneFootball-style Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0D10]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] pt-safe">
        <div className="px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C8FF00] to-[#00E676] flex items-center justify-center shadow-sm">
              <span className="text-black font-black text-sm tracking-tighter">TP</span>
            </div>
            <div>
              <h1 className="text-[17px] font-black tracking-tight leading-none text-slate-950 dark:text-white">
                TorPulse
              </h1>
              {lastUpdated && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  Stand {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* LIVE Filter Pill */}
            <button
              type="button"
              onClick={() => setLiveOnly((v) => !v)}
              className={`h-8 px-2.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                liveOnly
                  ? 'bg-[#00E676] text-black shadow-md shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-[#1B212B] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
              aria-pressed={liveOnly}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  liveCount > 0
                    ? liveOnly
                      ? 'bg-black animate-live-dot'
                      : 'bg-[#00E676] animate-live-dot'
                    : 'bg-slate-400'
                }`}
              />
              <span>LIVE</span>
              {liveCount > 0 && (
                <span className="tabular-nums opacity-90">({liveCount})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => fetchAllCurrentBundles(true)}
              disabled={refreshing}
              aria-label="Ergebnisse aktualisieren"
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => navigate('/search')}
              aria-label="Suchen"
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher + League / Date Strip */}
        <div className="px-4 pb-2.5 flex items-center justify-between gap-2">
          <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={() => setFeedMode('matchday')}
              className={`px-3 py-1 rounded-[10px] text-xs font-bold flex items-center gap-1.5 transition-all ${
                feedMode === 'matchday'
                  ? 'bg-white dark:bg-[#232B38] text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Spieltag</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedMode('date');
                setSelectedLeague('all');
              }}
              className={`px-3 py-1 rounded-[10px] text-xs font-bold flex items-center gap-1.5 transition-all ${
                feedMode === 'date'
                  ? 'bg-white dark:bg-[#232B38] text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Kalender</span>
            </button>
          </div>

          {feedMode === 'date' && (
            <label className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.07] text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <Calendar className="w-3.5 h-3.5" />
              <input
                type="date"
                value={selectedDateKey}
                onChange={(e) => e.target.value && setSelectedDateKey(e.target.value)}
                className="bg-transparent text-xs font-semibold focus:outline-none w-[108px] cursor-pointer"
                aria-label="Datum auswählen"
              />
            </label>
          )}
        </div>

        {/* Sub-strip: League Pills (Matchday mode) OR Date Carousel (Date mode) */}
        {feedMode === 'matchday' ? (
          <div className="px-4 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedLeague('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedLeague === 'all'
                  ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black'
                  : 'bg-slate-100 dark:bg-[#14181F] text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-white/[0.07]'
              }`}
            >
              Alle Ligen
            </button>
            {activeShortcuts.map((sc) => {
              const cfg = getCuratedLeague(sc);
              const active = selectedLeague === sc;
              return (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setSelectedLeague(sc)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black'
                      : 'bg-slate-100 dark:bg-[#14181F] text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-white/[0.07]'
                  }`}
                >
                  <span>{cfg?.flag || '⚽'}</span>
                  <span>{cfg?.shortLabel || sc.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            ref={dateStripRef}
            className="px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
          >
            {dateStrip.map((item) => {
              const active = item.key === selectedDateKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-active={active}
                  onClick={() => setSelectedDateKey(item.key)}
                  className={`min-w-[58px] px-2.5 py-1.5 rounded-xl flex flex-col items-center justify-center transition-all shrink-0 ${
                    active
                      ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black font-bold shadow-sm'
                      : 'bg-slate-100/80 dark:bg-[#14181F] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06]'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-80">
                    {item.isToday ? 'Heute' : item.dayShort}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums mt-0.5">
                    {item.dayNum}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Feed Content */}
      <div className="px-3.5 py-3.5 space-y-3.5">
        {error && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-600 dark:text-rose-400 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchAllCurrentBundles(true)}
              className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold shrink-0"
            >
              Neu laden
            </button>
          </div>
        )}

        {/* Single-league Matchday Drilldown inside Home Feed */}
        {feedMode === 'matchday' && selectedLeague !== 'all' ? (
          <div className="space-y-3 animate-fade-up">
            {(() => {
              const cfg = getCuratedLeague(selectedLeague) ?? CURATED_LEAGUES[0];
              const season = cfg?.season ?? 2026;
              return (
                <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                  <div className="px-3.5 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{cfg?.flag || '⚽'}</span>
                      <div className="min-w-0">
                        <h2 className="text-sm font-extrabold truncate text-slate-950 dark:text-white">
                          {cfg?.name || selectedLeague.toUpperCase()}
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Saison {season}/{String(season + 1).slice(-2)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/league/${encodeURIComponent(selectedLeague)}/${season}`)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1B212B] text-xs font-bold text-slate-900 dark:text-[#C8FF00] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                      Tabelle & mehr →
                    </button>
                  </div>

                  {/* Matchday Navigator */}
                  {singleGroups.length > 0 && (
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
                      <button
                        type="button"
                        disabled={currentGroupIdx <= 0}
                        onClick={() =>
                          currentGroupIdx > 0 &&
                          loadSpecificMatchday(
                            selectedLeague,
                            singleGroups[currentGroupIdx - 1].groupOrderID
                          )
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-slate-200/70 dark:hover:bg-white/10"
                        aria-label="Vorheriger Spieltag"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <select
                        value={singleGroupOrderId ?? ''}
                        onChange={(e) =>
                          loadSpecificMatchday(selectedLeague, Number(e.target.value))
                        }
                        aria-label="Spieltag wählen"
                        className="bg-transparent text-xs font-extrabold text-center text-slate-900 dark:text-white focus:outline-none cursor-pointer px-2 py-1"
                      >
                        {singleGroups.map((g) => (
                          <option
                            key={g.groupID}
                            value={g.groupOrderID}
                            className="bg-white dark:bg-[#14181F] text-slate-900 dark:text-white"
                          >
                            {g.groupName}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={currentGroupIdx < 0 || currentGroupIdx >= singleGroups.length - 1}
                        onClick={() =>
                          currentGroupIdx >= 0 &&
                          currentGroupIdx < singleGroups.length - 1 &&
                          loadSpecificMatchday(
                            selectedLeague,
                            singleGroups[currentGroupIdx + 1].groupOrderID
                          )
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-slate-200/70 dark:hover:bg-white/10"
                        aria-label="Nächster Spieltag"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {singleLoading ? (
                    <div className="p-3">
                      <LeagueGroupSkeleton />
                    </div>
                  ) : singleMatches.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Keine Spiele für diesen Spieltag gefunden.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {singleMatches
                        .filter((m) => {
                          if (!liveOnly) return true;
                          const s = deriveMatchScore(m, nowMs);
                          return s.status === 'live' || s.status === 'halftime';
                        })
                        .map((m) => (
                          <MatchCard key={m.matchID} match={m} showDate nowMs={nowMs} />
                        ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : loading ? (
          <div className="space-y-3.5">
            <LeagueGroupSkeleton />
            <LeagueGroupSkeleton />
          </div>
        ) : displayedBundles.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-8 text-center space-y-3 animate-fade-up">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.05] mx-auto flex items-center justify-center text-slate-400">
              {liveOnly ? <Radio className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {liveOnly
                  ? 'Aktuell keine Live-Spiele'
                  : 'Keine Spiele an diesem Tag'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                {liveOnly
                  ? 'Sobald ein Spiel in deinen aktiven Ligen angepfiffen wird, erscheint es hier mit Live-Ticker.'
                  : 'Wähle ein anderes Datum oder wechsle in die Spieltag-Ansicht, um alle aktuellen Partien zu sehen.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {liveOnly && (
                <button
                  type="button"
                  onClick={() => setLiveOnly(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black text-xs font-extrabold"
                >
                  Alle Spiele zeigen
                </button>
              )}
              {feedMode === 'date' && (
                <button
                  type="button"
                  onClick={() => setFeedMode('matchday')}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1B212B] text-slate-900 dark:text-white text-xs font-bold"
                >
                  Zum aktuellen Spieltag
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 animate-fade-up">
            {displayedBundles.map((bundle) => {
              const isCollapsed = !!collapsedLeagues[bundle.shortcut];
              const bundleLiveCount = bundle.matches.filter((m) => {
                const s = deriveMatchScore(m, nowMs);
                return s.status === 'live' || s.status === 'halftime';
              }).length;

              return (
                <section
                  key={bundle.shortcut}
                  className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-2xs"
                >
                  {/* Collapsible OneFootball-style League Header */}
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02]">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/league/${encodeURIComponent(bundle.shortcut)}/${bundle.season}`)
                      }
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 bg-white dark:bg-[#1B212B] border border-slate-200/70 dark:border-white/[0.08]"
                      >
                        {bundle.flag}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-[13px] font-extrabold text-slate-950 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-[#C8FF00] transition-colors">
                            {bundle.leagueName}
                          </h2>
                          {bundleLiveCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-[#00E676] text-[10px] font-black">
                              {bundleLiveCount} LIVE
                            </span>
                          )}
                        </div>
                        {bundle.groupName && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {bundle.groupName}
                          </p>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCollapse(bundle.shortcut)}
                      aria-label={isCollapsed ? 'Spiele aufklappen' : 'Spiele einklappen'}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {bundle.matches.map((match) => (
                        <MatchCard
                          key={match.matchID}
                          match={match}
                          showDate={feedMode === 'matchday'}
                          nowMs={nowMs}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
