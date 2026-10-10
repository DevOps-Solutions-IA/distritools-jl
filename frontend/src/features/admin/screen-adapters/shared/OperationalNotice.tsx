export function OperationalNotice({
  status,
  message,
}: {
  status?: string;
  message?: string;
}) {
  if (!status && !message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4 text-sm text-amber-100">
      <p className="font-semibold">{status ?? 'Estado operativo'}</p>
      {message ? <p className="mt-1 text-amber-100/80">{message}</p> : null}
    </div>
  );
}
