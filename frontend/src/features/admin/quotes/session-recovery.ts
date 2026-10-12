"use client";
import { useEffect, useRef } from "react";
import { parseAdminSessionContext } from "@/lib/admin/transport/session-contract";
type SessionConfirmation = { expired: boolean; message: string };
async function confirmSession(
  signal: AbortSignal,
): Promise<SessionConfirmation> {
  try {
    const response = await fetch("/api/admin/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 401)
      return {
        expired: true,
        message: "La sesión finalizó. Inicie sesión para continuar.",
      };
    if (response.status === 403)
      return {
        expired: false,
        message:
          "No se pudo confirmar la sesión: acceso denegado. No se confirmó la operación.",
      };
    if (!response.ok)
      return {
        expired: false,
        message:
          "No se pudo confirmar la sesión por un error del servicio. Consulte el estado antes de repetir la operación.",
      };
    const payload: unknown = await response.json().catch(() => null);
    if (response.status !== 200 || !parseAdminSessionContext(payload))
      return {
        expired: false,
        message:
          "Respuesta de sesión inválida. No se confirmó la operación; consulte el estado antes de repetir.",
      };
    return {
      expired: false,
      message:
        "La sesión está vigente. No se confirmó la operación; consulte el estado antes de repetir.",
    };
  } catch {
    return {
      expired: false,
      message:
        "No se pudo confirmar la sesión. Consulte el estado antes de repetir la operación.",
    };
  }
}
/** Only the existing self-context GET401 clears cookies at the BFF boundary. */
export function useCrmSessionRecovery() {
  const scope = useRef({
    active: false,
    generation: 0,
    cancel: null as (() => void) | null,
  });
  useEffect(() => {
    const current = scope.current;
    current.active = true;
    return () => {
      current.active = false;
      current.generation += 1;
      current.cancel?.();
      current.cancel = null;
    };
  }, []);
  return {
    capture() {
      const generation = scope.current.generation;
      return () =>
        scope.current.active && scope.current.generation === generation;
    },
    async recover(isCurrent: () => boolean): Promise<string | null> {
      if (!isCurrent()) return null;
      scope.current.cancel?.();
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout>;
      let cancel!: () => void;
      const bounded = new Promise<SessionConfirmation | null>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({
            expired: false,
            message:
              "No se pudo confirmar la sesión dentro del tiempo disponible. Consulte el estado antes de repetir la operación.",
          });
        }, 12000);
        cancel = () => {
          clearTimeout(timer);
          controller.abort();
          resolve(null);
        };
      });
      scope.current.cancel = cancel;
      try {
        const confirmation = await Promise.race([
          confirmSession(controller.signal),
          bounded,
        ]);
        if (!isCurrent() || !confirmation) return null;
        if (confirmation.expired && !controller.signal.aborted)
          globalThis.location.assign("/admin/login");
        return confirmation.message;
      } finally {
        clearTimeout(timer!);
        if (scope.current.cancel === cancel) scope.current.cancel = null;
      }
    },
  };
}
