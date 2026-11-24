import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { BlTableTeam, FormResult } from '../types/openligadb';
import { getZoneInfo } from '../config/leagues';
import { useAppState } from '../context/AppStateContext';
import { TeamCrest } from './TeamCrest';
import { FormBadges } from './FormBadges';

interface StandingsTableProps {
  rows: BlTableTeam[];
  leagueShortcut: string;
  leagueSeason: number;
  leagueId?: number;
  formMap?: Map<number, FormResult[]>;
  highlightTeamIds?: number[];
  compact?: boolean;
}

export const StandingsTable: React.FC<StandingsTableProps> = ({
  rows,
  leagueShortcut,
  leagueSeason,
  leagueId,
  formMap,
  highlightTeamIds = [],
  compact = false,
}) => {
  const navigate = useNavigate();
  const { isFavoriteTeam } = useAppState();

  if (!rows.length) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Für diesen Wettbewerb ist aktuell keine Tabelle verfügbar.
      </div>
    );
  }

  // Collect unique zone labels for legend
  const legendMap = new Map<string, string>();
  rows.forEach((_, idx) => {
    const z = getZoneInfo(leagueShortcut, idx + 1);
    if (z && !legendMap.has(z.label)) {
      legendMap.set(z.label, z.color);
    }
  });

  return (
    <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-white/[0.07] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 pl-3 pr-1.5 w-8 text-center">#</th>
              <th className="py-2.5 px-1.5">Verein</th>
              <th className="py-2.5 px-1.5 text-center w-8">Sp</th>
              {!compact && (
                <>
                  <th className="py-2.5 px-1 text-center w-7 hidden sm:table-cell">S</th>
                  <th className="py-2.5 px-1 text-center w-7 hidden sm:table-cell">U</th>
                  <th className="py-2.5 px-1 text-center w-7 hidden sm:table-cell">N</th>
                </>
              )}
              <th className="py-2.5 px-1.5 text-center w-12">Tore</th>
              <th className="py-2.5 px-1.5 text-center w-9">TD</th>
              <th className="py-2.5 pl-1.5 pr-3 text-center w-10 text-slate-900 dark:text-white">
                Pkt
              </th>
              {!compact && formMap && formMap.size > 0 && (
                <th className="py-2.5 pr-3 pl-1 text-right hidden min-[480px]:table-cell">Form</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05] text-[13px]">
            {rows.map((row, index) => {
              const rank = index + 1;
              const teamId = row.teamId || row.teamInfoId;
              const zone = getZoneInfo(leagueShortcut, rank);
              const isFav = isFavoriteTeam(teamId);
              const isHighlighted = highlightTeamIds.includes(teamId);
              const form = formMap?.get(teamId) ?? [];

              return (
                <tr
                  key={teamId}
                  onClick={() =>
                    navigate(`/team/${teamId}`, {
                      state: {
                        team: {
                          teamId,
                          teamName: row.teamName,
                          shortName: row.shortName,
                          teamIconUrl: row.teamIconUrl,
                          tla: row.tla,
                          wikidataId: row.wikidataId,
                        },
                        leagueShortcut,
                        leagueSeason,
                        leagueId,
                      },
                    })
                  }
                  className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04] ${
                    isHighlighted
                      ? 'bg-emerald-500/10 dark:bg-[#C8FF00]/10'
                      : isFav
                      ? 'bg-amber-500/[0.06] dark:bg-[#C8FF00]/[0.05]'
                      : ''
                  }`}
                >
                  <td className="py-2.5 pl-3 pr-1.5 text-center tabular-nums font-bold text-slate-700 dark:text-slate-300 relative">
                    {zone && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                        style={{ backgroundColor: zone.color }}
                      />
                    )}
                    {rank}
                  </td>
                  <td className="py-2.5 px-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamCrest
                        src={row.teamIconUrl}
                        name={row.teamName}
                        tla={row.tla}
                        size="xs"
                      />
                      <span
                        className={`truncate max-w-[130px] sm:max-w-[200px] ${
                          isHighlighted || isFav
                            ? 'font-bold text-slate-950 dark:text-white'
                            : 'font-medium text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {row.shortName || row.teamName}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-slate-600 dark:text-slate-400">
                    {row.matches}
                  </td>
                  {!compact && (
                    <>
                      <td className="py-2.5 px-1 text-center tabular-nums text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                        {row.won}
                      </td>
                      <td className="py-2.5 px-1 text-center tabular-nums text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                        {row.draw}
                      </td>
                      <td className="py-2.5 px-1 text-center tabular-nums text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                        {row.lost}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-slate-600 dark:text-slate-400 text-xs">
                    {row.goals}:{row.opponentGoals}
                  </td>
                  <td
                    className={`py-2.5 px-1.5 text-center tabular-nums text-xs font-semibold ${
                      row.goalDiff > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : row.goalDiff < 0
                        ? 'text-rose-500'
                        : 'text-slate-500'
                    }`}
                  >
                    {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                  </td>
                  <td className="py-2.5 pl-1.5 pr-3 text-center tabular-nums font-extrabold text-slate-950 dark:text-white">
                    {row.points}
                  </td>
                  {!compact && formMap && formMap.size > 0 && (
                    <td className="py-2.5 pr-3 pl-1 hidden min-[480px]:table-cell">
                      <div className="flex justify-end">
                        <FormBadges form={form} size="sm" />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {legendMap.size > 0 && (
        <div className="px-3.5 py-2.5 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap gap-x-4 gap-y-1.5 bg-slate-50/70 dark:bg-white/[0.02]">
          {Array.from(legendMap.entries()).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
