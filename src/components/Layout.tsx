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
      {/* iOS Top Status Bar / Dynamic Island Translucent Blur Scrim */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none ios-top-blur-scrim"
      />

      {/* Main centered mobile-first column */}
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col min-h-dvh bg-[#F3F5F8] dark:bg-[#0B0D10] md:border-x md:border-slate-200/70 md:dark:border-white/[0.06] relative">
        {!isOnline && (
          <div className="sticky top-0 z-50 bg-amber-500 text-black text-xs font-bold px-3 pb-1.5 flex items-center justify-center gap-1.5 pt-safe">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline-Modus – zeige zwischengespeicherte Daten</span>
          </div>
        )}

        <main className="flex-1 pb-tabbar">{children}</main>

        {/* Floating Apple Liquid Glass Bottom Tab Bar */}
        <nav
          aria-label="Hauptnavigation"
          className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none px-3"
          style={{ paddingBottom: 'var(--ios-bottom-clearance)' }}
        >
          <div className="w-full max-w-[460px] pointer-events-auto liquid-glass-bar rounded-[30px] p-1.5">
            <div className="grid grid-cols-5 gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-[24px] text-[10px] font-bold tracking-tight transition-all duration-300 select-none ${
                      isActive
                        ? 'liquid-glass-pill text-emerald-600 dark:text-[#C8FF00] scale-[1.02]'
                        : 'text-slate-600 dark:text-slate-300/80 hover:text-slate-900 dark:hover:text-white active:scale-95'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative">
                        <Icon
                          className={`w-[21px] h-[21px] transition-transform duration-300 ${
                            isActive ? 'stroke-[2.4] -translate-y-[0.5px]' : 'stroke-[1.85]'
                          }`}
                        />
                        {to === '/favorites' && favoriteTeams.length > 0 && (
                          <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-600 dark:bg-[#C8FF00] text-white dark:text-black text-[9px] font-black flex items-center justify-center leading-none shadow-xs">
                            {favoriteTeams.length > 9 ? '9+' : favoriteTeams.length}
                          </span>
                        )}
                      </div>
                      <span className="leading-none mt-0.5">{label}</span>
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
