import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Moon,
  RefreshCw,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Monitor,
  Trash2,
} from 'lucide-react';
import { clearApiCache, getApiTelemetry, openLigaApi } from '../api/openligadb';
import { CURATED_LEAGUES } from '../config/leagues';
import { useAppState, type ThemeMode } from '../context/AppStateContext';
import type { GlobalResultInfo } from '../types/openligadb';

export const SettingsPage: React.FC = () => {
  const {
    theme,
    setTheme,
    homeLeagues,
    toggleHomeLeague,
    refreshIntervalSec,
    setRefreshIntervalSec,
    canInstallPwa,
    isInstalledPwa,
    installPwa,
  } = useAppState();

  const [telemetry, setTelemetry] = useState(() => getApiTelemetry());
  const [resultTypes, setResultTypes] = useState<GlobalResultInfo[]>([]);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    openLigaApi
      .getResultTypes()
      .then((rt) => setResultTypes(Array.isArray(rt) ? rt : []))
      .catch(() => {});
    const id = window.setInterval(() => setTelemetry(getApiTelemetry()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const handleClearCache = () => {
    clearApiCache();
    setTelemetry(getApiTelemetry());
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const THEME_OPTIONS: { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dark', label: 'Dunkel', icon: Moon },
    { id: 'light', label: 'Hell', icon: Sun },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  const REFRESH_OPTIONS = [
    { sec: 0, label: 'Aus' },
    { sec: 30, label: '30 Sek.' },
    { sec: 60, label: '60 Sek.' },
  ];

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0D10]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.07] pt-safe">
        <div className="px-4 h-14 flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-emerald-600 dark:text-[#C8FF00]" />
          <h1 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
            Einstellungen & PWA
          </h1>
        </div>
      </header>

      <div className="px-3.5 py-4 space-y-4">
        {/* PWA Installation Card */}
        <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-[#14181F] dark:from-[#161C24] dark:to-[#10141A] border border-emerald-500/30 p-4 text-white space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C8FF00] to-[#00E676] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-sm font-black">TorPulse als App installieren</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Vollbild, Offline-Cache & blitzschneller Start vom Homescreen.
                </p>
              </div>
            </div>
          </div>

          {isInstalledPwa ? (
            <div className="flex items-center gap-2 text-xs font-bold text-[#00E676] bg-emerald-500/10 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Bereits als PWA installiert & aktiv</span>
            </div>
          ) : canInstallPwa ? (
            <button
              type="button"
              onClick={() => installPwa()}
              className="w-full py-2.5 rounded-xl bg-[#C8FF00] text-black text-xs font-black flex items-center justify-center gap-2 hover:brightness-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Jetzt auf dem Gerät installieren</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-300 bg-white/[0.06] rounded-xl p-3 space-y-1">
              <p className="font-bold text-white">Manuelle Installation:</p>
              <p>
                <strong>iPhone (Safari):</strong> Teilen-Symbol (↑) → „Zum Home-Bildschirm“
              </p>
              <p>
                <strong>Android (Chrome):</strong> Menü (⋮) → „App installieren“
              </p>
            </div>
          )}
        </section>

        {/* Appearance */}
        <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Erscheinungsbild
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 border transition-all ${
                  theme === id
                    ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black border-transparent'
                    : 'bg-slate-50 dark:bg-[#0B0D10] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Live Auto Refresh */}
        <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Live-Aktualisierung
            </h2>
            <span className="text-[11px] text-slate-400">Smart Change-Check</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Prüft bei laufenden Spielen über <span className="font-mono">/getlastchangedate</span>, ob sich Spielstände geändert haben.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.sec}
                type="button"
                onClick={() => setRefreshIntervalSec(opt.sec)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  refreshIntervalSec === opt.sec
                    ? 'bg-slate-950 dark:bg-[#C8FF00] text-white dark:text-black border-transparent'
                    : 'bg-slate-50 dark:bg-[#0B0D10] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Home Feed Leagues */}
        <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Startseiten-Ligen (Spiele-Tab)
          </h2>
          <div className="flex flex-wrap gap-2">
            {CURATED_LEAGUES.map((l) => {
              const active = homeLeagues.some(
                (s) => s.toLowerCase() === l.shortcut.toLowerCase()
              );
              return (
                <button
                  key={l.shortcut}
                  type="button"
                  onClick={() => toggleHomeLeague(l.shortcut)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    active
                      ? 'bg-emerald-600/15 dark:bg-[#C8FF00]/15 text-emerald-700 dark:text-[#C8FF00] border-emerald-500/40 dark:border-[#C8FF00]/40'
                      : 'bg-slate-50 dark:bg-[#0B0D10] text-slate-500 border-slate-200/80 dark:border-white/[0.08]'
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* OpenLigaDB API & Cache Telemetry */}
        <section className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> OpenLigaDB API & Cache
            </h2>
            <a
              href="https://www.openligadb.de/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-emerald-600 dark:text-[#C8FF00] inline-flex items-center gap-1 hover:underline"
            >
              openligadb.de <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-center">
            <div className="rounded-xl bg-slate-50 dark:bg-[#0B0D10] p-3">
              <p className="text-[11px] text-slate-500">Requests / Min</p>
              <p className="text-lg font-black tabular-nums text-slate-950 dark:text-white mt-0.5">
                {telemetry.requestsLastMinute}
                <span className="text-xs font-semibold text-slate-400">
                  /{telemetry.rateLimitPerMinute}
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-[#0B0D10] p-3">
              <p className="text-[11px] text-slate-500">Cache-Einträge</p>
              <p className="text-lg font-black tabular-nums text-slate-950 dark:text-white mt-0.5">
                {telemetry.memoryCacheEntries}
              </p>
            </div>
          </div>

          {resultTypes.length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                Unterstützte Ergebnistypen (/getresulttypes):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resultTypes.map((rt) => (
                  <span
                    key={rt.id}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#0B0D10] text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {rt.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleClearCache}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#1B212B] text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{cacheCleared ? 'Cache geleert ✓' : 'Lokalen API-Cache leeren'}</span>
          </button>
        </section>
      </div>
    </div>
  );
};
