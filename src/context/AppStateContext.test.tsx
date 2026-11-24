import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppStateProvider, useAppState } from './AppStateContext';

const SortTester = () => {
  const {
    leagueOrder,
    moveLeague,
    reorderLeagues,
    resetLeagueOrder,
    favoriteLeagues,
    moveFavoriteLeague,
    favoriteTeams,
    toggleFavoriteTeam,
    moveFavoriteTeam,
  } = useAppState();

  return (
    <div>
      <div data-testid="league-order">{leagueOrder.slice(0, 3).join(',')}</div>
      <div data-testid="fav-leagues">{favoriteLeagues.join(',')}</div>
      <div data-testid="fav-teams">{favoriteTeams.map((t) => t.shortName).join(',')}</div>

      <button onClick={() => moveLeague('bl2', 'up')}>move-bl2-up</button>
      <button onClick={() => reorderLeagues(0, 2)}>drag-0-to-2</button>
      <button onClick={() => resetLeagueOrder()}>reset-leagues</button>
      <button onClick={() => moveFavoriteLeague('dfb', 'up')}>move-dfb-up</button>
      <button
        onClick={() =>
          toggleFavoriteTeam({
            teamId: 40,
            teamName: 'FC Bayern München',
            shortName: 'Bayern',
            teamIconUrl: null,
          })
        }
      >
        add-bayern
      </button>
      <button
        onClick={() =>
          toggleFavoriteTeam({
            teamId: 7,
            teamName: 'Borussia Dortmund',
            shortName: 'Dortmund',
            teamIconUrl: null,
          })
        }
      >
        add-bvb
      </button>
      <button onClick={() => moveFavoriteTeam(40, 'up')}>move-bayern-up</button>
    </div>
  );
};

describe('AppStateContext custom sorting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reorders leagues via arrows, drag-and-drop, and reset', () => {
    render(
      <AppStateProvider>
        <SortTester />
      </AppStateProvider>
    );

    expect(screen.getByTestId('league-order')).toHaveTextContent('bl1,bl2,bl3');

    fireEvent.click(screen.getByText('move-bl2-up'));
    expect(screen.getByTestId('league-order')).toHaveTextContent('bl2,bl1,bl3');

    fireEvent.click(screen.getByText('drag-0-to-2'));
    expect(screen.getByTestId('league-order')).toHaveTextContent('bl1,bl3,bl2');

    fireEvent.click(screen.getByText('reset-leagues'));
    expect(screen.getByTestId('league-order')).toHaveTextContent('bl1,bl2,bl3');
  });

  it('reorders favorite leagues and favorite teams and persists order', () => {
    render(
      <AppStateProvider>
        <SortTester />
      </AppStateProvider>
    );

    expect(screen.getByTestId('fav-leagues')).toHaveTextContent('bl1,bl2,dfb,ucl');
    fireEvent.click(screen.getByText('move-dfb-up'));
    expect(screen.getByTestId('fav-leagues')).toHaveTextContent('bl1,dfb,bl2,ucl');

    fireEvent.click(screen.getByText('add-bayern'));
    fireEvent.click(screen.getByText('add-bvb'));
    expect(screen.getByTestId('fav-teams')).toHaveTextContent('Dortmund,Bayern');

    fireEvent.click(screen.getByText('move-bayern-up'));
    expect(screen.getByTestId('fav-teams')).toHaveTextContent('Bayern,Dortmund');
  });
});
