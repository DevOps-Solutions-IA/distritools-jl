'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useCart } from '@/features/cart/hooks';
import {
  getCheckoutPaymentMethods,
  getDefaultPaymentMethod,
} from '@/features/checkout/payment-methods';
import {
  checkoutSchema,
  type CheckoutSchemaValues,
} from '@/features/checkout/schema';
import { submitGuestCheckout } from '@/lib/api/checkout';
import { CheckoutErrorState } from '@/components/checkout/CheckoutErrorState';
import {
  captureCommerceError,
  trackCommerceEvent,
} from '@/lib/observability/commerce-events';

interface CheckoutFormProps {
  onSuccess(args: {
    kind: 'order' | 'quote';
    orderNumber?: string;
    trackingCode?: string;
    carrier?: string | null;
    guideNumber?: string | null;
    autoShippingStatus?: string | null;
    message?: string;
    paymentMethod?: CheckoutSchemaValues['paymentGateway'];
  }): void;
}

function toHumanCheckoutError(error: unknown) {
  const fallback = 'No fue posible crear la orden invitada.';
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message;
  if (
    /missing variants/i.test(message) ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(message)
  ) {
    return 'No pudimos confirmar uno de los productos del carrito. Actualiza tu carrito e inténtalo de nuevo.';
  }

  return message;
}

