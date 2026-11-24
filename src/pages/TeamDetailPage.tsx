import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ExternalLink, Star, Swords } from 'lucide-react';
import { openLigaApi } from '../api/openligadb';
import { useAppState } from '../context/AppStateContext';
import type { Match, Team } from '../types/openligadb';
import {
  computeH2HStats,
  computeTeamForm,
  getDisplayTeamName,
  getKickoffDate,
} from '../utils/matchUtils';
import { TeamCrest } from '../components/TeamCrest';
import { FormBadges } from '../components/FormBadges';
import { MatchCard } from '../components/MatchCard';
import { LeagueGroupSkeleton } from '../components/Skeletons';

type TeamTab = 'schedule' | 'h2h';

interface TeamNavState {
  team?: Partial<Team>;
  leagueShortcut?: string;
  leagueSeason?: number;
  leagueId?: number;
}

export const TeamDetailPage: React.FC = () => {
  const { teamId: rawId } = useParams();
  const teamId = Number(rawId);
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as TeamNavState | null) ?? {};

  const { isFavoriteTeam, toggleFavoriteTeam } = useAppState();

  const [team, setTeam] = useState<Partial<Team> | null>(navState.team ?? null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [nextSpotlight, setNextSpotlight] = useState<Match | null>(null);
  const [lastSpotlight, setLastSpotlight] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TeamTab>('schedule');

  // H2H opponent selector
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [h2hMatches, setH2hMatches] = useState<Match[]>([]);
  const [h2hLoading, setH2hLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const teamMatches = await openLigaApi
          .getMatchesByTeamId(teamId, 16, 16)
          .catch(() => []);
        if (cancelled) return;

        setMatches(teamMatches);

        // Extract rich team info from matches if not passed via state
        const foundTeam =
          teamMatches.find((m) => m.team1?.teamId === teamId)?.team1 ||
          teamMatches.find((m) => m.team2?.teamId === teamId)?.team2;
        if (foundTeam) {
          setTeam((prev) => ({ ...prev, ...foundTeam }));
        }

        // Load next & last match by league+team if leagueId is known
        const inferredLeagueId = navState.leagueId ?? teamMatches[0]?.leagueId;
        if (inferredLeagueId) {
          const [nx, ls] = await Promise.all([
            openLigaApi.getNextMatchByLeagueTeam(inferredLeagueId, teamId),
            openLigaApi.getLastMatchByLeagueTeam(inferredLeagueId, teamId),
          ]);
          if (!cancelled) {
            setNextSpotlight(nx && nx.matchID ? nx : null);
            setLastSpotlight(ls && ls.matchID ? ls : null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId, navState.leagueId]);

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((m) => !m.matchIsFinished)
        .sort((a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0)),
    [matches]
  );

  const pastMatches = useMemo(
    () =>
      matches
        .filter((m) => m.matchIsFinished)
        .sort((a, b) => (getKickoffDate(b)?.getTime() ?? 0) - (getKickoffDate(a)?.getTime() ?? 0)),
    [matches]
  );

  const form = useMemo(() => computeTeamForm(matches, teamId, 5), [matches, teamId]);

  // Extract unique opponents for H2H explorer
  const opponents = useMemo(() => {
    const map = new Map<number, Team>();
    for (const m of matches) {
      const opp = m.team1?.teamId === teamId ? m.team2 : m.team1;
      if (opp && opp.teamId !== teamId && !map.has(opp.teamId)) {
        map.set(opp.teamId, opp);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.teamName ?? '').localeCompare(b.teamName ?? '')
    );
  }, [matches, teamId]);

  // Auto-select first opponent when switching to H2H
  useEffect(() => {
    if (tab === 'h2h' && !opponentId && opponents.length > 0) {
      setOpponentId(opponents[0].teamId);
    }
  }, [tab, opponentId, opponents]);

  useEffect(() => {
    if (!opponentId || !teamId) return;
    let cancelled = false;
    setH2hLoading(true);
    openLigaApi
      .getHeadToHeadMatches(teamId, opponentId)
      .then((res) => {
        if (cancelled) return;
        setH2hMatches(
          [...res].sort(
            (a, b) => (getKickoffDate(b)?.getTime() ?? 0) - (getKickoffDate(a)?.getTime() ?? 0)
          )
        );
      })
      .finally(() => {
        if (!cancelled) setH2hLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, opponentId]);

  const h2hStats = useMemo(
    () => (opponentId ? computeH2HStats(h2hMatches, teamId, opponentId) : null),
    [h2hMatches, teamId, opponentId]
  );

  const isFav = isFavoriteTeam(teamId);
  const selectedOpp = opponents.find((o) => o.teamId === opponentId);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0D10]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] pt-safe">
        <div className="px-3.5 h-14 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Zurück"
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <h1 className="text-sm font-extrabold text-slate-950 dark:text-white truncate">
            {team?.teamName || `Team #${teamId}`}
          </h1>

          <button
            type="button"
            onClick={() =>
              toggleFavoriteTeam({
                teamId,
                teamName: team?.teamName || `Team #${teamId}`,
                shortName: team?.shortName || team?.teamName || `Team #${teamId}`,
                teamIconUrl: team?.teamIconUrl ?? null,
                leagueShortcut: navState.leagueShortcut ?? matches[0]?.leagueShortcut ?? undefined,
                leagueSeason: navState.leagueSeason ?? matches[0]?.leagueSeason ?? undefined,
                leagueId: navState.leagueId ?? matches[0]?.leagueId ?? undefined,
              })
            }
            aria-label={isFav ? 'Entfolgen' : 'Folgen'}
            className={`px-3 h-9 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
              isFav
                ? 'bg-amber-500/15 dark:bg-[#C8FF00] text-amber-600 dark:text-black'
                : 'bg-slate-100 dark:bg-[#1B212B] text-slate-700 dark:text-slate-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
            <span>{isFav ? 'Folge ich' : 'Folgen'}</span>
          </button>
        </div>
      </header>

      {/* Club Hero */}
      <section className="px-4 py-5 bg-gradient-to-b from-white to-[#F3F5F8] dark:from-[#14181F] dark:to-[#0B0D10] border-b border-slate-200/80 dark:border-white/[0.06] flex flex-col items-center text-center gap-2.5">
        <TeamCrest
          src={team?.teamIconUrl}
          name={team?.teamName}
          tla={team?.tla}
          size="xl"
        />
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            {team?.teamName || `Team #${teamId}`}
          </h2>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {team?.shortName && <span>{team.shortName}</span>}
            {team?.tla && (
              <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 font-mono text-[10px] font-bold">
                {team.tla}
              </span>
            )}
            {team?.wikidataId && (
              <a
                href={`https://www.wikidata.org/wiki/${team.wikidataId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-[#C8FF00] hover:underline"
              >
                Wikidata <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
        {form.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-500">Form:</span>
            <FormBadges form={form} size="md" />
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="px-4 bg-white dark:bg-[#0B0D10] border-b border-slate-200/80 dark:border-white/[0.07] flex items-center gap-4">
        <button
          type="button"
          onClick={() => setTab('schedule')}
          className={`py-3 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-colors ${
            tab === 'schedule'
              ? 'border-emerald-600 dark:border-[#C8FF00] text-slate-950 dark:text-white'
              : 'border-transparent text-slate-500'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Spielplan & Ergebnisse</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('h2h')}
          className={`py-3 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-colors ${
            tab === 'h2h'
              ? 'border-emerald-600 dark:border-[#C8FF00] text-slate-950 dark:text-white'
              : 'border-transparent text-slate-500'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Direktvergleich (H2H)</span>
        </button>
      </div>

      <div className="px-3.5 py-4 space-y-4">
        {loading ? (
          <LeagueGroupSkeleton />
        ) : tab === 'schedule' ? (
          <div className="space-y-4 animate-fade-up">
            {/* Spotlights */}
            {nextSpotlight && (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-emerald-500/30 overflow-hidden">
                <div className="px-3.5 py-2 bg-emerald-500/10 text-emerald-700 dark:text-[#C8FF00] text-[11px] font-extrabold uppercase tracking-wider">
                  Nächstes Spiel
                </div>
                <MatchCard match={nextSpotlight} showLeagueBadge showDate />
              </div>
            )}

            {lastSpotlight && (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">
                  Letztes Ergebnis
                </div>
                <MatchCard match={lastSpotlight} showLeagueBadge showDate />
              </div>
            )}

            {upcomingMatches.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Kommende Spiele ({upcomingMatches.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {upcomingMatches.map((m) => (
                    <MatchCard key={m.matchID} match={m} showLeagueBadge showDate />
                  ))}
                </div>
              </section>
            )}

            {pastMatches.length > 0 && (
              <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Vergangene Ergebnisse ({pastMatches.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {pastMatches.map((m) => (
                    <MatchCard key={m.matchID} match={m} showLeagueBadge showDate />
                  ))}
                </div>
              </section>
            )}

            {matches.length === 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] p-8 text-center text-sm text-slate-500">
                Keine aktuellen Spiele für dieses Team im Zeitraum gefunden.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3.5 animate-fade-up">
            <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-3.5 space-y-2">
              <label className="text-xs font-bold text-slate-500 block">
                Gegner für Direktvergleich wählen
              </label>
              <select
                value={opponentId ?? ''}
                onChange={(e) => setOpponentId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0B0D10] border border-slate-200/80 dark:border-white/[0.08] text-sm font-bold"
              >
                {opponents.map((opp) => (
                  <option key={opp.teamId} value={opp.teamId}>
                    {opp.teamName}
                  </option>
                ))}
              </select>
            </div>

            {h2hLoading ? (
              <LeagueGroupSkeleton />
            ) : h2hStats && h2hStats.total > 0 ? (
              <>
                <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>{getDisplayTeamName(team)}</span>
                    <span>{h2hStats.total} Spiele</span>
                    <span>{getDisplayTeamName(selectedOpp)}</span>
                  </div>
                  <div className="grid grid-cols-3 text-center">
                    <div>
                      <p className="text-2xl font-black text-emerald-600 dark:text-[#00E676] tabular-nums">
                        {h2hStats.team1Wins}
                      </p>
                      <p className="text-[11px] text-slate-500">Siege</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-500 tabular-nums">
                        {h2hStats.draws}
                      </p>
                      <p className="text-[11px] text-slate-500">Remis</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-blue-500 tabular-nums">
                        {h2hStats.team2Wins}
                      </p>
                      <p className="text-[11px] text-slate-500">Siege</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {h2hMatches.slice(0, 20).map((hm) => (
                    <MatchCard key={hm.matchID} match={hm} showLeagueBadge showDate />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] p-8 text-center text-sm text-slate-500">
                Keine direkten Duelle gefunden.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
