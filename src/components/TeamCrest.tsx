import React, { useState } from 'react';

interface TeamCrestProps {
  src?: string | null;
  name?: string | null;
  tla?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES: Record<NonNullable<TeamCrestProps['size']>, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
};

const PALETTE = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-teal-600',
];

function getInitials(name?: string | null, tla?: string | null): string {
  if (tla && tla.trim().length >= 2) return tla.trim().slice(0, 3).toUpperCase();
  const clean = (name ?? 'FC').replace(/[^a-zA-Z0-9ÄÖÜäöüß\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'FC';
}

function getColorClass(name?: string | null): string {
  const str = name ?? 'FC';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  src,
  name,
  tla,
  size = 'md',
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${SIZES[size]} ${getColorClass(name)} rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-inner select-none ${className}`}
        aria-label={name ?? 'Team'}
      >
        {getInitials(name, tla)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name ?? 'Team Wappen'}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`${SIZES[size]} object-contain shrink-0 select-none ${className}`}
    />
  );
};