export function CheckoutForm({ onSuccess }: CheckoutFormProps) {
  const { items, summary } = useCart();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const paymentMethods = getCheckoutPaymentMethods(summary);
  const defaultPaymentMethod = getDefaultPaymentMethod(summary);

  const form = useForm<CheckoutSchemaValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      document: '',
      department: '',
      city: '',
      neighborhood: '',
      postalCode: '',
      address: '',
      addressDetail: '',
      notes: '',
      paymentGateway: defaultPaymentMethod,
      acceptsTerms: false,
    },
  });

  const selectedPaymentMethod = form.watch('paymentGateway');

  useEffect(() => {
    trackCommerceEvent('checkout_started', {
      itemCount: summary.itemCount,
      hasQuoteItems: summary.hasQuoteItems,
      hasPricedItems: summary.hasPricedItems,
    });
  }, [summary.hasPricedItems, summary.hasQuoteItems, summary.itemCount]);

  useEffect(() => {
    const selectedMethod = paymentMethods.find(
      (method) => method.id === selectedPaymentMethod,
    );

    if (!selectedMethod?.enabled) {
      form.setValue('paymentGateway', defaultPaymentMethod);
    }
  }, [defaultPaymentMethod, form, paymentMethods, selectedPaymentMethod]);

  useEffect(() => {
    trackCommerceEvent('payment_method_selected', {
      method: selectedPaymentMethod,
    });
  }, [selectedPaymentMethod]);

  useEffect(() => {
    if (serverError) {
      errorRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
  }, [serverError]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    if (!items.length) {
      setServerError('No puedes continuar con un carrito vacío.');
      return;
    }

    try {
      const result = await submitGuestCheckout(values, items);
      if (result.kind === 'success' && result.order) {
        trackCommerceEvent('order_submitted', {
          method: values.paymentGateway,
          hasQuoteItems: summary.hasQuoteItems,
          hasPricedItems: summary.hasPricedItems,
        });
        trackCommerceEvent('checkout_completed', {
          kind: 'order',
          method: values.paymentGateway,
        });
        onSuccess({
          kind: 'order',
          orderNumber: result.order.orderNumber,
          trackingCode: result.order.trackingCode,
          carrier: result.order.shipping?.carrier,
          guideNumber: result.order.shipping?.guideNumber,
          autoShippingStatus: result.order.shipping?.autoShippingStatus,
          message: result.message,
          paymentMethod: values.paymentGateway,
        });
        return;
      }

      if (result.kind === 'quote') {
        trackCommerceEvent('quote_requested', {
          method: values.paymentGateway,
          itemCount: summary.itemCount,
        });
        trackCommerceEvent('checkout_completed', {
          kind: 'quote',
          method: values.paymentGateway,
        });
        onSuccess({
          kind: 'quote',
          message: result.message,
          paymentMethod: values.paymentGateway,
        });
      }
    } catch (error) {
      captureCommerceError('create_order', error, {
        method: values.paymentGateway,
        itemCount: summary.itemCount,
      });
      setServerError(
        values.paymentGateway === 'pse'
          ? 'PSE no está disponible en este momento. Selecciona otro método de pago.'
          : toHumanCheckoutError(error),
      );
    }
  });

  return (
    <form className="grid gap-3 sm:gap-6" onSubmit={onSubmit}>
      {serverError ? (
        <div ref={errorRef}>
          <CheckoutErrorState
            title="No fue posible continuar con el checkout"
            description={serverError}
          />
        </div>
      ) : null}

      <Card id="checkout-contact-data" variant="elevated">
        <CardBody className="grid gap-3 p-4 sm:gap-5 sm:p-5 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Datos de contacto
            </p>
            <p className="text-xs leading-5 text-[var(--color-text-secondary)] sm:text-sm sm:leading-6">
              Completa tu información para confirmar el pedido y coordinar la entrega.
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
        </CardBody>
      </Card>

      <Card variant="elevated">
        <CardBody className="grid gap-3 p-4 sm:gap-5 sm:p-5 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Entrega
            </p>
            <p className="text-xs leading-5 text-[var(--color-text-secondary)] sm:text-sm sm:leading-6">
              La transportadora y el valor de envío se confirmarán antes del despacho.
            </p>
          </div>
          <Input
            label="Departamento"
            {...form.register('department')}
            error={form.formState.errors.department?.message}
          />
          <Input
            label="Ciudad"
            {...form.register('city')}
            error={form.formState.errors.city?.message}
          />
          <Input
            label="Barrio"
            {...form.register('neighborhood')}
            error={form.formState.errors.neighborhood?.message}
          />
          <Input
            label="Código postal"
            {...form.register('postalCode')}
            error={form.formState.errors.postalCode?.message}
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
          <div className="md:col-span-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--color-off-white)]">
              Notas
              <textarea
                {...form.register('notes')}
                rows={3}
                className="focus-ring rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-base text-[var(--color-off-white)]"
              />
            </label>
          </div>
        </CardBody>
      </Card>

      <Card variant="elevated">
        <CardBody className="space-y-3 p-4 sm:space-y-5 sm:p-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Pago
            </p>
            <p className="text-xs leading-5 text-[var(--color-text-secondary)] sm:text-sm sm:leading-6">
              Elige un método disponible. PSE permanece bloqueado sin proveedor configurado.
            </p>
          </div>
          <div className="grid gap-2">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                data-testid="payment-method-option"
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[1rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 transition hover:border-[rgba(245,183,0,0.45)] has-[:checked]:border-[var(--color-industrial-yellow)] has-[:checked]:bg-[rgba(245,183,0,0.08)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 sm:min-h-16 sm:px-4"
              >
                <input
                  type="radio"
                  value={method.id}
                  disabled={!method.enabled}
                  {...form.register('paymentGateway')}
                  className="h-4 w-4 accent-[var(--color-industrial-yellow)]"
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-semibold text-[var(--color-off-white)]">
                    {method.label}
                  </span>
                  <span className="truncate text-xs leading-5 text-[var(--color-text-secondary)] sm:text-sm">
                    {method.enabled ? method.description : method.unavailableReason ?? method.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label
            data-testid="data-treatment-consent"
            className="flex min-h-12 items-start gap-3 rounded-[1rem] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2.5 text-xs leading-5 text-[var(--color-text-secondary)] sm:text-sm md:col-span-2"
          >
            <input type="checkbox" {...form.register('acceptsTerms')} className="mt-0.5 h-4 w-4 accent-[var(--color-industrial-yellow)]" />
            <span>
              Acepto el{' '}
              <Link
                href="/tratamiento-de-datos"
                className="font-semibold text-[var(--color-industrial-yellow)] underline-offset-4 hover:underline"
              >
                tratamiento de datos
              </Link>{' '}
              y la creación de mi solicitud.
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
        <CardBody className="space-y-1.5 p-3 sm:space-y-3 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-off-white)] sm:text-lg">
            Confirmación de compra
          </h3>
          <p className="text-xs leading-5 text-[var(--color-text-secondary)] sm:text-sm sm:leading-6">
            Revisa tu pedido antes de enviarlo. Te contactaremos si necesitamos confirmar algún detalle.
          </p>
          <p className="text-sm font-medium text-[var(--color-off-white)]">
            Subtotal: {summary.hasPricedItems ? summary.subtotalLabel : 'Por cotizar'}
          </p>
          {summary.hasQuoteItems ? (
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              Incluye productos por cotizar. Confirmaremos precio y disponibilidad antes de finalizar.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 grid gap-2 rounded-[1.2rem] border border-white/10 bg-[rgba(5,5,5,0.92)] p-2 shadow-elevated backdrop-blur sm:static sm:flex sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
        <Button
          type="submit"
          size="md"
          loading={form.formState.isSubmitting}
          disabled={!items.length}
        >
          Finalizar compra
        </Button>
        <p className="px-2 text-center text-xs leading-5 text-[var(--color-text-secondary)] sm:flex sm:items-center sm:text-left">
          Envío pendiente de confirmación operativa.
        </p>
      </div>
    </form>
  );
}
