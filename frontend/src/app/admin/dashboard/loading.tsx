export default function AdminDashboardLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-white/[0.03] p-5">
        <div className="h-8 w-56 animate-pulse rounded-full bg-white/10" />
        <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded-full bg-white/10" />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[1.35rem] border border-[var(--color-border)] bg-white/[0.04]" />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-[1.35rem] border border-[var(--color-border)] bg-white/[0.04]" />
        ))}
      </section>
    </div>
  );
}
