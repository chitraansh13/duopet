interface UserProgressProps {
  label: string;
  progress: number;
  color: string;
}

export function UserProgress({ label, progress, color }: UserProgressProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-surface p-3 shadow-soft sm:p-4">
      <div
        className="grid size-12 shrink-0 place-items-center rounded-full transition-[background] duration-500 sm:size-14"
        style={{ background: `conic-gradient(${color} ${progress * 3.6}deg, var(--surface-secondary) 0deg)` }}
        role="progressbar"
        aria-label={`${label} is ${progress}% complete`}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="grid size-9 place-items-center rounded-full bg-surface text-[11px] font-extrabold sm:size-10 sm:text-xs">{progress}%</div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">Daily pace</p>
      </div>
    </div>
  );
}
