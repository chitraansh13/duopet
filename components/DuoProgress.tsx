export function DuoProgress({ progress }: { progress: number }) {
  return (
    <section className="rounded-[1.5rem] bg-surface p-5 text-ink shadow-soft">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-muted">Together, today</p>
          <h2 className="mt-1 text-lg font-semibold">Today&apos;s Duo Progress</h2>
        </div>
        <span key={progress} className="animate-number-in text-3xl font-extrabold tracking-tight">{progress}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label="Today's duo progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
