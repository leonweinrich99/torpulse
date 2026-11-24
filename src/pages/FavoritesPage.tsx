import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Star, Trash2 } from 'lucide-react';
import { openLigaApi } from '../api/openligadb';
import { getCuratedLeague } from '../config/leagues';
import { useAppState } from '../context/AppStateContext';
import type { Match, Team } from '../types/openligadb';
import { getKickoffDate } from '../utils/matchUtils';
import { TeamCrest } from '../components/TeamCrest';
import { MatchCard } from '../components/MatchCard';
import { LeagueGroupSkeleton } from '../components/Skeletons';

export const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    favoriteTeams,
    toggleFavoriteTeam,
    isFavoriteTeam,
    favoriteLeagues,
    toggleFavoriteLeague,
  } = useAppState();

  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestedTeams, setSuggestedTeams] = useState<Team[]>([]);

  // Fetch suggested Bundesliga teams when user has < 3 favorite teams
  useEffect(() => {
    if (favoriteTeams.length >= 3) return;
    let cancelled = false;
    openLigaApi
      .getAvailableTeams('bl1', 2026)
      .then((list) => {
        if (!cancelled) setSuggestedTeams(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [favoriteTeams.length]);

  // Fetch recent & upcoming matches for all followed teams
  useEffect(() => {
    if (!favoriteTeams.length) {
      setTeamMatches([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.allSettled(
      favoriteTeams.slice(0, 8).map((t) => openLigaApi.getMatchesByTeamId(t.teamId, 3, 4))
    )
      .then((results) => {
        if (cancelled) return;
        const dedup = new Map<number, Match>();
        for (const r of results) {
          if (r.status === 'fulfilled') {
            for (const m of r.value) {
              dedup.set(m.matchID, m);
            }
          }
        }
        setTeamMatches(Array.from(dedup.values()));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [favoriteTeams]);

  const upcoming = useMemo(
    () =>
      teamMatches
        .filter((m) => !m.matchIsFinished)
        .sort((a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0)),
    [teamMatches]
  );

  const recent = useMemo(
    () =>
      teamMatches
        .filter((m) => m.matchIsFinished)
        .sort((a, b) => (getKickoffDate(b)?.getTime() ?? 0) - (getKickoffDate(a)?.getTime() ?? 0)),
    [teamMatches]
  );

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0D10]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] pt-safe">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 dark:text-[#C8FF00] fill-current" />
            <h1 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
              Favoriten
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1B212B] text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Team finden
          </button>
        </div>
      </header>

      <div className="px-3.5 py-4 space-y-5">
        {/* Followed Teams Horizontal Strip */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
            Meine Vereine ({favoriteTeams.length})
          </h2>

          {favoriteTeams.length > 0 ? (
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {favoriteTeams.map((t) => (
                <div
                  key={t.teamId}
                  className="shrink-0 w-24 rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-2.5 flex flex-col items-center gap-1.5 relative group"
                >
                  <button
                    type="button"
                    onClick={() => toggleFavoriteTeam(t)}
                    aria-label={`${t.shortName} entfernen`}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 hover:text-rose-500 opacity-80"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/team/${t.teamId}`, { state: { team: t } })}
                    className="flex flex-col items-center gap-1.5 w-full pt-1"
                  >
                    <TeamCrest src={t.teamIconUrl} name={t.teamName} size="md" />
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate w-full text-center">
                      {t.shortName}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-5 text-center space-y-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Folge deinen Lieblingsvereinen
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Wähle unten Vereine aus, um ihre nächsten Spiele & Ergebnisse sofort im Blick zu behalten.
              </p>
            </div>
          )}
        </section>

        {/* Quick Onboarding Club Picker */}
        {suggestedTeams.length > 0 && favoriteTeams.length < 3 && (
          <section className="space-y-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
              Schnellauswahl Bundesliga
            </h2>
            <div className="flex flex-wrap gap-2">
              {suggestedTeams.slice(0, 12).map((t) => {
                const fav = isFavoriteTeam(t.teamId);
                return (
                  <button
                    key={t.teamId}
                    type="button"
                    onClick={() =>
                      toggleFavoriteTeam({
                        teamId: t.teamId,
                        teamName: t.teamName || 'Team',
                        shortName: t.shortName || t.teamName || 'Team',
                        teamIconUrl: t.teamIconUrl,
                        leagueShortcut: 'bl1',
                        leagueSeason: 2026,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all ${
                      fav
                        ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black border-transparent'
                        : 'bg-white dark:bg-[#14181F] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-white/[0.08]'
                    }`}
                  >
                    <TeamCrest src={t.teamIconUrl} name={t.teamName} size="xs" />
                    <span>{t.shortName || t.teamName}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Followed Leagues */}
        {favoriteLeagues.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
              Meine Wettbewerbe ({favoriteLeagues.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {favoriteLeagues.map((sc) => {
                const cfg = getCuratedLeague(sc);
                return (
                  <div
                    key={sc}
                    className="inline-flex items-center rounded-full bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/league/${encodeURIComponent(sc)}/${cfg?.season ?? 2026}`)
                      }
                      className="pl-3 pr-2 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-[#C8FF00]"
                    >
                      <span>{cfg?.flag || '⚽'}</span>
                      <span>{cfg?.shortLabel || sc.toUpperCase()}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavoriteLeague(sc)}
                      aria-label={`${sc} entfernen`}
                      className="pr-2.5 pl-1 py-1.5 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Matches for Followed Teams */}
        {loading ? (
          <LeagueGroupSkeleton />
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-[#C8FF00]">
                  Kommende Spiele deiner Vereine
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {upcoming.slice(0, 15).map((m) => (
                    <MatchCard key={m.matchID} match={m} showLeagueBadge showDate />
                  ))}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Letzte Ergebnisse deiner Vereine
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {recent.slice(0, 15).map((m) => (
                    <MatchCard key={m.matchID} match={m} showLeagueBadge showDate />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};
