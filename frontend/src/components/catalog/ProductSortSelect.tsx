interface ProductSortSelectProps {
  defaultValue?: string;
}

export function ProductSortSelect({ defaultValue = 'featured' }: ProductSortSelectProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm font-medium text-[var(--color-graphite-black)]">
      Ordenar
      <select
        name="sort"
        defaultValue={defaultValue}
        className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
      >
        <option value="featured">Catálogo real</option>
        <option value="name-asc">Nombre A-Z</option>
        <option value="name-desc">Nombre Z-A</option>
        <option value="price-asc">Precio menor a mayor</option>
        <option value="price-desc">Precio mayor a menor</option>
      </select>
    </label>
  );
}
