export interface Sport {
  sportId: number;
  sportName: string | null;
}

export interface League {
  leagueId: number;
  leagueName: string | null;
  leagueShortcut: string | null;
  leagueSeason: string | null;
  sport: Sport | null;
}

export interface Group {
  groupName: string | null;
  groupOrderID: number;
  groupID: number;
}

export interface Team {
  teamId: number;
  teamName: string | null;
  shortName: string | null;
  teamIconUrl: string | null;
  teamGroupName: string | null;
  tla: string | null;
  wikidataId: string | null;
}

export interface Location {
  locationID: number;
  locationCity: string | null;
  locationStadium: string | null;
}

export type ResultTypeKind =
  | 'HalfTime'
  | 'After90Minutes'
  | 'AfterExtraTime'
  | 'AfterPenalties'
  | 'Unknown';

export interface MatchResult {
  resultID: number;
  resultName: string | null;
  pointsTeam1: number | null;
  pointsTeam2: number | null;
  resultOrderID: number;
  resultTypeID: number;
  resultTypeKind: ResultTypeKind | string | null;
  resultDescription: string | null;
}

export interface Goal {
  goalID: number;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  matchMinute: number | null;
  goalGetterID: number;
  goalGetterName: string | null;
  scoringTeamId: number | null;
  isPenalty: boolean | null;
  isOwnGoal: boolean | null;
  isOvertime: boolean | null;
  comment: string | null;
}

export interface Match {
  matchID: number;
  matchDateTime: string | null;
  timeZoneID: string | null;
  leagueId: number;
  leagueName: string | null;
  leagueSeason: number;
  leagueShortcut: string | null;
  matchDateTimeUTC: string | null;
  group: Group | null;
  team1: Team | null;
  team2: Team | null;
  lastUpdateDateTime: string | null;
  matchIsFinished: boolean;
  matchResults: MatchResult[] | null;
  goals: Goal[] | null;
  location: Location | null;
  numberOfViewers: number | null;
}

export interface BlTableTeam {
  teamInfoId: number;
  teamName: string | null;
  shortName: string | null;
  teamIconUrl: string | null;
  points: number;
  opponentGoals: number;
  goals: number;
  matches: number;
  won: number;
  lost: number;
  draw: number;
  goalDiff: number;
  teamId: number;
  tla: string | null;
  wikidataId: string | null;
}

export interface GoalGetter {
  goalGetterId: number;
  goalGetterName: string | null;
  goalCount: number;
}

export interface GlobalResultInfo {
  id: number;
  name: string | null;
  kind: ResultTypeKind | string | null;
}

export interface ResultInfo {
  id: number;
  name: string | null;
  description: string | null;
  orderId: number | null;
  resultTypeID: number | null;
  globalResultInfo: GlobalResultInfo | null;
}

export interface CuratedLeagueConfig {
  shortcut: string;
  name: string;
  shortLabel: string;
  country: string;
  flag: string;
  season: number;
  color: string;
  category: 'germany' | 'europe' | 'international' | 'women';
  hasTable: boolean;
  zones?: {
    ucl?: number[];
    uel?: number[];
    uecl?: number[];
    promotion?: number[];
    relegationPlayoff?: number[];
    relegation?: number[];
  };
}

export type MatchStatusKind = 'live' | 'halftime' | 'finished' | 'upcoming';

export interface DerivedMatchScore {
  status: MatchStatusKind;
  liveMinute: number | null;
  team1Score: number | null;
  team2Score: number | null;
  halfTimeTeam1: number | null;
  halfTimeTeam2: number | null;
  extraTime: boolean;
  penalties: boolean;
  statusLabel: string;
}

export type FormResult = 'W' | 'D' | 'L';

export interface FavoriteTeam {
  teamId: number;
  teamName: string;
  shortName: string;
  teamIconUrl: string | null;
  leagueShortcut?: string;
  leagueSeason?: number;
  leagueId?: number;
}
