'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useCart } from '@/features/cart/hooks';
import { checkoutBackendGaps } from '@/features/checkout/mappers';
import {
  checkoutSchema,
  type CheckoutSchemaValues,
} from '@/features/checkout/schema';
import { submitGuestCheckout } from '@/lib/api/checkout';
import { CheckoutErrorState } from '@/components/checkout/CheckoutErrorState';

interface CheckoutFormProps {
  onSuccess(args: { orderNumber: string; message?: string }): void;
}

export function CheckoutForm({ onSuccess }: CheckoutFormProps) {
  const { items, summary } = useCart();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CheckoutSchemaValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      document: '',
      city: '',
      address: '',
      addressDetail: '',
      notes: '',
      paymentGateway: 'mock',
      acceptsTerms: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    if (!items.length) {
      setServerError('No puedes continuar con un carrito vacío.');
      return;
    }

    try {
      const result = await submitGuestCheckout(values, items);
      if (result.kind === 'success' && result.order) {
        onSuccess({
          orderNumber: result.order.orderNumber,
          message: result.message,
        });
      }
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'No fue posible crear la orden invitada.',
      );
    }
  });

  return (
    <form className="grid gap-6" onSubmit={onSubmit}>
      {serverError ? (
        <CheckoutErrorState
          title="No fue posible continuar con el checkout"
          description={serverError}
        />
      ) : null}

      <Card variant="elevated">
        <CardBody className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Datos de contacto y entrega
            </p>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              Completa la información necesaria para generar tu orden y continuar con el proceso de pago.
            </p>
          </div>
          <Input
            label="Nombre completo"
            {...form.register('fullName')}
            error={form.formState.errors.fullName?.message}
          />
          <Input
            label="Correo"
            type="email"
            {...form.register('email')}
            error={form.formState.errors.email?.message}
          />
          <Input
            label="Teléfono"
            {...form.register('phone')}
            error={form.formState.errors.phone?.message}
          />
          <Input
            label="Documento o NIT"
            {...form.register('document')}
            error={form.formState.errors.document?.message}
          />
          <Input
            label="Ciudad"
            {...form.register('city')}
            error={form.formState.errors.city?.message}
          />
          <Input
            label="Dirección principal"
            {...form.register('address')}
            error={form.formState.errors.address?.message}
          />
          <Input
            label="Detalle de dirección"
            {...form.register('addressDetail')}
            error={form.formState.errors.addressDetail?.message}
          />
          <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--color-off-white)]">
            Método de pago
            <select
              {...form.register('paymentGateway')}
              className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
            >
              <option value="mock">Pasarela disponible</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--color-off-white)]">
              Notas
              <textarea
                {...form.register('notes')}
                rows={4}
                className="focus-ring rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-off-white)]"
              />
            </label>
          </div>
          <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            <input type="checkbox" {...form.register('acceptsTerms')} className="mt-1 h-4 w-4" />
            <span>
              Acepto el tratamiento de datos y autorizo la creación de mi solicitud de compra.
            </span>
          </label>
          {form.formState.errors.acceptsTerms?.message ? (
            <p className="md:col-span-2 text-sm text-[var(--color-error-red)]">
              {form.formState.errors.acceptsTerms.message}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card className="border-dashed bg-[var(--color-surface-muted)]">
        <CardBody className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--color-off-white)]">
            Condiciones del proceso de compra
          </h3>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            Antes de pasar al pago, la orden valida condiciones comerciales y disponibilidad vigente.
          </p>
          <p className="text-sm font-medium text-[var(--color-off-white)]">
            Subtotal actual: {summary.subtotalLabel}
          </p>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            {checkoutBackendGaps.find((gap) => gap.key === 'payment-status-public')?.description}
          </p>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          size="lg"
          loading={form.formState.isSubmitting}
          disabled={!items.length}
        >
          Crear orden invitada
        </Button>
        <Button type="button" variant="outline" size="lg" disabled>
          Confirmación posterior al pago
        </Button>
      </div>
    </form>
  );
}
