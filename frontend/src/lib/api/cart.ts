import { ApiError } from '@/lib/api/errors';

export const cartApiCapabilities = {
  hasBackendCart: false,
} as const;

export async function assertBackendCartUnavailable() {
  throw new ApiError({
    status: 501,
    message: 'El carrito local no está disponible en este momento.',
  });
}
