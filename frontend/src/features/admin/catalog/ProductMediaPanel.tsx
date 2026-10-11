"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MediaApproval } from "./MediaApproval";
import { parseMediaProduct, type MediaProduct } from "./media-contract";
import { catalogRequest, CatalogRequestError } from "./request";
import { useCatalogPermissions } from "./useCatalogPermissions";

export function ProductMediaPanel({ initialProduct }: { initialProduct: MediaProduct }) {
  const permissions = useCatalogPermissions("product-media");
  const [product, setProduct] = useState(initialProduct);
  const [value, setValue] = useState(initialProduct.metadata.image?.assetPath ?? "");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const changed = value !== (product.metadata.image?.assetPath ?? "");

  async function saveImage() {
    if (!permissions.can("products.write") || !changed || busy || uncertain) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const path = `/api/admin/products/${encodeURIComponent(product.id)}`;
      const currentResponse = await fetch(path, { cache: "no-store", signal: controller.signal });
      if (!currentResponse.ok) throw new Error(`No se pudo consultar la imagen guardada (HTTP ${currentResponse.status}).`);
      const current = parseMediaProduct(await currentResponse.json());
      if (!current || current.id !== product.id) throw new Error("No se pudo verificar el producto guardado.");
      if (current.updatedAt !== product.updatedAt) throw new Error("El producto cambió. Recarga antes de guardar la imagen.");
      const response = await catalogRequest(path, "PATCH", {
        metadata: { ...current.metadata, image: { assetPath: value || null, status: "pending" } },
      });
      const saved = parseMediaProduct(response);
      if (!saved || saved.id !== product.id || (saved.metadata.image?.assetPath ?? "") !== value || saved.metadata.image?.status !== "pending" || saved.metadata.image?.approval) {
        throw new CatalogRequestError("No se pudo confirmar la imagen guardada. Recarga antes de repetir.", true);
      }
      setProduct(saved);
      setSuccess("Imagen guardada pendiente de aprobación.");
    } catch (caught) {
      setError(controller.signal.aborted ? "La consulta tardó demasiado. Recarga antes de continuar." : caught instanceof Error ? caught.message : "No se pudo guardar la imagen.");
      if (caught instanceof CatalogRequestError && caught.uncertain) setUncertain(true);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 rounded-[1.75rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5 sm:p-7" aria-label="Imagen del producto">
      <h2 className="text-xl font-semibold">Imagen del producto</h2>
      <fieldset className="grid min-w-0 grid-cols-1 gap-3" disabled={busy || uncertain}>
        <MediaApproval value={value} onChange={(next) => { setValue(next); setSuccess(null); }} product={product} canRead={permissions.can("products.read")} canApprove={permissions.can("products.write") && !busy && !uncertain} onApproved={setProduct} />
        {permissions.can("products.write") ? <Button type="button" disabled={!changed || busy || uncertain} onClick={saveImage}>Guardar imagen seleccionada</Button> : <p role="status">Sin permiso para guardar o aprobar imágenes.</p>}
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      {success ? <p role="status">{success}</p> : null}
    </section>
  );
}
