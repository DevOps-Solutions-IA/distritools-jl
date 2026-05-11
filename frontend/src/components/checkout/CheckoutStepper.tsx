'use client';

const steps = ['Carrito', 'Datos', 'Pedido', 'Pago'];

export function CheckoutStepper() {
  return (
    <ol className="grid grid-cols-2 gap-2 rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft sm:rounded-[1.75rem] sm:p-5 md:grid-cols-4">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(249,115,22,0.14)] text-xs font-semibold text-[var(--color-industrial-orange)] sm:h-8 sm:w-8 sm:text-sm">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-[var(--color-off-white)] sm:text-sm">{step}</span>
        </li>
      ))}
    </ol>
  );
}
