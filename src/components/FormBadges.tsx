import React from 'react';
import type { FormResult } from '../types/openligadb';

interface FormBadgesProps {
  form: FormResult[];
  size?: 'sm' | 'md';
}

const STYLES: Record<FormResult, { bg: string; label: string; title: string }> = {
  W: {
    bg: 'bg-emerald-500 text-black',
    label: 'S',
    title: 'Sieg',
  },
  D: {
    bg: 'bg-slate-400 dark:bg-slate-600 text-white',
    label: 'U',
    title: 'Unentschieden',
  },
  L: {
    bg: 'bg-rose-500 text-white',
    label: 'N',
    title: 'Niederlage',
  },
};

export const FormBadges: React.FC<FormBadgesProps> = ({ form, size = 'sm' }) => {
  if (!form.length) return null;
  const dim = size === 'sm' ? 'w-4 h-4 text-[9px]' : 'w-6 h-6 text-[11px]';

  return (
    <div className="flex items-center gap-1" aria-label="Form der letzten Spiele">
      {form.map((res, idx) => {
        const s = STYLES[res];
        return (
          <span
            key={idx}
            title={s.title}
            className={`${dim} ${s.bg} rounded-[4px] font-extrabold inline-flex items-center justify-center leading-none`}
          >
            {s.label}
          </span>
        );
      })}
    </div>
  );
};
