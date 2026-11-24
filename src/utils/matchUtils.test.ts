import { describe, expect, it } from 'vitest';
import type { Match } from '../types/openligadb';
import {
  buildGoalTimeline,
  computeH2HStats,
  computeSplitTable,
  computeTeamForm,
  deriveMatchScore,
  enrichGoalGetters,
  formatAttendance,
  formatCountdown,
} from './matchUtils';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    matchID: 1001,
    matchDateTime: '2026-11-20T20:30:00',
    matchDateTimeUTC: '2026-11-20T19:30:00Z',
    timeZoneID: 'W. Europe Standard Time',
    leagueId: 4937,
    leagueName: '1. Fußball-Bundesliga 2026/2027',
    leagueSeason: 2026,
    leagueShortcut: 'bl1',
    group: { groupName: '10. Spieltag', groupOrderID: 10, groupID: 50642 },
    team1: {
      teamId: 40,
      teamName: 'FC Bayern München',
      shortName: 'Bayern',
      teamIconUrl: null,
      teamGroupName: null,
      tla: 'FCB',
      wikidataId: 'Q15789',
    },
    team2: {
      teamId: 7,
      teamName: 'Borussia Dortmund',
      shortName: 'Dortmund',
      teamIconUrl: null,
      teamGroupName: null,
      tla: 'BVB',
      wikidataId: 'Q41420',
    },
    lastUpdateDateTime: null,
    matchIsFinished: true,
    matchResults: [
      {
        resultID: 1,
        resultName: 'Halbzeit',
        pointsTeam1: 1,
        pointsTeam2: 0,
        resultOrderID: 1,
        resultTypeID: 1,
        resultTypeKind: 'HalfTime',
        resultDescription: null,
      },
      {
        resultID: 2,
        resultName: 'Endergebnis',
        pointsTeam1: 2,
        pointsTeam2: 1,
        resultOrderID: 2,
        resultTypeID: 2,
        resultTypeKind: 'After90Minutes',
        resultDescription: null,
      },
    ],
    goals: [
      {
        goalID: 1,
        scoreTeam1: 1,
        scoreTeam2: 0,
        matchMinute: 23,
        goalGetterID: 101,
        goalGetterName: 'H. Kane',
        scoringTeamId: 40,
        isPenalty: false,
        isOwnGoal: false,
        isOvertime: false,
        comment: null,
      },
      {
        goalID: 2,
        scoreTeam1: 1,
        scoreTeam2: 1,
        matchMinute: 65,
        goalGetterID: 202,
        goalGetterName: 'S. Guirassy',
        scoringTeamId: 7,
        isPenalty: true,
        isOwnGoal: false,
        isOvertime: false,
        comment: null,
      },
      {
        goalID: 3,
        scoreTeam1: 2,
        scoreTeam2: 1,
        matchMinute: 92,
        goalGetterID: 101,
        goalGetterName: 'H. Kane',
        scoringTeamId: null, // test fallback score-delta inference
        isPenalty: false,
        isOwnGoal: false,
        isOvertime: true,
        comment: 'Kopfball',
      },
    ],
    location: { locationID: 34, locationCity: 'München', locationStadium: 'Allianz Arena' },
    numberOfViewers: 75024,
    ...overrides,
  };
}

