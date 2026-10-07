export interface DrainableWorker {
  pause(doNotWaitActive?: boolean): Promise<void>;
  close(force?: boolean): Promise<void>;
  isRunning?(): boolean;
}

export async function boundedWorkerShutdown(
  worker: DrainableWorker,
  deadlineMs = 150_000,
): Promise<{ drained: boolean }> {
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 300_000) {
    throw new Error('Invalid worker shutdown deadline');
  }
  if (worker.isRunning && !worker.isRunning()) return { drained: true };
  const deadline = Date.now() + deadlineMs;
  const within = async (operation: Promise<void>, remainingMs: number) => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation.then(() => true, () => false),
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), remainingMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  if (await within(worker.pause(false), Math.max(1, deadline - Date.now()))) {
    const closed = await within(worker.close(false), Math.max(1, deadline - Date.now()));
    if (closed) return { drained: true };
  }

  // A forced close relinquishes the BullMQ lock; PostgreSQL inbox/leases remain the recovery authority.
  try { await within(worker.close(true), 2_000); } catch { /* Redis may already be closed during application teardown. */ }
  return { drained: false };
}
