'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StorefrontButton } from '@/components/storefront/StorefrontButton';
import {
  StorefrontCheckbox,
  StorefrontInput,
  StorefrontSelect,
  StorefrontTextarea,
} from '@/components/storefront/StorefrontFields';

const contactReasons = [
  'Comprar',
  'Consultar pedido',
  'Garantías y cambios',
  'Asesoría técnica',
];

export function ContactRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-soft sm:gap-4 sm:p-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const required = ['fullName', 'phone', 'reason', 'message'];
        const missing = required.some((key) => !String(form.get(key) ?? '').trim());
        const accepts = form.get('acceptsDataTreatment') === 'on';

        if (missing || !accepts) {
          setSubmitted(false);
          setError('Completa los campos requeridos y acepta el tratamiento de datos.');
          return;
        }

        setError(null);
        setSubmitted(true);
      }}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
          Solicitud
        </p>
        <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
          Enviar solicitud
        </h2>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          No se finge envío automático: sin proveedor de notificaciones, la solicitud queda preparada para atención manual.
        </p>
      </div>

      <StorefrontInput
        name="fullName"
        label="Nombre completo"
        autoComplete="name"
        required
      />
      <StorefrontInput
        name="phone"
        label="Teléfono"
        inputMode="tel"
        autoComplete="tel"
        required
      />
      <StorefrontInput
        name="email"
        label="Correo opcional"
        type="email"
        autoComplete="email"
      />
      <StorefrontSelect name="reason" label="Motivo" required>
        <option value="">Selecciona</option>
        {contactReasons.map((reason) => (
          <option key={reason} value={reason}>{reason}</option>
        ))}
      </StorefrontSelect>
      <StorefrontTextarea
        name="message"
        label="Mensaje"
        rows={4}
        required
        placeholder="Cuéntanos qué producto, pedido o soporte necesitas."
      />
      <StorefrontCheckbox
        name="acceptsDataTreatment"
        required
        label={
          <>
          Acepto el{' '}
          <Link
            href="/tratamiento-de-datos"
            className="font-semibold text-[var(--color-industrial-yellow)] underline-offset-4 hover:underline"
          >
            tratamiento de datos
          </Link>{' '}
          para gestionar mi solicitud.
          </>
        }
      />

      {error ? <p className="text-sm text-[var(--color-error-red)]">{error}</p> : null}
      {submitted ? (
        <p className="rounded-xl border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)] p-3 text-sm text-[#86efac]">
          Solicitud preparada para atención manual. Usa WhatsApp si necesitas respuesta inmediata.
        </p>
      ) : null}

      <StorefrontButton type="submit">
        Enviar solicitud
      </StorefrontButton>
    </form>
  );
}
