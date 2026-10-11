"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { catalogRequest, CatalogRequestError } from "./request";
import {
  confirmedImageApproval,
  parseMediaResources,
  type MediaProduct,
  type MediaResource,
} from "./media-contract";

export function MediaApproval({
  value,
  onChange,
  product,
  canRead,
  canApprove,
  onApproved,
}: {
  value: string;
  onChange: (value: string) => void;
  product: MediaProduct | null;
  canRead: boolean;
  canApprove: boolean;
  onApproved: (product: MediaProduct) => void;
}) {
  const [resources, setResources] = useState<MediaResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    async function load() {
      try {
        const response = await fetch("/api/admin/media-resources", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Sesión vencida. Inicia sesión para consultar imágenes."
              : response.status === 403
                ? "Sin permiso para consultar imágenes."
                : "No fue posible cargar los recursos de imagen.",
          );
        const parsed = parseMediaResources(await response.json());
        if (!parsed)
          throw new Error("No se pudo verificar el registro de imágenes.");
        if (active) setResources(parsed);
      } catch (caught) {
        if (active)
          setError(
            controller.signal.aborted
              ? "La consulta de imágenes tardó demasiado. Recarga para continuar."
              : caught instanceof Error
                ? caught.message
                : "Error al consultar imágenes.",
          );
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [canRead]);
  const loading = canRead && resources === null && error === null;
  const selected = resources?.find((resource) => resource.assetPath === value);
  const saved = product?.metadata.image?.assetPath === value;
  const approved = saved && product?.metadata.image?.status === "approved";
  async function approve() {
    if (!selected || !saved || !product || !canApprove || busy || uncertain)
      return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await catalogRequest(
        `/api/admin/products/${product.id}/image-approval`,
        "POST",
        {
          ...selected,
          expectedUpdatedAt: product.updatedAt,
          reason: reason.trim(),
        },
      );
      const confirmed = confirmedImageApproval(response, selected);
      if (!confirmed || confirmed.id !== product.id)
        throw new CatalogRequestError(
          "No se pudo confirmar la aprobación. Recarga el producto antes de repetir.",
          true,
        );
      onApproved(confirmed);
      setSuccess("Imagen aprobada y auditada.");
    } catch (caught) {
      setError(
        caught instanceof CatalogRequestError && caught.status === 409
          ? "La imagen o el producto cambió. Recarga el producto antes de aprobar."
          : caught instanceof Error
            ? caught.message
            : "No se pudo aprobar la imagen.",
      );
      if (caught instanceof CatalogRequestError && caught.uncertain)
        setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-semibold">
        Imagen principal (recurso existente)
        <select
          aria-label="Imagen principal (recurso existente)"
          className="focus-ring h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3"
          value={value}
          disabled={!canRead || loading || busy}
          onChange={(event) => {
            onChange(event.target.value);
            setSuccess(null);
          }}
        >
          <option value="">Sin imagen</option>
          {value && !selected ? (
            <option value={value}>{value} (imagen actual)</option>
          ) : null}
          {resources?.map((resource) => (
            <option key={resource.assetPath} value={resource.assetPath}>
              {resource.assetPath}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <Image
          src={selected.assetPath}
          alt="Vista previa de la imagen seleccionada"
          width={240}
          height={180}
          className="max-h-44 max-w-full rounded-md object-contain"
        />
      ) : null}
      {loading ? <p role="status">Cargando imágenes registradas…</p> : null}
      {!canRead ? (
        <p role="status">Sin permiso para consultar recursos de imagen.</p>
      ) : null}
      <p className="text-sm text-[var(--color-text-secondary)]">
        {approved
          ? "Imagen actual aprobada."
          : saved
            ? "Imagen guardada pendiente de aprobación."
            : "Guarda el producto con la imagen seleccionada antes de aprobarla."}
      </p>
      {canApprove && selected && saved && !approved ? (
        <>
          <Input
            label="Motivo de aprobación"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy || uncertain}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void approve()}
            loading={busy}
            disabled={reason.trim().length < 3 || uncertain}
          >
            Aprobar imagen guardada
          </Button>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {success ? <p role="status">{success}</p> : null}
    </div>
  );
}