describe('deriveMatchScore', () => {
  it('parses finished match with halftime and full-time scores', () => {
    const res = deriveMatchScore(makeMatch());
    expect(res.status).toBe('finished');
    expect(res.team1Score).toBe(2);
    expect(res.team2Score).toBe(1);
    expect(res.halfTimeTeam1).toBe(1);
    expect(res.halfTimeTeam2).toBe(0);
    expect(res.statusLabel).toBe('FT');
  });

  it('detects penalty shootout label n.E.', () => {
    const m = makeMatch({
      matchResults: [
        {
          resultID: 1,
          resultName: 'nach 90 Min',
          pointsTeam1: 1,
          pointsTeam2: 1,
          resultOrderID: 2,
          resultTypeID: 2,
          resultTypeKind: 'After90Minutes',
          resultDescription: null,
        },
        {
          resultID: 2,
          resultName: 'nach Elfmeterschießen',
          pointsTeam1: 5,
          pointsTeam2: 4,
          resultOrderID: 5,
          resultTypeID: 5,
          resultTypeKind: 'AfterPenalties',
          resultDescription: null,
        },
      ],
    });
    const res = deriveMatchScore(m);
    expect(res.penalties).toBe(true);
    expect(res.statusLabel).toBe('n.E.');
    expect(res.team1Score).toBe(5);
    expect(res.team2Score).toBe(4);
  });

  it('detects live match and calculates live minute with halftime break offset', () => {
    const kickoff = new Date('2026-11-24T19:00:00Z');
    const nowMs = kickoff.getTime() + 80 * 60_000; // 80 real mins => ~65th match min
    const m = makeMatch({
      matchDateTimeUTC: kickoff.toISOString(),
      matchIsFinished: false,
      matchResults: [],
      goals: [
        {
          goalID: 10,
          scoreTeam1: 1,
          scoreTeam2: 0,
          matchMinute: 18,
          goalGetterID: 1,
          goalGetterName: 'Test',
          scoringTeamId: 40,
          isPenalty: false,
          isOwnGoal: false,
          isOvertime: false,
          comment: null,
        },
      ],
    });
    const res = deriveMatchScore(m, nowMs);
    expect(res.status).toBe('live');
    expect(res.liveMinute).toBe(65);
    expect(res.team1Score).toBe(1);
    expect(res.team2Score).toBe(0);
  });

  it('detects upcoming match cleanly', () => {
    const kickoff = new Date('2026-11-28T14:30:00Z');
    const nowMs = new Date('2026-11-24T14:30:00Z').getTime();
    const m = makeMatch({
      matchDateTimeUTC: kickoff.toISOString(),
      matchIsFinished: false,
      matchResults: [],
      goals: [],
    });
    const res = deriveMatchScore(m, nowMs);
    expect(res.status).toBe('upcoming');
    expect(res.team1Score).toBeNull();
  });
});

describe('buildGoalTimeline & enrichGoalGetters', () => {
  it('assigns goal sides via scoringTeamId and score-delta fallback, with overtime label', () => {
    const timeline = buildGoalTimeline(makeMatch());
    expect(timeline).toHaveLength(3);
    expect(timeline[0].side).toBe('home');
    expect(timeline[1].side).toBe('away');
    expect(timeline[2].side).toBe('home');
    expect(timeline[2].minuteLabel).toBe("90+2'");
  });

  it('enriches goal getters with club crest info and penalty counts', () => {
    const enriched = enrichGoalGetters(
      [
        { goalGetterId: 101, goalGetterName: 'H. Kane', goalCount: 2 },
        { goalGetterId: 202, goalGetterName: 'S. Guirassy', goalCount: 1 },
      ],
      [makeMatch()]
    );
    expect(enriched[0].teamId).toBe(40);
    expect(enriched[0].penalties).toBe(0);
    expect(enriched[1].teamId).toBe(7);
    expect(enriched[1].penalties).toBe(1);
  });
});

describe('computeTeamForm, computeSplitTable, computeH2HStats', () => {
  it('computes team form, home/away tables, and H2H statistics accurately', () => {
    const m1 = makeMatch({ matchID: 1 }); // Bayern 2-1 Dortmund
    const m2 = makeMatch({
      matchID: 2,
      matchDateTimeUTC: '2026-11-27T19:30:00Z',
      team1: makeMatch().team2,
      team2: makeMatch().team1,
      matchResults: [
        {
          resultID: 9,
          resultName: 'End',
          pointsTeam1: 1,
          pointsTeam2: 1,
          resultOrderID: 2,
          resultTypeID: 2,
          resultTypeKind: 'After90Minutes',
          resultDescription: null,
        },
      ],
    });

    expect(computeTeamForm([m1, m2], 40, 5)).toEqual(['W', 'D']);
    expect(computeTeamForm([m1, m2], 7, 5)).toEqual(['L', 'D']);

    const homeTable = computeSplitTable([m1, m2], 'home');
    expect(homeTable[0].teamId).toBe(40);
    expect(homeTable[0].points).toBe(3);

    const h2h = computeH2HStats([m1, m2], 40, 7);
    expect(h2h.total).toBe(2);
    expect(h2h.team1Wins).toBe(1);
    expect(h2h.draws).toBe(1);
    expect(h2h.team2Wins).toBe(0);
    expect(h2h.team1Goals).toBe(3);
    expect(h2h.team2Goals).toBe(2);
  });

  it('formats attendance and kickoff countdown', () => {
    expect(formatAttendance(75024)).toContain('Zuschauer');
    const future = new Date(Date.now() + 95 * 60_000);
    expect(formatCountdown(future)).toMatch(/in 1h 3[45]m/);
  });
});
