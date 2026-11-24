import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  Filter,
  Globe,
  GripVertical,
  RotateCcw,
  Search,
  Star,
  Trophy,
} from 'lucide-react';
import { openLigaApi } from '../api/openligadb';
import { CURATED_LEAGUES, isLikelyTestLeague } from '../config/leagues';
import { useAppState } from '../context/AppStateContext';
import type { League, Sport } from '../types/openligadb';

type CategoryTab = 'top' | 'germany' | 'europe' | 'international' | 'women' | 'all';

export const LeaguesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    isFavoriteLeague,
    toggleFavoriteLeague,
    favoriteLeagues,
    leagueOrder,
    reorderLeagues,
    moveLeague,
    resetLeagueOrder,
    pinFavoriteLeaguesFirst,
    setPinFavoriteLeaguesFirst,
  } = useAppState();

  const [tab, setTab] = useState<CategoryTab>('top');
  const [sortMode, setSortMode] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<number>(1);
  const [selectedSeason, setSelectedSeason] = useState<string>('2026');
  const [hideTestLeagues, setHideTestLeagues] = useState(true);
  const [query, setQuery] = useState('');
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    if (tab !== 'all') return;
    let cancelled = false;
    setLoadingAll(true);
    Promise.all([
      openLigaApi.getAvailableLeagues(),
      openLigaApi.getAvailableSports().catch(() => []),
    ])
      .then(([leaguesData, sportsData]) => {
        if (cancelled) return;
        setAllLeagues(leaguesData);
        setSports(sportsData);
      })
      .finally(() => {
        if (!cancelled) setLoadingAll(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  // Sort curated leagues strictly according to user's custom leagueOrder (+ optional favorite pinning)
  const sortedCuratedAll = useMemo(() => {
    const orderIdx = (sc: string) => {
      const idx = leagueOrder.findIndex((o) => o.toLowerCase() === sc.toLowerCase());
      return idx === -1 ? 999 : idx;
    };
    const favIdx = (sc: string) =>
      favoriteLeagues.findIndex((f) => f.toLowerCase() === sc.toLowerCase());

    return [...CURATED_LEAGUES].sort((a, b) => {
      if (pinFavoriteLeaguesFirst && !sortMode) {
        const fa = favIdx(a.shortcut);
        const fb = favIdx(b.shortcut);
        if (fa !== -1 && fb === -1) return -1;
        if (fa === -1 && fb !== -1) return 1;
        if (fa !== -1 && fb !== -1) return fa - fb;
      }
      return orderIdx(a.shortcut) - orderIdx(b.shortcut);
    });
  }, [leagueOrder, favoriteLeagues, pinFavoriteLeaguesFirst, sortMode]);

  const curatedFiltered = useMemo(() => {
    if (sortMode || tab === 'top') return sortedCuratedAll;
    return sortedCuratedAll.filter((l) => l.category === tab);
  }, [tab, sortMode, sortedCuratedAll]);

  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    for (const l of allLeagues) {
      if (l.leagueSeason && /^\d{4}$/.test(l.leagueSeason)) {
        set.add(l.leagueSeason);
      }
    }
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [allLeagues]);

  const exploredLeagues = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLeagues
      .filter((l) => {
        if (selectedSportId !== 0 && l.sport?.sportId !== selectedSportId) return false;
        if (selectedSeason !== 'all' && l.leagueSeason !== selectedSeason) return false;
        if (hideTestLeagues && isLikelyTestLeague(l)) return false;
        if (q) {
          const hay = `${l.leagueName ?? ''} ${l.leagueShortcut ?? ''} ${l.leagueSeason ?? ''}`.toLowerCase();
          return hay.includes(q);
        }
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.leagueSeason ?? 0) - Number(a.leagueSeason ?? 0) ||
          (a.leagueName ?? '').localeCompare(b.leagueName ?? '')
      )
      .slice(0, 120);
  }, [allLeagues, selectedSportId, selectedSeason, hideTestLeagues, query]);

  const TABS: { id: CategoryTab; label: string }[] = [
    { id: 'top', label: 'Top Ligen' },
    { id: 'germany', label: 'Deutschland' },
    { id: 'europe', label: 'Europa' },
    { id: 'international', label: 'International' },
    { id: 'women', label: 'Frauen' },
    { id: 'all', label: 'Alle (OpenLigaDB)' },
  ];

  const handleDrop = (targetIdx: number) => {
    if (dragIndex !== null && dragIndex !== targetIdx) {
      reorderLeagues(dragIndex, targetIdx);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0B0D10]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] pt-safe">
        <div className="px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600 dark:text-[#C8FF00]" />
            <h1 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
              Wettbewerbe
            </h1>
          </div>

          {tab !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setSortMode((v) => !v);
                setTab('top');
              }}
              className={`h-8 px-3 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                sortMode
                  ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black'
                  : 'bg-slate-100 dark:bg-[#1B212B] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {sortMode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Fertig</span>
                </>
              ) : (
                <>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Sortieren</span>
                </>
              )}
            </button>
          )}
        </div>

        {!sortMode && (
          <div className="px-4 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  tab === t.id
                    ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black'
                    : 'bg-slate-100 dark:bg-[#14181F] text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-white/[0.07]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="px-3.5 py-4 space-y-4">
        {sortMode && (
          <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-emerald-500/35 dark:border-[#C8FF00]/30 p-3.5 space-y-3 animate-fade-up">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Ziehe Ligen per Drag & Drop oder nutze die Pfeile – gilt für Spiele- & Ligen-Tab.
              </p>
              <button
                type="button"
                onClick={resetLeagueOrder}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1B212B] text-[11px] font-bold flex items-center gap-1 shrink-0 text-slate-700 dark:text-slate-200"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
            <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0B0D10] text-xs font-semibold cursor-pointer">
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500 dark:text-[#C8FF00] fill-current" />
                Favoriten-Ligen automatisch ganz oben anzeigen
              </span>
              <input
                type="checkbox"
                checked={pinFavoriteLeaguesFirst}
                onChange={(e) => setPinFavoriteLeaguesFirst(e.target.checked)}
                className="accent-emerald-500 w-4 h-4"
              />
            </label>
          </div>
        )}

        {tab !== 'all' || sortMode ? (
          <div className="grid grid-cols-1 gap-2.5 animate-fade-up">
            {curatedFiltered.map((league, idx) => {
              const fav = isFavoriteLeague(league.shortcut);
              const isDragTarget = sortMode && dragOverIndex === idx && dragIndex !== idx;
              return (
                <div
                  key={league.shortcut}
                  draggable={sortMode}
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => {
                    if (!sortMode) return;
                    e.preventDefault();
                    setDragOverIndex(idx);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`rounded-2xl bg-white dark:bg-[#14181F] border overflow-hidden flex items-center transition-all ${
                    isDragTarget
                      ? 'border-emerald-500 dark:border-[#C8FF00] scale-[1.01]'
                      : 'border-slate-200/80 dark:border-white/[0.08] hover:border-emerald-500/40 dark:hover:border-[#C8FF00]/40'
                  }`}
                >
                  {sortMode ? (
                    <div className="flex-1 px-3 py-3 flex items-center gap-2.5 min-w-0 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="w-5 text-xs font-black tabular-nums text-slate-400 shrink-0">
                        {idx + 1}.
                      </span>
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border border-slate-200/60 dark:border-white/[0.08]"
                        style={{ backgroundColor: `${league.color}18` }}
                      >
                        {league.flag}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm font-extrabold text-slate-950 dark:text-white truncate">
                            {league.name}
                          </h2>
                          {fav && (
                            <Star className="w-3.5 h-3.5 text-amber-500 dark:text-[#C8FF00] fill-current shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {league.country}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveLeague(league.shortcut, 'up')}
                          aria-label={`${league.name} nach oben`}
                          className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === curatedFiltered.length - 1}
                          onClick={() => moveLeague(league.shortcut, 'down')}
                          aria-label={`${league.name} nach unten`}
                          className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/league/${encodeURIComponent(league.shortcut)}/${league.season}`)
                        }
                        className="flex-1 px-3.5 py-3.5 flex items-center gap-3 text-left min-w-0"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border border-slate-200/60 dark:border-white/[0.08]"
                          style={{ backgroundColor: `${league.color}18` }}
                        >
                          {league.flag}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-extrabold text-slate-950 dark:text-white truncate">
                            {league.name}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {league.country} • Saison {league.season}/{String(league.season + 1).slice(-2)}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center pr-2.5 gap-1">
                        <button
                          type="button"
                          onClick={() => toggleFavoriteLeague(league.shortcut)}
                          aria-label={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              fav
                                ? 'text-amber-500 dark:text-[#C8FF00] fill-current'
                                : 'text-slate-400'
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/league/${encodeURIComponent(league.shortcut)}/${league.season}`
                            )
                          }
                          aria-label={`${league.name} öffnen`}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Full OpenLigaDB Explorer */
          <div className="space-y-3 animate-fade-up">
            <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-3.5 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Liga oder Kürzel suchen (z.B. bl1, Regionalliga, WM)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0B0D10] border border-slate-200/80 dark:border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#C8FF00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  aria-label="Saison filtern"
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0B0D10] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                >
                  <option value="all">Alle Saisons</option>
                  {availableSeasons.map((s) => (
                    <option key={s} value={s}>
                      Saison {s}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSportId}
                  onChange={(e) => setSelectedSportId(Number(e.target.value))}
                  aria-label="Sportart filtern"
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0B0D10] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                >
                  <option value={0}>Alle Sportarten</option>
                  {sports.map((sp) => (
                    <option key={sp.sportId} value={sp.sportId}>
                      {sp.sportName || `Sport #${sp.sportId}`}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  Test- & Dummy-Ligen ausblenden
                </span>
                <input
                  type="checkbox"
                  checked={hideTestLeagues}
                  onChange={(e) => setHideTestLeagues(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 rounded"
                />
              </label>
            </div>

            {loadingAll ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Lade gesamten OpenLigaDB-Katalog...
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.05]">
                <div className="px-3.5 py-2 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>{exploredLeagues.length} Wettbewerbe angezeigt</span>
                  <span>Gesamt: {allLeagues.length}</span>
                </div>
                {exploredLeagues.map((l) => (
                  <button
                    key={l.leagueId}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/league/${encodeURIComponent(l.leagueShortcut || '')}/${l.leagueSeason || '2026'}`,
                        { state: { league: l } }
                      )
                    }
                    className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {l.leagueName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Kürzel: <span className="font-mono">{l.leagueShortcut}</span> • Saison{' '}
                          {l.leagueSeason} • {l.sport?.sportName}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
                {exploredLeagues.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Keine Ligen für diesen Filter gefunden.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
