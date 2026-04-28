'use client';

const steps = ['Carrito', 'Datos', 'Orden', 'Pago informativo'];

export function CheckoutStepper() {
  return (
    <ol className="grid gap-3 rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-soft md:grid-cols-4">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(249,115,22,0.14)] text-sm font-semibold text-[var(--color-industrial-orange)]">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-[var(--color-off-white)]">{step}</span>
        </li>
      ))}
    </ol>
  );
}
