'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  type ContentStatus,
  type Step,
  permittedSteps,
  stepLabel,
} from './contracts';

export function WorkflowControls({
  domain,
  status,
  version,
  permissions,
  busy,
  dirty = false,
  onStep,
}: {
  domain: 'legal' | 'footer';
  status: ContentStatus;
  version: number;
  permissions: string[];
  busy: boolean;
  dirty?: boolean;
  onStep: (step: Step) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<Step | null>(null);
  const steps = permittedSteps(domain, status, permissions);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {steps.map((step) => (
          <Button
            key={step}
            type="button"
            variant={step === 'publish' ? 'primary' : 'outline'}
            disabled={busy || dirty}
            onClick={() => setConfirm(step)}
          >
            {stepLabel[step]}
          </Button>
        ))}
      </div>
      {dirty ? (
        <p className="text-sm text-amber-200">
          Guarde los cambios antes de cambiar el estado.
        </p>
      ) : null}
      {confirm && steps.includes(confirm) ? (
        <div
          role="group"
          aria-label="Confirmar cambio de estado"
          className="rounded-xl border border-amber-300/30 p-4 space-y-3"
        >
          <p>
            {stepLabel[confirm]} · versión {version}.{' '}
            {confirm === 'publish'
              ? 'La versión publicada actual quedará archivada.'
              : 'La operación quedará registrada en auditoría.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy || dirty}
              onClick={async () => {
                if (busy || dirty || !steps.includes(confirm)) return;
                await onStep(confirm);
                setConfirm(null);
              }}
            >
              Confirmar {stepLabel[confirm].toLowerCase()}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
