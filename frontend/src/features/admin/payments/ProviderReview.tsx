"use client";
import { useState } from "react";
import { z } from "zod";
import { adminFailure } from "@/lib/admin/transport/result";
const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  refreshed: z.literal(false),
  operationalState: z.object({
    status: z.literal("provider_not_configured"),
    message: z.string(),
  }),
});
export function ProviderReview({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    kind: string;
    message: string;
  } | null>(null);
  return (
    <section className="rounded-xl border border-white/20 p-4">
      <h2 className="text-lg font-semibold">Consulta al proveedor</h2>
      <button
        type="button"
        disabled={pending}
        className="mt-3 rounded border border-white/30 px-4 py-2"
        onClick={async () => {
          setPending(true);
          setResult(null);
          try {
            const response = await fetch(
              `/api/admin/payments/${encodeURIComponent(id)}/refresh-status`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
                cache: "no-store",
              },
            );
            let body: unknown;
            try {
              body = await response.json();
            } catch {
              body = null;
            }
            if (!response.ok) {
              const failure = adminFailure(response.status, body);
              setResult({ kind: failure.kind, message: failure.error });
            } else {
              const parsed = statusSchema.safeParse(body);
              setResult(
                parsed.success
                  ? {
                      kind: "provider_blocked",
                      message: parsed.data.operationalState.message,
                    }
                  : {
                      kind: "contract_error",
                      message:
                        "No se pudo verificar la respuesta del proveedor.",
                    },
              );
            }
          } catch {
            setResult({
              kind: "network_error",
              message: "No se pudo conectar con el servicio de pagos.",
            });
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Consultando…" : "Revisar disponibilidad del proveedor"}
      </button>
      {result ? (
        <p role="status" data-state={result.kind} className="mt-3">
          {result.message}
        </p>
      ) : null}
    </section>
  );
}
