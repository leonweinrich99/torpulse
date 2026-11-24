import React from 'react';
import { NavLink } from 'react-router-dom';
import { Flame, Trophy, Search, Star, SlidersHorizontal, WifiOff } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/', label: 'Spiele', icon: Flame, end: true },
  { to: '/leagues', label: 'Ligen', icon: Trophy, end: false },
  { to: '/search', label: 'Suche', icon: Search, end: false },
  { to: '/favorites', label: 'Favoriten', icon: Star, end: false },
  { to: '/settings', label: 'Mehr', icon: SlidersHorizontal, end: false },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isOnline, favoriteTeams } = useAppState();

  return (
    <div className="min-h-dvh bg-[#F3F5F8] dark:bg-[#0B0D10] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Main centered mobile-first column */}
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col min-h-dvh bg-[#F3F5F8] dark:bg-[#0B0D10] md:border-x md:border-slate-200/70 md:dark:border-white/[0.06] relative">
        {!isOnline && (
          <div className="sticky top-0 z-50 bg-amber-500 text-black text-xs font-bold px-3 py-1.5 flex items-center justify-center gap-1.5 pt-safe">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline-Modus – zeige zwischengespeicherte Daten</span>
          </div>
        )}

        <main className="flex-1 pb-24">{children}</main>

        {/* Sticky OneFootball-style Bottom Navigation Bar */}
        <nav
          aria-label="Hauptnavigation"
          className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none"
        >
          <div className="w-full max-w-2xl pointer-events-auto bg-white/95 dark:bg-[#11151B]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/[0.08] pb-safe">
            <div className="grid grid-cols-5 h-16">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors relative ${
                      isActive
                        ? 'text-emerald-600 dark:text-[#C8FF00]'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-b-full bg-emerald-600 dark:bg-[#C8FF00]" />
                      )}
                      <div className="relative">
                        <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
                        {to === '/favorites' && favoriteTeams.length > 0 && (
                          <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-emerald-600 dark:bg-[#C8FF00] text-white dark:text-black text-[9px] font-black flex items-center justify-center leading-none">
                            {favoriteTeams.length > 9 ? '9+' : favoriteTeams.length}
                          </span>
                        )}
                      </div>
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
};
