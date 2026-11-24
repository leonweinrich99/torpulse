import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppStateProvider } from './context/AppStateContext';
import { Layout } from './components/Layout';
import { MatchesPage } from './pages/MatchesPage';
import { LeaguesPage } from './pages/LeaguesPage';
import { LeagueDetailPage } from './pages/LeagueDetailPage';
import { MatchDetailPage } from './pages/MatchDetailPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { SearchPage } from './pages/SearchPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { SettingsPage } from './pages/SettingsPage';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export const App: React.FC = () => {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Layout>
          <Routes>
            <Route path="/" element={<MatchesPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/league/:shortcut/:season" element={<LeagueDetailPage />} />
            <Route path="/match/:matchId" element={<MatchDetailPage />} />
            <Route path="/team/:teamId" element={<TeamDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppStateProvider>
  );
};

export default App;
