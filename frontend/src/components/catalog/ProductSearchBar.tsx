import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ProductSearchBarProps {
  defaultValue?: string;
  action?: string;
  helperText?: string;
}

export function ProductSearchBar({
  defaultValue,
  action = '/storefront/buscar',
  helperText = 'Busca por nombre, marca, familia, categoría o referencia.',
}: ProductSearchBarProps) {
  return (
    <form action={action} className="grid gap-3 lg:grid-cols-[1fr_auto]">
      <Input
        name="q"
        defaultValue={defaultValue}
        aria-label="Buscar en catálogo"
        placeholder="Ej. taladro, soldadora, SKU o marca"
        helperText={helperText}
      />
      <Button type="submit" size="lg">
        Buscar
      </Button>
    </form>
  );
}
