import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Globe, Search, Star, X } from 'lucide-react';
import { openLigaApi } from '../api/openligadb';
import { CURATED_LEAGUES, isLikelyTestLeague } from '../config/leagues';
import { useAppState } from '../context/AppStateContext';
import type { League, Match, Team } from '../types/openligadb';
import { TeamCrest } from '../components/TeamCrest';
import { MatchCard } from '../components/MatchCard';

const QUICK_SEARCHES = ['Bayern', 'Dortmund', 'Frankfurt', 'Leverkusen', 'Stuttgart', 'Köln', 'HSV', 'Schalke'];

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { isFavoriteTeam, toggleFavoriteTeam } = useAppState();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [knownTeams, setKnownTeams] = useState<Team[]>([]);
  const [liveTeamMatches, setLiveTeamMatches] = useState<Match[]>([]);
  const [searchingApi, setSearchingApi] = useState(false);

  // Preload leagues + top league teams for instant zero-latency search
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      openLigaApi.getAvailableLeagues().catch(() => []),
      openLigaApi.getAvailableTeams('bl1', 2026).catch(() => []),
      openLigaApi.getAvailableTeams('bl2', 2026).catch(() => []),
      openLigaApi.getAvailableTeams('bl3', 2026).catch(() => []),
      openLigaApi.getAvailableTeams('ucl', 2026).catch(() => []),
    ]).then(([leagues, t1, t2, t3, tucl]) => {
      if (cancelled) return;
      setAllLeagues(leagues);
      const map = new Map<number, Team>();
      for (const t of [...t1, ...t2, ...t3, ...tucl]) {
        if (!map.has(t.teamId)) map.set(t.teamId, t);
      }
      setKnownTeams(Array.from(map.values()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce query for live OpenLigaDB /getmatchesbyteam/{query}/4/6 search
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setLiveTeamMatches([]);
      setSearchingApi(false);
      return;
    }
    let cancelled = false;
    setSearchingApi(true);
    openLigaApi
      .getMatchesByTeamFilter(debouncedQuery, 4, 6)
      .then((res) => {
        if (!cancelled) setLiveTeamMatches(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (!cancelled) setLiveTeamMatches([]);
      })
      .finally(() => {
        if (!cancelled) setSearchingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const matchedTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const map = new Map<number, Team>();

    for (const t of knownTeams) {
      const hay = `${t.teamName ?? ''} ${t.shortName ?? ''} ${t.tla ?? ''}`.toLowerCase();
      if (hay.includes(q)) map.set(t.teamId, t);
    }

    // Also harvest teams returned by /getmatchesbyteam
    for (const m of liveTeamMatches) {
      for (const t of [m.team1, m.team2]) {
        if (!t) continue;
        const hay = `${t.teamName ?? ''} ${t.shortName ?? ''}`.toLowerCase();
        if (hay.includes(q) && !map.has(t.teamId)) {
          map.set(t.teamId, t);
        }
      }
    }

    return Array.from(map.values()).slice(0, 15);
  }, [query, knownTeams, liveTeamMatches]);

  const matchedLeagues = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allLeagues
      .filter((l) => !isLikelyTestLeague(l) && l.sport?.sportId === 1)
      .filter((l) => {
        const hay = `${l.leagueName ?? ''} ${l.leagueShortcut ?? ''} ${l.leagueSeason ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => Number(b.leagueSeason ?? 0) - Number(a.leagueSeason ?? 0))
      .slice(0, 10);
  }, [query, allLeagues]);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0D10]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] pt-safe">
        <div className="px-4 py-3 space-y-2.5">
          <h1 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
            Suche
          </h1>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Verein, Liga oder Kürzel suchen..."
              autoFocus
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-100 dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] text-sm font-medium text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#C8FF00]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Suche leeren"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="px-3.5 py-4 space-y-5">
        {!query.trim() ? (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5 px-1">
                Beliebte Suchanfragen
              </h2>
              <div className="flex flex-wrap gap-2">
                {QUICK_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 dark:hover:border-[#C8FF00]/50 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5 px-1">
                Top Wettbewerbe
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {CURATED_LEAGUES.slice(0, 8).map((l) => (
                  <button
                    key={l.shortcut}
                    type="button"
                    onClick={() =>
                      navigate(`/league/${encodeURIComponent(l.shortcut)}/${l.season}`)
                    }
                    className="p-3 rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-2.5 text-left hover:border-emerald-500/40 dark:hover:border-[#C8FF00]/40 transition-colors"
                  >
                    <span className="text-lg">{l.flag}</span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {l.shortLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-up">
            {/* Teams results */}
            {matchedTeams.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Vereine ({matchedTeams.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {matchedTeams.map((team) => {
                    const fav = isFavoriteTeam(team.teamId);
                    return (
                      <div key={team.teamId} className="px-3.5 py-2.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/team/${team.teamId}`, { state: { team } })}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <TeamCrest
                            src={team.teamIconUrl}
                            name={team.teamName}
                            tla={team.tla}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-950 dark:text-white truncate">
                              {team.teamName}
                            </p>
                            {team.shortName && (
                              <p className="text-[11px] text-slate-500 truncate">{team.shortName}</p>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            toggleFavoriteTeam({
                              teamId: team.teamId,
                              teamName: team.teamName || 'Team',
                              shortName: team.shortName || team.teamName || 'Team',
                              teamIconUrl: team.teamIconUrl,
                            })
                          }
                          aria-label={fav ? 'Entfolgen' : 'Folgen'}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              fav
                                ? 'text-amber-500 dark:text-[#C8FF00] fill-current'
                                : 'text-slate-400'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Leagues results */}
            {matchedLeagues.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Wettbewerbe ({matchedLeagues.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {matchedLeagues.map((l) => (
                    <button
                      key={l.leagueId}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/league/${encodeURIComponent(l.leagueShortcut || '')}/${l.leagueSeason || '2026'}`,
                          { state: { league: l } }
                        )
                      }
                      className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-950 dark:text-white truncate">
                            {l.leagueName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {l.leagueShortcut} • Saison {l.leagueSeason}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Live OpenLigaDB Team Matches via /getmatchesbyteam */}
            {searchingApi ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Durchsuche OpenLigaDB-Spiele nach „{debouncedQuery}“...
              </div>
            ) : liveTeamMatches.length > 0 ? (
              <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Aktuelle Spiele ({liveTeamMatches.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {liveTeamMatches.slice(0, 15).map((m) => (
                    <MatchCard key={m.matchID} match={m} showLeagueBadge showDate />
                  ))}
                </div>
              </section>
            ) : (
              matchedTeams.length === 0 &&
              matchedLeagues.length === 0 && (
                <div className="rounded-2xl bg-white dark:bg-[#14181F] p-8 text-center text-sm text-slate-500">
                  Keine Treffer für „{query}“ gefunden.
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
