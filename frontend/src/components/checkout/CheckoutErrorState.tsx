'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export function CheckoutErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <ErrorState title={title} description={description} retryLabel="Revisar datos" />;
}
