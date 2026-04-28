import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[linear-gradient(90deg,rgba(229,231,235,0.9)_0%,rgba(243,244,246,1)_50%,rgba(229,231,235,0.9)_100%)] bg-[length:200%_100%]',
        className,
      )}
      aria-hidden="true"
    />
  );
}
