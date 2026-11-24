import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateProvider } from '../context/AppStateContext';
import { MatchCard } from './MatchCard';
import type { Match } from '../types/openligadb';

const sampleMatch: Match = {
  matchID: 83237,
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
    wikidataId: null,
  },
  team2: {
    teamId: 65,
    teamName: '1. FC Köln',
    shortName: 'Köln',
    teamIconUrl: null,
    teamGroupName: null,
    tla: 'KOE',
    wikidataId: null,
  },
  lastUpdateDateTime: null,
  matchIsFinished: true,
  matchResults: [
    {
      resultID: 1,
      resultName: 'Halbzeit',
      pointsTeam1: 1,
      pointsTeam2: 1,
      resultOrderID: 1,
      resultTypeID: 1,
      resultTypeKind: 'HalfTime',
      resultDescription: null,
    },
    {
      resultID: 2,
      resultName: 'Endergebnis',
      pointsTeam1: 3,
      pointsTeam2: 1,
      resultOrderID: 2,
      resultTypeID: 2,
      resultTypeKind: 'After90Minutes',
      resultDescription: null,
    },
  ],
  goals: [],
  location: null,
  numberOfViewers: null,
};

describe('MatchCard', () => {
  it('renders team names, final score, and half-time score', () => {
    render(
      <AppStateProvider>
        <MemoryRouter>
          <MatchCard match={sampleMatch} />
        </MemoryRouter>
      </AppStateProvider>
    );

    expect(screen.getByText('Bayern')).toBeInTheDocument();
    expect(screen.getByText('Köln')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('(1:1)')).toBeInTheDocument();
    expect(screen.getByText('FT')).toBeInTheDocument();
  });
});
