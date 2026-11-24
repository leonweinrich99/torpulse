import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Medal,
  RefreshCw,
  Star,
  Table2,
  Users,
  CalendarDays,
} from 'lucide-react';
import { openLigaApi } from '../api/openligadb';
import { getCuratedLeague } from '../config/leagues';
import { useAppState } from '../context/AppStateContext';
import type {
  BlTableTeam,
  FormResult,
  GoalGetter,
  Group,
  League,
  Match,
  ResultInfo,
  Team,
} from '../types/openligadb';
import {
  computeSplitTable,
  computeTeamForm,
  enrichGoalGetters,
  getKickoffDate,
  groupMatchesByDay,
} from '../utils/matchUtils';
import { MatchCard } from '../components/MatchCard';
import { StandingsTable } from '../components/StandingsTable';
import { TeamCrest } from '../components/TeamCrest';
import { LeagueGroupSkeleton, TableSkeleton } from '../components/Skeletons';

type LeagueTab = 'matches' | 'table' | 'scorers' | 'teams' | 'info';
type TableSplit = 'all' | 'home' | 'away' | 'group';

export const LeagueDetailPage: React.FC = () => {
  const { shortcut: rawShortcut = 'bl1', season: rawSeason = '2026' } = useParams();
  const shortcut = decodeURIComponent(rawShortcut);
  const season = Number(rawSeason) || 2026;
  const navigate = useNavigate();
  const location = useLocation();
  const passedLeague = (location.state as { league?: League } | null)?.league;

  const { isFavoriteLeague, toggleFavoriteLeague, isFavoriteTeam, toggleFavoriteTeam } =
    useAppState();
  const curated = getCuratedLeague(shortcut);

  const [activeTab, setActiveTab] = useState<LeagueTab>('matches');
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([season]);
  const [leagueMeta, setLeagueMeta] = useState<League | null>(passedLeague ?? null);

  // Matches & matchdays
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupOrder, setSelectedGroupOrder] = useState<number | null>(null);
  const [matchdayMatches, setMatchdayMatches] = useState<Match[]>([]);
  const [seasonMatches, setSeasonMatches] = useState<Match[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [lastMatch, setLastMatch] = useState<Match | null>(null);

  // Standings, Scorers, Teams, Info
  const [tableRows, setTableRows] = useState<BlTableTeam[]>([]);
  const [groupTableRows, setGroupTableRows] = useState<BlTableTeam[]>([]);
  const [tableSplit, setTableSplit] = useState<TableSplit>('all');
  const [goalGetters, setGoalGetters] = useState<GoalGetter[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [resultInfos, setResultInfos] = useState<ResultInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Discover all available seasons for this league shortcut
  useEffect(() => {
    let cancelled = false;
    openLigaApi
      .getAvailableLeagues()
      .then((all) => {
        if (cancelled) return;
        const same = all.filter(
          (l) => (l.leagueShortcut ?? '').toLowerCase() === shortcut.toLowerCase()
        );
        const seasons = Array.from(
          new Set(same.map((l) => Number(l.leagueSeason)).filter((n) => !Number.isNaN(n) && n > 1990))
        ).sort((a, b) => b - a);
        if (seasons.length > 0) setAvailableSeasons(seasons);
        const matchMeta = same.find((l) => Number(l.leagueSeason) === season);
        if (matchMeta) setLeagueMeta(matchMeta);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shortcut, season]);

  // Core data loader for league + season
  const loadLeagueData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      try {
        const [
          groupsRes,
          currentGroupRes,
          tableRes,
          groupTableRes,
          scorersRes,
          teamsRes,
          seasonMatchesRes,
          nextRes,
          lastRes,
        ] = await Promise.all([
          openLigaApi.getAvailableGroups(shortcut, season, forceRefresh).catch(() => []),
          openLigaApi.getCurrentGroup(shortcut, forceRefresh).catch(() => null),
          openLigaApi.getTable(shortcut, season, forceRefresh).catch(() => []),
          openLigaApi.getGroupTable(shortcut, season, forceRefresh).catch(() => []),
          openLigaApi.getGoalGetters(shortcut, season, forceRefresh).catch(() => []),
          openLigaApi.getAvailableTeams(shortcut, season, forceRefresh).catch(() => []),
          openLigaApi.getSeasonMatches(shortcut, season, forceRefresh).catch(() => []),
          openLigaApi.getNextMatchByLeagueShortcut(shortcut).catch(() => null),
          openLigaApi.getLastMatchByLeagueShortcut(shortcut).catch(() => null),
        ]);

        const sortedGroups = [...groupsRes].sort((a, b) => a.groupOrderID - b.groupOrderID);
        setGroups(sortedGroups);
        setTableRows(Array.isArray(tableRes) ? tableRes : []);
        setGroupTableRows(Array.isArray(groupTableRes) ? groupTableRes : []);
        setGoalGetters(Array.isArray(scorersRes) ? scorersRes : []);
        setTeams(Array.isArray(teamsRes) ? teamsRes : []);
        setSeasonMatches(Array.isArray(seasonMatchesRes) ? seasonMatchesRes : []);
        setNextMatch(nextRes && nextRes.matchID ? nextRes : null);
        setLastMatch(lastRes && lastRes.matchID ? lastRes : null);

        const validOrder =
          currentGroupRes &&
          sortedGroups.some((g) => g.groupOrderID === currentGroupRes.groupOrderID)
            ? currentGroupRes.groupOrderID
            : sortedGroups[0]?.groupOrderID ?? 1;
        setSelectedGroupOrder(validOrder);

        const initialMatches = seasonMatchesRes.length
          ? seasonMatchesRes.filter((m) => m.group?.groupOrderID === validOrder)
          : await openLigaApi
              .getMatchdayMatches(shortcut, season, validOrder, forceRefresh)
              .catch(() => []);

        setMatchdayMatches(
          [...initialMatches].sort(
            (a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0)
          )
        );

        const resolvedLeagueId =
          leagueMeta?.leagueId ??
          seasonMatchesRes[0]?.leagueId ??
          initialMatches[0]?.leagueId;
        if (resolvedLeagueId) {
          openLigaApi
            .getResultInfos(resolvedLeagueId)
            .then((ri) => setResultInfos(Array.isArray(ri) ? ri : []))
            .catch(() => {});
        }
      } finally {
        setLoading(false);
      }
    },
    [shortcut, season, leagueMeta?.leagueId]
  );

  useEffect(() => {
    loadLeagueData(false);
  }, [loadLeagueData]);

  // Switch matchday cleanly without filter bar
  const selectGroup = async (orderId: number) => {
    setSelectedGroupOrder(orderId);
    if (seasonMatches.length > 0) {
      const subset = seasonMatches
        .filter((m) => m.group?.groupOrderID === orderId)
        .sort((a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0));
      setMatchdayMatches(subset);
      return;
    }
    setMatchesLoading(true);
    try {
      const data = await openLigaApi.getMatchdayMatches(shortcut, season, orderId);
      setMatchdayMatches(
        [...data].sort((a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0))
      );
    } finally {
      setMatchesLoading(false);
    }
  };

  const formMap = useMemo(() => {
    const map = new Map<number, FormResult[]>();
    if (!seasonMatches.length) return map;
    for (const row of tableRows) {
      const id = row.teamId || row.teamInfoId;
      map.set(id, computeTeamForm(seasonMatches, id, 5));
    }
    return map;
  }, [seasonMatches, tableRows]);

  const displayedTable = useMemo(() => {
    if (tableSplit === 'group' && groupTableRows.length > 0) return groupTableRows;
    if (tableSplit === 'home' && seasonMatches.length > 0) {
      return computeSplitTable(seasonMatches, 'home');
    }
    if (tableSplit === 'away' && seasonMatches.length > 0) {
      return computeSplitTable(seasonMatches, 'away');
    }
    if (tableRows.length > 0) return tableRows;
    if (seasonMatches.length > 0) return computeSplitTable(seasonMatches, 'all');
    return [];
  }, [tableSplit, tableRows, groupTableRows, seasonMatches]);

  const enrichedScorers = useMemo(
    () => enrichGoalGetters(goalGetters, seasonMatches),
    [goalGetters, seasonMatches]
  );

  const seasonStats = useMemo(() => {
    const finished = seasonMatches.filter((m) => m.matchIsFinished);
    let totalGoals = 0;
    let totalAttendance = 0;
    let attendanceMatches = 0;
    for (const m of finished) {
      const g = m.goals?.length ?? 0;
      totalGoals += g;
      if (m.numberOfViewers && m.numberOfViewers > 0) {
        totalAttendance += m.numberOfViewers;
        attendanceMatches += 1;
      }
    }
    return {
      totalMatches: seasonMatches.length,
      finishedMatches: finished.length,
      totalGoals,
      avgGoals: finished.length > 0 ? (totalGoals / finished.length).toFixed(2) : '–',
      avgAttendance:
        attendanceMatches > 0
          ? Math.round(totalAttendance / attendanceMatches).toLocaleString('de-DE')
          : null,
    };
  }, [seasonMatches]);

  const displayName =
    curated?.name || leagueMeta?.leagueName || seasonMatches[0]?.leagueName || shortcut.toUpperCase();
  const fav = isFavoriteLeague(shortcut);
  const currentGroupIdx = groups.findIndex((g) => g.groupOrderID === selectedGroupOrder);

  const TABS: { id: LeagueTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'matches', label: 'Spiele', icon: CalendarDays },
    { id: 'table', label: 'Tabelle', icon: Table2 },
    { id: 'scorers', label: 'Torjäger', icon: Medal },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'info', label: 'Infos', icon: Info },
  ];

  return (
    <div className="flex flex-col">
      {/* Header with iOS top blur clearance */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0B0D10]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] pt-safe">
        <div className="px-3.5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Zurück"
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center shrink-0 hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{curated?.flag || '⚽'}</span>
                <h1 className="text-[15px] font-black text-slate-950 dark:text-white truncate">
                  {displayName}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={season}
                  onChange={(e) =>
                    navigate(`/league/${encodeURIComponent(shortcut)}/${e.target.value}`, {
                      replace: true,
                    })
                  }
                  aria-label="Saison wählen"
                  className="bg-slate-100 dark:bg-[#1B212B] text-[11px] font-bold px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {availableSeasons.map((s) => (
                    <option key={s} value={s} className="bg-white dark:bg-[#14181F]">
                      Saison {s}/{String(s + 1).slice(-2)}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-mono text-slate-400 uppercase">{shortcut}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => loadLeagueData(true)}
              aria-label="Aktualisieren"
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center text-slate-700 dark:text-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => toggleFavoriteLeague(shortcut)}
              aria-label={fav ? 'Liga entfolgen' : 'Liga folgen'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                fav
                  ? 'bg-amber-500/15 dark:bg-[#C8FF00]/15 text-amber-500 dark:text-[#C8FF00]'
                  : 'bg-slate-100 dark:bg-[#1B212B] text-slate-500 dark:text-slate-300'
              }`}
            >
              <Star className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="px-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
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
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-3.5 py-4 space-y-4">
        {loading ? (
          activeTab === 'table' ? <TableSkeleton /> : <LeagueGroupSkeleton />
        ) : activeTab === 'matches' ? (
          <div className="space-y-3.5 animate-fade-up">
            {/* Clean Matchday Navigator (no extra filter bar) */}
            {groups.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={currentGroupIdx <= 0}
                  onClick={() =>
                    currentGroupIdx > 0 && selectGroup(groups[currentGroupIdx - 1].groupOrderID)
                  }
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center disabled:opacity-30"
                  aria-label="Vorheriger Spieltag"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  value={selectedGroupOrder ?? ''}
                  onChange={(e) => selectGroup(Number(e.target.value))}
                  aria-label="Spieltag wählen"
                  className="flex-1 text-center text-sm font-extrabold bg-transparent text-slate-950 dark:text-white focus:outline-none cursor-pointer"
                >
                  {groups.map((g) => (
                    <option
                      key={g.groupID}
                      value={g.groupOrderID}
                      className="bg-white dark:bg-[#14181F]"
                    >
                      {g.groupName}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={currentGroupIdx < 0 || currentGroupIdx >= groups.length - 1}
                  onClick={() =>
                    currentGroupIdx >= 0 &&
                    currentGroupIdx < groups.length - 1 &&
                    selectGroup(groups[currentGroupIdx + 1].groupOrderID)
                  }
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1B212B] flex items-center justify-center disabled:opacity-30"
                  aria-label="Nächster Spieltag"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Matches grouped by Weekday (e.g. Freitag, Samstag, Sonntag) without redundant matchday label */}
            {matchesLoading ? (
              <LeagueGroupSkeleton />
            ) : matchdayMatches.length > 0 ? (
              <div className="space-y-3">
                {groupMatchesByDay(matchdayMatches).map((dayGroup) => (
                  <div
                    key={dayGroup.dateKey}
                    className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden"
                  >
                    <div className="px-3.5 py-2 bg-slate-50/90 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        {dayGroup.fullLabel}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/[0.07] text-slate-600 dark:text-slate-400 tabular-nums">
                        {dayGroup.matches.length}{' '}
                        {dayGroup.matches.length === 1 ? 'Spiel' : 'Spiele'}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {dayGroup.matches.map((m) => (
                        <MatchCard key={m.matchID} match={m} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Keine Spiele für diesen Spieltag gefunden.
              </div>
            )}

            {/* Next / Last Match Spotlights */}
            {(nextMatch || lastMatch) && (
              <div className="grid grid-cols-1 gap-3 pt-1">
                {nextMatch && (
                  <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <div className="px-3.5 py-2 bg-emerald-500/10 text-emerald-700 dark:text-[#C8FF00] text-[11px] font-extrabold uppercase tracking-wider">
                      Nächstes Spiel der Liga
                    </div>
                    <MatchCard match={nextMatch} showDate />
                  </div>
                )}
                {lastMatch && (
                  <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <div className="px-3.5 py-2 bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">
                      Zuletzt beendet
                    </div>
                    <MatchCard match={lastMatch} showDate />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'table' ? (
          <div className="space-y-3 animate-fade-up">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'Gesamt' },
                  { id: 'home', label: 'Heimtabelle' },
                  { id: 'away', label: 'Auswärtstabelle' },
                  ...(groupTableRows.length > 0
                    ? [{ id: 'group' as const, label: 'Gruppentabelle' }]
                    : []),
                ] as { id: TableSplit; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTableSplit(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    tableSplit === s.id
                      ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black'
                      : 'bg-white dark:bg-[#14181F] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <StandingsTable
              rows={displayedTable}
              leagueShortcut={shortcut}
              leagueSeason={season}
              leagueId={leagueMeta?.leagueId}
              formMap={tableSplit === 'all' ? formMap : undefined}
            />
          </div>
        ) : activeTab === 'scorers' ? (
          <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden animate-fade-up">
            {enrichedScorers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Für diese Saison sind noch keine Torjägerdaten erfasst.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {enrichedScorers.slice(0, 50).map((player, idx) => {
                  const maxGoals = enrichedScorers[0]?.goalCount || 1;
                  const pct = Math.max(8, Math.round((player.goalCount / maxGoals) * 100));
                  return (
                    <div
                      key={`${player.goalGetterId}-${idx}`}
                      onClick={() => player.teamId && navigate(`/team/${player.teamId}`)}
                      className={`px-3.5 py-3 flex items-center gap-3 ${
                        player.teamId
                          ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                          : ''
                      }`}
                    >
                      <span
                        className={`w-6 text-center text-xs font-black tabular-nums ${
                          idx === 0
                            ? 'text-amber-500 dark:text-[#C8FF00]'
                            : idx < 3
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <TeamCrest
                        src={player.teamIconUrl}
                        name={player.teamName || player.goalGetterName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-950 dark:text-white truncate">
                            {player.goalGetterName || 'Unbekannt'}
                          </span>
                          <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-[#C8FF00]">
                            {player.goalCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {player.teamShortName || 'Torjäger'}
                            {player.penalties > 0 ? ` • ${player.penalties} Elfm.` : ''}
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-white/[0.06] mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#C8FF00]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'teams' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-fade-up">
            {teams.map((team) => {
              const isFav = isFavoriteTeam(team.teamId);
              return (
                <div
                  key={team.teamId}
                  className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-3 flex items-center gap-3"
                >
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/team/${team.teamId}`, {
                        state: {
                          team,
                          leagueShortcut: shortcut,
                          leagueSeason: season,
                          leagueId: leagueMeta?.leagueId,
                        },
                      })
                    }
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <TeamCrest
                      src={team.teamIconUrl}
                      name={team.teamName}
                      tla={team.tla}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-950 dark:text-white truncate">
                        {team.teamName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {team.shortName || ''}
                        {team.tla ? ` • ${team.tla}` : ''}
                      </p>
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
                        leagueShortcut: shortcut,
                        leagueSeason: season,
                        leagueId: leagueMeta?.leagueId,
                      })
                    }
                    aria-label={isFav ? 'Team entfolgen' : 'Team folgen'}
                    className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isFav
                          ? 'text-amber-500 dark:text-[#C8FF00] fill-current'
                          : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
            {teams.length === 0 && (
              <div className="col-span-full rounded-2xl bg-white dark:bg-[#14181F] p-8 text-center text-sm text-slate-500">
                Keine Teams für diese Saison gefunden.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3.5 animate-fade-up">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4">
                <p className="text-[11px] font-bold uppercase text-slate-500">Spiele beendet</p>
                <p className="text-2xl font-black tabular-nums mt-1 text-slate-950 dark:text-white">
                  {seasonStats.finishedMatches}
                  <span className="text-sm font-semibold text-slate-400">
                    /{seasonStats.totalMatches}
                  </span>
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4">
                <p className="text-[11px] font-bold uppercase text-slate-500">Tore (Ø / Spiel)</p>
                <p className="text-2xl font-black tabular-nums mt-1 text-emerald-600 dark:text-[#C8FF00]">
                  {seasonStats.totalGoals}{' '}
                  <span className="text-xs font-bold text-slate-400">({seasonStats.avgGoals})</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4">
                <p className="text-[11px] font-bold uppercase text-slate-500">Spieltage / Runden</p>
                <p className="text-2xl font-black tabular-nums mt-1 text-slate-950 dark:text-white">
                  {groups.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4">
                <p className="text-[11px] font-bold uppercase text-slate-500">Ø Zuschauer</p>
                <p className="text-2xl font-black tabular-nums mt-1 text-slate-950 dark:text-white">
                  {seasonStats.avgAttendance || '–'}
                </p>
              </div>
            </div>

            {resultInfos.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Konfigurierte Ergebnistypen (OpenLigaDB)
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {resultInfos.map((ri) => (
                    <div key={ri.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{ri.name}</p>
                        {ri.description && (
                          <p className="text-slate-500 text-[11px]">{ri.description}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1B212B] font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        {ri.globalResultInfo?.kind || `ID ${ri.resultTypeID ?? ri.id}`}
                      </span>
                    </div>
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
