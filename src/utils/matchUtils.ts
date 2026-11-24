import type {
  BlTableTeam,
  DerivedMatchScore,
  FormResult,
  Goal,
  GoalGetter,
  Match,
  MatchResult,
} from '../types/openligadb';

export function getKickoffDate(match: Match): Date | null {
  const iso = match.matchDateTimeUTC || match.matchDateTime;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickPrimaryResult(results: MatchResult[]): MatchResult | null {
  if (!results.length) return null;
  const byKind = (kind: string) =>
    results.find((r) => r.resultTypeKind === kind && r.pointsTeam1 !== null && r.pointsTeam2 !== null);

  // Prefer final progression: Penalties > ExtraTime > After90Minutes > highest orderID
  return (
    byKind('AfterPenalties') ||
    byKind('AfterExtraTime') ||
    byKind('After90Minutes') ||
    results.find((r) => r.resultTypeID === 2 && r.pointsTeam1 !== null && r.pointsTeam2 !== null) ||
    [...results]
      .filter((r) => r.pointsTeam1 !== null && r.pointsTeam2 !== null)
      .sort((a, b) => (b.resultOrderID ?? 0) - (a.resultOrderID ?? 0))[0] ||
    null
  );
}

function pickHalfTimeResult(results: MatchResult[]): MatchResult | null {
  return (
    results.find((r) => r.resultTypeKind === 'HalfTime') ||
    results.find((r) => r.resultTypeID === 1) ||
    results.find((r) => (r.resultName ?? '').toLowerCase().includes('halbzeit')) ||
    null
  );
}

export function deriveMatchScore(match: Match, nowMs: number = Date.now()): DerivedMatchScore {
  const results = match.matchResults ?? [];
  const goals = match.goals ?? [];
  const kickoff = getKickoffDate(match);
  const kickoffMs = kickoff ? kickoff.getTime() : null;

  const primary = pickPrimaryResult(results);
  const halfTime = pickHalfTimeResult(results);
  const extraTime = results.some(
    (r) => r.resultTypeKind === 'AfterExtraTime' || r.resultTypeID === 4
  );
  const penalties = results.some(
    (r) => r.resultTypeKind === 'AfterPenalties' || r.resultTypeID === 5
  );

  // Determine latest score from results or goals
  let team1Score: number | null = primary?.pointsTeam1 ?? null;
  let team2Score: number | null = primary?.pointsTeam2 ?? null;

  if (goals.length > 0) {
    const sortedGoals = [...goals].sort((a, b) => {
      const mDiff = (a.matchMinute ?? 0) - (b.matchMinute ?? 0);
      if (mDiff !== 0) return mDiff;
      return (a.goalID ?? 0) - (b.goalID ?? 0);
    });
    const lastGoal = sortedGoals[sortedGoals.length - 1];
    if (team1Score === null && lastGoal.scoreTeam1 !== null) {
      team1Score = lastGoal.scoreTeam1;
      team2Score = lastGoal.scoreTeam2;
    }
  }

  const halfTimeTeam1 = halfTime?.pointsTeam1 ?? null;
  const halfTimeTeam2 = halfTime?.pointsTeam2 ?? null;

  // 1. Finished match
  if (match.matchIsFinished) {
    let statusLabel = 'FT';
    if (penalties) statusLabel = 'n.E.';
    else if (extraTime) statusLabel = 'n.V.';
    return {
      status: 'finished',
      liveMinute: null,
      team1Score: team1Score ?? 0,
      team2Score: team2Score ?? 0,
      halfTimeTeam1,
      halfTimeTeam2,
      extraTime,
      penalties,
      statusLabel,
    };
  }

  // 2. Live detection: kickoff has passed and within plausible live window (<= 170 min), OR has goals/results without matchIsFinished
  const elapsedMin = kickoffMs !== null ? Math.floor((nowMs - kickoffMs) / 60_000) : null;
  const hasLiveData = goals.length > 0 || primary !== null || halfTime !== null;
  const isInLiveWindow = elapsedMin !== null && elapsedMin >= 0 && elapsedMin <= 170;

  if (isInLiveWindow || (hasLiveData && elapsedMin !== null && elapsedMin >= -5 && elapsedMin <= 240)) {
    const safeElapsed = Math.max(1, elapsedMin ?? 1);
    const isHalftimeWindow =
      (halfTime !== null && safeElapsed >= 45 && safeElapsed <= 63 && !primary) ||
      (safeElapsed >= 47 && safeElapsed <= 60 && halfTime !== null && goals.every((g) => (g.matchMinute ?? 0) <= 45));

    if (isHalftimeWindow) {
      return {
        status: 'halftime',
        liveMinute: 45,
        team1Score: team1Score ?? halfTimeTeam1 ?? 0,
        team2Score: team2Score ?? halfTimeTeam2 ?? 0,
        halfTimeTeam1,
        halfTimeTeam2,
        extraTime,
        penalties,
        statusLabel: 'HZ',
      };
    }

    // Estimate match minute accounting for 15-min halftime break
    let estMinute = safeElapsed;
    if (safeElapsed > 60) {
      estMinute = Math.min(120, safeElapsed - 15);
    } else if (safeElapsed > 45) {
      estMinute = 45;
    }

    const maxGoalMinute = goals.reduce((acc, g) => Math.max(acc, g.matchMinute ?? 0), 0);
    const liveMinute = Math.max(estMinute, maxGoalMinute);

    return {
      status: 'live',
      liveMinute,
      team1Score: team1Score ?? halfTimeTeam1 ?? 0,
      team2Score: team2Score ?? halfTimeTeam2 ?? 0,
      halfTimeTeam1,
      halfTimeTeam2,
      extraTime,
      penalties,
      statusLabel: `${liveMinute}'`,
    };
  }

  // 3. Upcoming match
  return {
    status: 'upcoming',
    liveMinute: null,
    team1Score: null,
    team2Score: null,
    halfTimeTeam1: null,
    halfTimeTeam2: null,
    extraTime: false,
    penalties: false,
    statusLabel: kickoff ? formatKickoffTime(kickoff) : 'TBD',
  };
}

export function resolveGoalSide(
  goal: Goal,
  prevScore1: number,
  prevScore2: number,
  team1Id?: number,
  team2Id?: number
): 'home' | 'away' {
  if (goal.scoringTeamId !== null && goal.scoringTeamId !== undefined) {
    if (team1Id !== undefined && goal.scoringTeamId === team1Id) return 'home';
    if (team2Id !== undefined && goal.scoringTeamId === team2Id) return 'away';
  }
  const s1 = goal.scoreTeam1 ?? prevScore1;
  const s2 = goal.scoreTeam2 ?? prevScore2;
  if (s1 > prevScore1) return 'home';
  if (s2 > prevScore2) return 'away';
  return 'home';
}

export interface TimelineGoal extends Goal {
  side: 'home' | 'away';
  minuteLabel: string;
}

export function buildGoalTimeline(match: Match): TimelineGoal[] {
  const goals = [...(match.goals ?? [])].sort((a, b) => {
    const mDiff = (a.matchMinute ?? 999) - (b.matchMinute ?? 999);
    if (mDiff !== 0) return mDiff;
    const sDiff = ((a.scoreTeam1 ?? 0) + (a.scoreTeam2 ?? 0)) - ((b.scoreTeam1 ?? 0) + (b.scoreTeam2 ?? 0));
    if (sDiff !== 0) return sDiff;
    return (a.goalID ?? 0) - (b.goalID ?? 0);
  });

  let prev1 = 0;
  let prev2 = 0;
  const t1Id = match.team1?.teamId;
  const t2Id = match.team2?.teamId;

  return goals.map((g) => {
    const side = resolveGoalSide(g, prev1, prev2, t1Id, t2Id);
    if (g.scoreTeam1 !== null) prev1 = g.scoreTeam1;
    if (g.scoreTeam2 !== null) prev2 = g.scoreTeam2;

    let minuteLabel = g.matchMinute ? `${g.matchMinute}'` : '•';
    if (g.isOvertime && g.matchMinute) {
      if (g.matchMinute > 90) minuteLabel = `90+${g.matchMinute - 90}'`;
      else if (g.matchMinute > 45 && g.matchMinute < 55) minuteLabel = `45+${g.matchMinute - 45}'`;
      else minuteLabel = `${g.matchMinute}'+`;
    }

    return {
      ...g,
      side,
      minuteLabel,
    };
  });
}

export function computeTeamForm(
  matches: Match[],
  teamId: number,
  limit = 5
): FormResult[] {
  const finished = matches
    .filter(
      (m) =>
        m.matchIsFinished &&
        (m.team1?.teamId === teamId || m.team2?.teamId === teamId)
    )
    .sort((a, b) => {
      const da = getKickoffDate(a)?.getTime() ?? 0;
      const db = getKickoffDate(b)?.getTime() ?? 0;
      return db - da;
    })
    .slice(0, limit)
    .reverse();

  return finished.map((m) => {
    const score = deriveMatchScore(m);
    const isHome = m.team1?.teamId === teamId;
    const myGoals = isHome ? (score.team1Score ?? 0) : (score.team2Score ?? 0);
    const oppGoals = isHome ? (score.team2Score ?? 0) : (score.team1Score ?? 0);
    if (myGoals > oppGoals) return 'W';
    if (myGoals < oppGoals) return 'L';
    return 'D';
  });
}

export function computeSplitTable(
  matches: Match[],
  mode: 'all' | 'home' | 'away'
): BlTableTeam[] {
  const map = new Map<number, BlTableTeam>();

  const ensureTeam = (team: Match['team1']) => {
    if (!team) return null;
    let row = map.get(team.teamId);
    if (!row) {
      row = {
        teamInfoId: team.teamId,
        teamId: team.teamId,
        teamName: team.teamName,
        shortName: team.shortName,
        teamIconUrl: team.teamIconUrl,
        tla: team.tla,
        wikidataId: team.wikidataId,
        points: 0,
        goals: 0,
        opponentGoals: 0,
        matches: 0,
        won: 0,
        draw: 0,
        lost: 0,
        goalDiff: 0,
      };
      map.set(team.teamId, row);
    }
    return row;
  };

  for (const m of matches) {
    if (!m.team1 || !m.team2) continue;
    const t1 = ensureTeam(m.team1);
    const t2 = ensureTeam(m.team2);
    if (!m.matchIsFinished || !t1 || !t2) continue;

    const score = deriveMatchScore(m);
    if (score.team1Score === null || score.team2Score === null) continue;
    const g1 = score.team1Score;
    const g2 = score.team2Score;

    if (mode === 'all' || mode === 'home') {
      t1.matches += 1;
      t1.goals += g1;
      t1.opponentGoals += g2;
      t1.goalDiff = t1.goals - t1.opponentGoals;
      if (g1 > g2) {
        t1.won += 1;
        t1.points += 3;
      } else if (g1 === g2) {
        t1.draw += 1;
        t1.points += 1;
      } else {
        t1.lost += 1;
      }
    }

    if (mode === 'all' || mode === 'away') {
      t2.matches += 1;
      t2.goals += g2;
      t2.opponentGoals += g1;
      t2.goalDiff = t2.goals - t2.opponentGoals;
      if (g2 > g1) {
        t2.won += 1;
        t2.points += 3;
      } else if (g2 === g1) {
        t2.draw += 1;
        t2.points += 1;
      } else {
        t2.lost += 1;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goals !== a.goals) return b.goals - a.goals;
    return (a.teamName ?? '').localeCompare(b.teamName ?? '');
  });
}

export interface H2HStats {
  total: number;
  team1Wins: number;
  draws: number;
  team2Wins: number;
  team1Goals: number;
  team2Goals: number;
}

export function computeH2HStats(
  matches: Match[],
  team1Id: number,
  team2Id: number
): H2HStats {
  const stats: H2HStats = {
    total: 0,
    team1Wins: 0,
    draws: 0,
    team2Wins: 0,
    team1Goals: 0,
    team2Goals: 0,
  };

  for (const m of matches) {
    if (!m.matchIsFinished) continue;
    const score = deriveMatchScore(m);
    if (score.team1Score === null || score.team2Score === null) continue;

    let g1 = 0;
    let g2 = 0;
    if (m.team1?.teamId === team1Id && m.team2?.teamId === team2Id) {
      g1 = score.team1Score;
      g2 = score.team2Score;
    } else if (m.team1?.teamId === team2Id && m.team2?.teamId === team1Id) {
      g1 = score.team2Score;
      g2 = score.team1Score;
    } else {
      continue;
    }

    stats.total += 1;
    stats.team1Goals += g1;
    stats.team2Goals += g2;
    if (g1 > g2) stats.team1Wins += 1;
    else if (g2 > g1) stats.team2Wins += 1;
    else stats.draws += 1;
  }

  return stats;
}

export interface EnrichedGoalGetter extends GoalGetter {
  teamId?: number;
  teamName?: string;
  teamShortName?: string;
  teamIconUrl?: string | null;
  penalties: number;
}

export function enrichGoalGetters(
  goalGetters: GoalGetter[],
  seasonMatches: Match[]
): EnrichedGoalGetter[] {
  const playerTeamMap = new Map<
    number,
    {
      teamId: number;
      teamName: string;
      teamShortName: string;
      teamIconUrl: string | null;
      penalties: number;
    }
  >();

  for (const m of seasonMatches) {
    const timeline = buildGoalTimeline(m);
    for (const g of timeline) {
      if (g.isOwnGoal) continue;
      const team = g.side === 'home' ? m.team1 : m.team2;
      if (!team) continue;
      const existing = playerTeamMap.get(g.goalGetterID);
      playerTeamMap.set(g.goalGetterID, {
        teamId: team.teamId,
        teamName: team.teamName ?? '',
        teamShortName: team.shortName || team.teamName || '',
        teamIconUrl: team.teamIconUrl ?? null,
        penalties: (existing?.penalties ?? 0) + (g.isPenalty ? 1 : 0),
      });
    }
  }

  return goalGetters.map((gg) => {
    const info = playerTeamMap.get(gg.goalGetterId);
    return {
      ...gg,
      teamId: info?.teamId,
      teamName: info?.teamName,
      teamShortName: info?.teamShortName,
      teamIconUrl: info?.teamIconUrl,
      penalties: info?.penalties ?? 0,
    };
  });
}

// Date formatting utilities (German locale)
export function formatKickoffTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatFullDateTime(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return toLocalDateKey(a) === toLocalDateKey(b);
}

export interface DateStripItem {
  key: string;
  date: Date;
  dayShort: string;
  dayNum: string;
  label: string;
  isToday: boolean;
}

export function generateDateStrip(centerDate: Date = new Date(), radius = 7): DateStripItem[] {
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterdayKey = toLocalDateKey(yesterday);
  const tomorrowKey = toLocalDateKey(tomorrow);

  const items: DateStripItem[] = [];
  for (let offset = -radius; offset <= radius; offset++) {
    const d = new Date(centerDate);
    d.setDate(centerDate.getDate() + offset);
    const key = toLocalDateKey(d);
    let label = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    if (key === todayKey) label = 'Heute';
    else if (key === yesterdayKey) label = 'Gestern';
    else if (key === tomorrowKey) label = 'Morgen';

    items.push({
      key,
      date: d,
      dayShort: d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
      dayNum: String(d.getDate()).padStart(2, '0'),
      label,
      isToday: key === todayKey,
    });
  }
  return items;
}

export function formatCountdown(kickoff: Date, nowMs: number = Date.now()): string | null {
  const diffMs = kickoff.getTime() - nowMs;
  if (diffMs <= 0) return null;
  const totalMin = Math.floor(diffMs / 60_000);
  if (totalMin < 60) return `in ${totalMin} Min.`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return `in ${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

export function formatAttendance(viewers: number | null | undefined): string | null {
  if (!viewers || viewers <= 0) return null;
  return `${viewers.toLocaleString('de-DE')} Zuschauer`;
}

export function getDisplayTeamName(
  team: { shortName?: string | null; teamName?: string | null } | null | undefined,
  preferShort = true
): string {
  if (!team) return 'Unbekannt';
  if (preferShort && team.shortName && team.shortName.trim().length > 0) {
    return team.shortName.trim();
  }
  return team.teamName?.trim() || team.shortName?.trim() || 'Unbekannt';
}

export interface MatchDayGroup {
  dateKey: string;
  weekday: string;
  dateLabel: string;
  fullLabel: string;
  matches: Match[];
}

/**
 * Groups matches chronologically by local calendar day (e.g. Freitag, Samstag, Sonntag).
 */
export function groupMatchesByDay(matches: Match[]): MatchDayGroup[] {
  const sorted = [...matches].sort(
    (a, b) => (getKickoffDate(a)?.getTime() ?? 0) - (getKickoffDate(b)?.getTime() ?? 0)
  );

  const map = new Map<string, MatchDayGroup>();
  const todayKey = toLocalDateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrow);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  for (const m of sorted) {
    const kickoff = getKickoffDate(m);
    if (!kickoff) {
      const key = 'tbd';
      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          weekday: 'Termin offen',
          dateLabel: '',
          fullLabel: 'Termin offen',
          matches: [],
        });
      }
      map.get(key)!.matches.push(m);
      continue;
    }

    const key = toLocalDateKey(kickoff);
    if (!map.has(key)) {
      const weekdayRaw = kickoff.toLocaleDateString('de-DE', { weekday: 'long' });
      const dateLabel = kickoff.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'short',
      });
      let prefix = weekdayRaw;
      if (key === todayKey) prefix = `Heute · ${weekdayRaw}`;
      else if (key === tomorrowKey) prefix = `Morgen · ${weekdayRaw}`;
      else if (key === yesterdayKey) prefix = `Gestern · ${weekdayRaw}`;

      map.set(key, {
        dateKey: key,
        weekday: weekdayRaw,
        dateLabel,
        fullLabel: `${prefix}, ${dateLabel}`,
        matches: [],
      });
    }
    map.get(key)!.matches.push(m);
  }

  return Array.from(map.values());
}
