import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
  Button, Input, Label,
} from "@podoplus/ui";
import { useCreateProduct, useUpdateProduct, type Product } from "@/hooks/use-inventory";

interface Props {
  open:     boolean;
  product?: Product | null;
  onClose:  () => void;
}

const EMPTY = {
  sku:        "",
  name:       "",
  description:"",
  unit_type:  "",
  cost_price: "",
  sale_price: "",
};

export function ProductDrawer({ open, product, onClose }: Props) {
  const isEdit = !!product;
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (product) {
      setForm({
        sku:         product.sku,
        name:        product.name,
        description: product.description ?? "",
        unit_type:   product.unit_type,
        cost_price:  product.cost_price,
        sale_price:  product.sale_price,
      });
    } else {
      setForm(EMPTY);
    }
  }, [product, open]);

  const create = useCreateProduct();
  const update = useUpdateProduct();
  const isPending = create.isPending || update.isPending;

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sku:         form.sku.trim(),
      name:        form.name.trim(),
      description: form.description.trim() || undefined,
      unit_type:   form.unit_type.trim(),
      cost_price:  parseFloat(form.cost_price),
      sale_price:  parseFloat(form.sale_price),
    };
    if (isNaN(payload.cost_price) || isNaN(payload.sale_price)) return;

    try {
      if (isEdit) await update.mutateAsync({ id: product!.id, ...payload });
      else        await create.mutateAsync(payload);
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos del producto. El SKU no se puede cambiar."
              : "Completa los datos para crear un nuevo producto en el catálogo."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU *</Label>
              <Input
                id="p-sku"
                placeholder="CHP-001"
                value={form.sku}
                onChange={set("sku")}
                disabled={isEdit}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-unit">Unidad *</Label>
              <Input
                id="p-unit"
                placeholder="unidad, frasco, caja…"
                value={form.unit_type}
                onChange={set("unit_type")}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nombre *</Label>
            <Input
              id="p-name"
              placeholder="Nombre del producto"
              value={form.name}
              onChange={set("name")}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Descripción</Label>
            <Input
              id="p-desc"
              placeholder="Descripción opcional"
              value={form.description}
              onChange={set("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">Precio costo (S/) *</Label>
              <Input
                id="p-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.cost_price}
                onChange={set("cost_price")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sale">Precio venta (S/) *</Label>
              <Input
                id="p-sale"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.sale_price}
                onChange={set("sale_price")}
                required
              />
            </div>
          </div>

          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
