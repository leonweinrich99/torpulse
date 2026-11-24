import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Info,
  MapPin,
  RefreshCw,
  Share2,
  Swords,
  Table2,
  Users,
  Check,
  Goal as GoalIcon,
} from 'lucide-react';
import { openLigaApi } from '../api/openligadb';
import { useAppState } from '../context/AppStateContext';
import type { BlTableTeam, Match, ResultInfo } from '../types/openligadb';
import {
  buildGoalTimeline,
  computeH2HStats,
  deriveMatchScore,
  formatAttendance,
  formatCountdown,
  formatFullDateTime,
  getDisplayTeamName,
  getKickoffDate,
} from '../utils/matchUtils';
import { TeamCrest } from '../components/TeamCrest';
import { StandingsTable } from '../components/StandingsTable';
import { MatchCard } from '../components/MatchCard';

type MatchTab = 'overview' | 'h2h' | 'table' | 'info';

export const MatchDetailPage: React.FC = () => {
  const { matchId: rawId } = useParams();
  const matchId = Number(rawId);
  const navigate = useNavigate();
  const location = useLocation();
  const initialMatch = (location.state as { match?: Match } | null)?.match ?? null;
  const { refreshIntervalSec } = useAppState();

  const [match, setMatch] = useState<Match | null>(initialMatch);
  const [h2hMatches, setH2hMatches] = useState<Match[]>([]);
  const [tableRows, setTableRows] = useState<BlTableTeam[]>([]);
  const [resultInfos, setResultInfos] = useState<ResultInfo[]>([]);
  const [activeTab, setActiveTab] = useState<MatchTab>('overview');
  const [loading, setLoading] = useState(!initialMatch);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const fetchMatch = useCallback(
    async (force = false) => {
      if (!matchId) return;
      if (force) setRefreshing(true);
      try {
        const data = await openLigaApi.getMatchById(matchId, force);
        if (data && data.matchID) {
          setMatch(data);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [matchId]
  );

  useEffect(() => {
    fetchMatch(false);
  }, [fetchMatch]);

  // Fetch contextual data (H2H, league standings, resultInfos) once match is loaded
  useEffect(() => {
    if (!match) return;
    let cancelled = false;

    const t1 = match.team1?.teamId;
    const t2 = match.team2?.teamId;
    if (t1 && t2) {
      openLigaApi
        .getHeadToHeadMatches(t1, t2)
        .then((list) => {
          if (cancelled) return;
          const sorted = [...list].sort(
            (a, b) => (getKickoffDate(b)?.getTime() ?? 0) - (getKickoffDate(a)?.getTime() ?? 0)
          );
          setH2hMatches(sorted);
        })
        .catch(() => {});
    }

    if (match.leagueShortcut && match.leagueSeason) {
      openLigaApi
        .getTable(match.leagueShortcut, match.leagueSeason)
        .then((rows) => {
          if (!cancelled) setTableRows(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {});
    }

    if (match.leagueId) {
      openLigaApi
        .getResultInfos(match.leagueId)
        .then((ri) => {
          if (!cancelled) setResultInfos(Array.isArray(ri) ? ri : []);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [match?.matchID, match?.team1?.teamId, match?.team2?.teamId, match?.leagueShortcut, match?.leagueSeason, match?.leagueId]);

  const derived = useMemo(
    () => (match ? deriveMatchScore(match, nowMs) : null),
    [match, nowMs]
  );

  // Auto-refresh live match every refreshIntervalSec
  useEffect(() => {
    if (!derived || (derived.status !== 'live' && derived.status !== 'halftime')) return;
    const interval = Math.max(20, refreshIntervalSec || 30) * 1000;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      fetchMatch(true);
    }, interval);
    return () => window.clearInterval(id);
  }, [derived?.status, refreshIntervalSec, fetchMatch]);

  const timeline = useMemo(() => (match ? buildGoalTimeline(match) : []), [match]);
  const h2hStats = useMemo(() => {
    if (!match?.team1 || !match?.team2) return null;
    return computeH2HStats(h2hMatches, match.team1.teamId, match.team2.teamId);
  }, [h2hMatches, match?.team1, match?.team2]);

  const handleShare = async () => {
    if (!match) return;
    const title = `${getDisplayTeamName(match.team1)} vs. ${getDisplayTeamName(match.team2)} | TorPulse`;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading && !match) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Lade Match Center...
      </div>
    );
  }

  if (!match || !derived) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-slate-500">Spiel nicht gefunden.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black text-xs font-bold"
        >
          Zurück zu den Spielen
        </button>
      </div>
    );
  }

  const kickoff = getKickoffDate(match);
  const countdown = kickoff && derived.status === 'upcoming' ? formatCountdown(kickoff, nowMs) : null;
  const isLive = derived.status === 'live' || derived.status === 'halftime';
  const attendance = formatAttendance(match.numberOfViewers);

  const openTeam = (team: Match['team1']) => {
    if (!team) return;
    navigate(`/team/${team.teamId}`, {
      state: {
        team,
        leagueShortcut: match.leagueShortcut,
        leagueSeason: match.leagueSeason,
        leagueId: match.leagueId,
      },
    });
  };

  const TABS: { id: MatchTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Ticker & Tore', icon: GoalIcon },
    { id: 'h2h', label: `H2H (${h2hStats?.total ?? 0})`, icon: Swords },
    { id: 'table', label: 'Tabelle', icon: Table2 },
    { id: 'info', label: 'Infos', icon: Info },
  ];

  return (
    <div className="flex flex-col">
      {/* Top Bar */}
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

          <button
            type="button"
            onClick={() =>
              match.leagueShortcut &&
              navigate(`/league/${encodeURIComponent(match.leagueShortcut)}/${match.leagueSeason}`)
            }
            className="min-w-0 text-center"
          >
            <p className="text-xs font-extrabold text-slate-950 dark:text-white truncate">
              {match.leagueName}
            </p>
            {match.group?.groupName && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {match.group.groupName}
              </p>
            )}
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchMatch(true)}
              aria-label="Spiel aktualisieren"
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Spiel teilen"
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Scoreboard Hero */}
      <section className="px-4 pt-5 pb-4 bg-gradient-to-b from-white via-white to-[#F3F5F8] dark:from-[#14181F] dark:via-[#11151C] dark:to-[#0B0D10] border-b border-slate-200/80 dark:border-white/[0.06]">
        {/* Status Pill */}
        <div className="flex justify-center mb-4">
          {isLive ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-[#00E676] text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-[#00E676] animate-live-dot" />
              <span>
                {derived.status === 'halftime' ? 'HALBZEIT' : `LIVE • ${derived.statusLabel}`}
              </span>
            </div>
          ) : derived.status === 'finished' ? (
            <span className="px-3 py-1 rounded-full bg-slate-200/80 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 text-[11px] font-extrabold uppercase tracking-wider">
              {derived.penalties
                ? 'Beendet n. Elfmeterschießen'
                : derived.extraTime
                ? 'Beendet n. Verlängerung'
                : 'Beendet'}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-slate-300 text-[11px] font-bold">
              {countdown ? `Anpfiff ${countdown}` : 'Angesetzt'}
            </span>
          )}
        </div>

        {/* Teams + Score Grid */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Home Team */}
          <button
            type="button"
            onClick={() => openTeam(match.team1)}
            className="flex flex-col items-center gap-2 group"
          >
            <TeamCrest
              src={match.team1?.teamIconUrl}
              name={match.team1?.teamName}
              tla={match.team1?.tla}
              size="xl"
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-xs sm:text-sm font-extrabold text-center text-slate-950 dark:text-white leading-tight line-clamp-2">
              {match.team1?.teamName}
            </span>
          </button>

          {/* Center Score */}
          <div className="flex flex-col items-center px-2">
            {derived.status === 'upcoming' ? (
              <div className="text-center">
                <div className="text-2xl font-black tabular-nums text-slate-950 dark:text-white">
                  {derived.statusLabel}
                </div>
                {kickoff && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {kickoff.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  className={`text-4xl sm:text-5xl font-black tracking-tight tabular-nums flex items-center gap-2 ${
                    isLive ? 'text-emerald-600 dark:text-[#00E676]' : 'text-slate-950 dark:text-white'
                  }`}
                >
                  <span>{derived.team1Score}</span>
                  <span className="text-2xl opacity-40">:</span>
                  <span>{derived.team2Score}</span>
                </div>
                {derived.halfTimeTeam1 !== null && derived.halfTimeTeam2 !== null && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums mt-1">
                    HZ {derived.halfTimeTeam1} : {derived.halfTimeTeam2}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Away Team */}
          <button
            type="button"
            onClick={() => openTeam(match.team2)}
            className="flex flex-col items-center gap-2 group"
          >
            <TeamCrest
              src={match.team2?.teamIconUrl}
              name={match.team2?.teamName}
              tla={match.team2?.tla}
              size="xl"
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-xs sm:text-sm font-extrabold text-center text-slate-950 dark:text-white leading-tight line-clamp-2">
              {match.team2?.teamName}
            </span>
          </button>
        </div>

        {/* Venue & Date Strip */}
        <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          {kickoff && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatFullDateTime(kickoff)}
            </span>
          )}
          {match.location?.locationStadium && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {match.location.locationStadium}
              {match.location.locationCity ? `, ${match.location.locationCity}` : ''}
            </span>
          )}
          {attendance && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {attendance}
            </span>
          )}
        </div>
      </section>

      {/* Match Center Tabs */}
      <div className="sticky top-14 z-20 bg-white/95 dark:bg-[#0B0D10]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] px-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-2.5 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-emerald-600 dark:border-[#C8FF00] text-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="px-3.5 py-4 space-y-4">
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-fade-up">
            {/* Goal Timeline */}
            <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Torfolge & Ereignisse
                </h2>
                <span className="text-[11px] font-bold text-slate-400">
                  {timeline.length} {timeline.length === 1 ? 'Tor' : 'Tore'}
                </span>
              </div>

              {timeline.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {derived.status === 'upcoming'
                    ? 'Noch keine Ereignisse – Spiel wurde noch nicht angepfiffen.'
                    : 'Keine Tore in diesem Spiel erfasst.'}
                </div>
              ) : (
                <div className="p-4 relative">
                  {/* Center vertical pitch line */}
                  <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-slate-200 dark:bg-white/[0.08]" />

                  <div className="space-y-3.5">
                    {timeline.map((g) => (
                      <div
                        key={g.goalID}
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 relative"
                      >
                        {/* Home side */}
                        <div className="text-right pr-1">
                          {g.side === 'home' && (
                            <div className="inline-flex flex-col items-end">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-950 dark:text-white">
                                  {g.goalGetterName || 'Torschütze'}
                                </span>
                                <span className="text-xs">⚽</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {g.isPenalty && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                                    Elfm.
                                  </span>
                                )}
                                {g.isOwnGoal && (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 font-bold">
                                    ET
                                  </span>
                                )}
                                {g.comment && <span className="italic">{g.comment}</span>}
                                <span className="font-mono font-bold tabular-nums">
                                  ({g.scoreTeam1}:{g.scoreTeam2})
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Center Minute Pill */}
                        <div className="z-10 min-w-[44px] px-2 py-1 rounded-full bg-slate-100 dark:bg-[#1E2530] border border-slate-200 dark:border-white/[0.1] text-center text-[11px] font-black tabular-nums text-slate-800 dark:text-[#C8FF00]">
                          {g.minuteLabel}
                        </div>

                        {/* Away side */}
                        <div className="text-left pl-1">
                          {g.side === 'away' && (
                            <div className="inline-flex flex-col items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">⚽</span>
                                <span className="text-sm font-bold text-slate-950 dark:text-white">
                                  {g.goalGetterName || 'Torschütze'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-mono font-bold tabular-nums">
                                  ({g.scoreTeam1}:{g.scoreTeam2})
                                </span>
                                {g.isPenalty && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                                    Elfm.
                                  </span>
                                )}
                                {g.isOwnGoal && (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 font-bold">
                                    ET
                                  </span>
                                )}
                                {g.comment && <span className="italic">{g.comment}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* All Match Results Breakdown */}
            {match.matchResults && match.matchResults.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Zwischen- & Endergebnisse
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {[...match.matchResults]
                    .sort((a, b) => a.resultOrderID - b.resultOrderID)
                    .map((r) => (
                      <div
                        key={r.resultID}
                        className="py-2 flex items-center justify-between text-sm"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {r.resultName}
                          </span>
                          {r.resultDescription && (
                            <p className="text-[11px] text-slate-400">{r.resultDescription}</p>
                          )}
                        </div>
                        <span className="font-black tabular-nums text-slate-950 dark:text-[#C8FF00]">
                          {r.pointsTeam1} : {r.pointsTeam2}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'h2h' && (
          <div className="space-y-3.5 animate-fade-up">
            {h2hStats && h2hStats.total > 0 ? (
              <>
                <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>{getDisplayTeamName(match.team1)}</span>
                    <span>{h2hStats.total} Duelle</span>
                    <span>{getDisplayTeamName(match.team2)}</span>
                  </div>

                  <div className="grid grid-cols-3 text-center">
                    <div>
                      <p className="text-2xl font-black tabular-nums text-emerald-600 dark:text-[#00E676]">
                        {h2hStats.team1Wins}
                      </p>
                      <p className="text-[11px] text-slate-500">Siege</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black tabular-nums text-slate-500">
                        {h2hStats.draws}
                      </p>
                      <p className="text-[11px] text-slate-500">Remis</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black tabular-nums text-blue-500">
                        {h2hStats.team2Wins}
                      </p>
                      <p className="text-[11px] text-slate-500">Siege</p>
                    </div>
                  </div>

                  {/* Proportional H2H Bar */}
                  <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10">
                    <div
                      className="bg-emerald-500 dark:bg-[#00E676]"
                      style={{ width: `${(h2hStats.team1Wins / h2hStats.total) * 100}%` }}
                    />
                    <div
                      className="bg-slate-400 dark:bg-slate-600"
                      style={{ width: `${(h2hStats.draws / h2hStats.total) * 100}%` }}
                    />
                    <div
                      className="bg-blue-500"
                      style={{ width: `${(h2hStats.team2Wins / h2hStats.total) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="font-bold tabular-nums">{h2hStats.team1Goals} Tore</span>
                    <span>Torbilanz</span>
                    <span className="font-bold tabular-nums">{h2hStats.team2Goals} Tore</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {h2hMatches.slice(0, 20).map((hm) => (
                    <MatchCard key={hm.matchID} match={hm} showLeagueBadge showDate />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-8 text-center text-sm text-slate-500">
                Keine historischen Direktvergleiche in OpenLigaDB vorhanden.
              </div>
            )}
          </div>
        )}

        {activeTab === 'table' && (
          <div className="animate-fade-up">
            <StandingsTable
              rows={tableRows}
              leagueShortcut={match.leagueShortcut || 'bl1'}
              leagueSeason={match.leagueSeason || 2026}
              leagueId={match.leagueId}
              highlightTeamIds={[match.team1?.teamId ?? -1, match.team2?.teamId ?? -1]}
              compact
            />
          </div>
        )}

        {activeTab === 'info' && (
          <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3 text-sm animate-fade-up">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
              <span className="text-slate-500">Match-ID</span>
              <span className="font-mono font-bold">{match.matchID}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
              <span className="text-slate-500">Wettbewerb</span>
              <span className="font-semibold text-right">{match.leagueName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
              <span className="text-slate-500">Spieltag</span>
              <span className="font-semibold">{match.group?.groupName || '–'}</span>
            </div>
            {match.location?.locationStadium && (
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                <span className="text-slate-500">Stadion</span>
                <span className="font-semibold text-right">
                  {match.location.locationStadium}
                  {match.location.locationCity ? ` (${match.location.locationCity})` : ''}
                </span>
              </div>
            )}
            {attendance && (
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                <span className="text-slate-500">Zuschauer</span>
                <span className="font-semibold tabular-nums">{attendance}</span>
              </div>
            )}
            {match.lastUpdateDateTime && (
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Letztes Update
                </span>
                <span className="font-semibold tabular-nums text-xs">
                  {new Date(match.lastUpdateDateTime).toLocaleString('de-DE')}
                </span>
              </div>
            )}
            {resultInfos.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-extrabold uppercase text-slate-500 mb-2">
                  Liga-Ergebnisregeln
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resultInfos.map((ri) => (
                    <span
                      key={ri.id}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1B212B] text-xs font-semibold"
                    >
                      {ri.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
