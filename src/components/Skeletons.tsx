import React from 'react';

export const MatchCardSkeleton: React.FC = () => (
  <div className="px-3.5 py-3 flex items-center gap-3 animate-pulse">
    <div className="w-12 h-6 rounded-md bg-slate-200 dark:bg-white/[0.06]" />
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
          <div className="w-28 h-3.5 rounded bg-slate-200 dark:bg-white/[0.06]" />
        </div>
        <div className="w-5 h-4 rounded bg-slate-200 dark:bg-white/[0.06]" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
          <div className="w-24 h-3.5 rounded bg-slate-200 dark:bg-white/[0.06]" />
        </div>
        <div className="w-5 h-4 rounded bg-slate-200 dark:bg-white/[0.06]" />
      </div>
    </div>
  </div>
);

export const LeagueGroupSkeleton: React.FC = () => (
  <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
    <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-2 animate-pulse">
      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
      <div className="w-36 h-4 rounded bg-slate-200 dark:bg-white/[0.06]" />
    </div>
    <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
      <MatchCardSkeleton />
      <MatchCardSkeleton />
      <MatchCardSkeleton />
    </div>
  </div>
);

export const TableSkeleton: React.FC = () => (
  <div className="rounded-2xl bg-white dark:bg-[#14181F] border border-slate-200/80 dark:border-white/[0.08] p-3 space-y-2.5 animate-pulse">
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="w-5 h-4 rounded bg-slate-200 dark:bg-white/[0.06]" />
        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
        <div className="flex-1 h-4 rounded bg-slate-200 dark:bg-white/[0.06]" />
        <div className="w-10 h-4 rounded bg-slate-200 dark:bg-white/[0.06]" />
      </div>
    ))}
  </div>
);
