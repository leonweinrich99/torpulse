import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Match } from '../types/openligadb';
import {
  deriveMatchScore,
  formatShortDate,
  getDisplayTeamName,
  getKickoffDate,
} from '../utils/matchUtils';
import { useAppState } from '../context/AppStateContext';
import { TeamCrest } from './TeamCrest';

interface MatchCardProps {
  match: Match;
  showLeagueBadge?: boolean;
  showDate?: boolean;
  nowMs?: number;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  showLeagueBadge = false,
  showDate = false,
  nowMs,
}) => {
  const navigate = useNavigate();
  const { isFavoriteTeam } = useAppState();
  const derived = deriveMatchScore(match, nowMs);
  const kickoff = getKickoffDate(match);

  const isLive = derived.status === 'live' || derived.status === 'halftime';
  const isFinished = derived.status === 'finished';
  const isUpcoming = derived.status === 'upcoming';

  const team1Fav = match.team1 ? isFavoriteTeam(match.team1.teamId) : false;
  const team2Fav = match.team2 ? isFavoriteTeam(match.team2.teamId) : false;
  const hasFav = team1Fav || team2Fav;

  const team1Won =
    isFinished &&
    derived.team1Score !== null &&
    derived.team2Score !== null &&
    derived.team1Score > derived.team2Score;
  const team2Won =
    isFinished &&
    derived.team1Score !== null &&
    derived.team2Score !== null &&
    derived.team2Score > derived.team1Score;

  return (
    <button
      type="button"
      onClick={() => navigate(`/match/${match.matchID}`, { state: { match } })}
      className={`w-full text-left px-3.5 py-3 transition-colors active:scale-[0.995] hover:bg-slate-100/80 dark:hover:bg-white/[0.04] flex flex-col gap-1.5 relative ${
        isLive
          ? 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.07]'
          : hasFav
          ? 'bg-amber-500/[0.04] dark:bg-[#C8FF00]/[0.03]'
          : ''
      }`}
    >
      {/* Left accent stripe for live or favorite */}
      {isLive && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#00E676]" />
      )}
      {!isLive && hasFav && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#C8FF00]" />
      )}

      {(showLeagueBadge || showDate) && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="truncate font-medium">
            {showLeagueBadge
              ? `${match.leagueName || match.leagueShortcut || ''}${
                  match.group?.groupName ? ` • ${match.group.groupName}` : ''
                }`
              : match.group?.groupName || ''}
          </span>
          {showDate && kickoff && (
            <span className="shrink-0 ml-2 tabular-nums">
              {formatShortDate(kickoff)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Status / Time column */}
        <div className="w-12 shrink-0 flex flex-col items-center justify-center">
          {isLive ? (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-[#00E676] font-extrabold text-[11px] tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-[#00E676] animate-live-dot" />
              <span>{derived.statusLabel}</span>
            </div>
          ) : isFinished ? (
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {derived.statusLabel}
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {derived.statusLabel}
            </span>
          )}
          {derived.halfTimeTeam1 !== null && derived.halfTimeTeam2 !== null && !isUpcoming && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
              ({derived.halfTimeTeam1}:{derived.halfTimeTeam2})
            </span>
          )}
        </div>

        {/* Teams column */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Home Team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TeamCrest
                src={match.team1?.teamIconUrl}
                name={match.team1?.teamName}
                tla={match.team1?.tla}
                size="sm"
              />
              <span
                className={`text-[14px] truncate ${
                  team1Won
                    ? 'font-bold text-slate-950 dark:text-white'
                    : isFinished && team2Won
                    ? 'font-medium text-slate-500 dark:text-slate-400'
                    : 'font-semibold text-slate-900 dark:text-slate-100'
                }`}
              >
                {getDisplayTeamName(match.team1)}
              </span>
              {team1Fav && (
                <Star className="w-3 h-3 text-amber-500 dark:text-[#C8FF00] fill-current shrink-0" />
              )}
            </div>
            {!isUpcoming && (
              <span
                className={`text-[15px] tabular-nums w-6 text-right ${
                  isLive
                    ? 'font-black text-emerald-600 dark:text-[#00E676]'
                    : team1Won
                    ? 'font-extrabold text-slate-950 dark:text-white'
                    : 'font-semibold text-slate-600 dark:text-slate-400'
                }`}
              >
                {derived.team1Score ?? '-'}
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TeamCrest
                src={match.team2?.teamIconUrl}
                name={match.team2?.teamName}
                tla={match.team2?.tla}
                size="sm"
              />
              <span
                className={`text-[14px] truncate ${
                  team2Won
                    ? 'font-bold text-slate-950 dark:text-white'
                    : isFinished && team1Won
                    ? 'font-medium text-slate-500 dark:text-slate-400'
                    : 'font-semibold text-slate-900 dark:text-slate-100'
                }`}
              >
                {getDisplayTeamName(match.team2)}
              </span>
              {team2Fav && (
                <Star className="w-3 h-3 text-amber-500 dark:text-[#C8FF00] fill-current shrink-0" />
              )}
            </div>
            {!isUpcoming && (
              <span
                className={`text-[15px] tabular-nums w-6 text-right ${
                  isLive
                    ? 'font-black text-emerald-600 dark:text-[#00E676]'
                    : team2Won
                    ? 'font-extrabold text-slate-950 dark:text-white'
                    : 'font-semibold text-slate-600 dark:text-slate-400'
                }`}
              >
                {derived.team2Score ?? '-'}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
