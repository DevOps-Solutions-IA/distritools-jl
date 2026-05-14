export default function AdminReportsLoading() {
  return (
    <div className="space-y-5">
      <section className="h-36 animate-pulse rounded-[1.75rem] border border-[var(--color-border)] bg-white/[0.04]" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[1.35rem] border border-[var(--color-border)] bg-white/[0.04]" />
        ))}
      </section>
      <section className="h-80 animate-pulse rounded-[1.35rem] border border-[var(--color-border)] bg-white/[0.04]" />
    </div>
  );
}
