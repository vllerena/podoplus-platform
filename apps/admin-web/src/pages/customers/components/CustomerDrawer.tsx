import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@podoplus/ui";
import { useCreateCustomer, useUpdateCustomer, type CreateCustomerInput } from "@/hooks/use-customer-actions";
import type { Customer } from "@/hooks/use-customers";

interface Props {
  open:        boolean;
  onClose:     () => void;
  customer?:   Customer | null; // null = create mode
}

type FormValues = CreateCustomerInput;

const DOCUMENT_TYPES = ["DNI", "CE", "PASSPORT", "RUC", "OTHER"] as const;
const GENDERS        = [
  { value: "M",     label: "Masculino" },
  { value: "F",     label: "Femenino"  },
  { value: "OTHER", label: "Otro"      },
] as const;

export function CustomerDrawer({ open, onClose, customer }: Props) {
  const isEdit = !!customer;

  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? "");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      firstName:      "",
      lastName:       "",
      documentType:   undefined,
      documentNumber: "",
      phone:          "",
      email:          "",
      birthDate:      "",
      gender:         undefined,
      notes:          "",
      whatsappOptIn:  false,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (customer) {
      reset({
        firstName:      customer.firstName,
        lastName:       customer.lastName,
        documentType:   customer.documentType as any,
        documentNumber: customer.documentNumber ?? "",
        phone:          customer.phone          ?? "",
        email:          customer.email          ?? "",
        birthDate:      customer.birthDate      ?? "",
        gender:         customer.gender as any,
        notes:          customer.notes          ?? "",
        whatsappOptIn:  customer.whatsappOptIn,
      });
    } else {
      reset({
        firstName: "", lastName: "", documentType: undefined,
        documentNumber: "", phone: "", email: "", birthDate: "",
        gender: undefined, notes: "", whatsappOptIn: false,
      });
    }
  }, [customer, reset, open]);

  const onSubmit = async (values: FormValues) => {
    // Clean empty optional strings
    const payload: CreateCustomerInput = {
      firstName:  values.firstName.trim(),
      lastName:   values.lastName.trim(),
      ...(values.documentType   && { documentType:   values.documentType }),
      ...(values.documentNumber && { documentNumber: values.documentNumber.trim() }),
      ...(values.phone          && { phone:          values.phone.trim() }),
      ...(values.email          && { email:          values.email.trim() }),
      ...(values.birthDate      && { birthDate:      values.birthDate }),
      ...(values.gender         && { gender:         values.gender }),
      ...(values.notes          && { notes:          values.notes.trim() }),
      whatsappOptIn: values.whatsappOptIn,
    };

    try {
      if (isEdit) await update.mutateAsync(payload);
      else        await create.mutateAsync(payload);
      onClose();
    } catch { /* toasted in hook */ }
  };

  const docType = watch("documentType");
  const gender  = watch("gender");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos del cliente y guarda los cambios."
              : "Completa los datos para registrar un nuevo cliente."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {/* Nombre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Nombre *</Label>
              <Input
                id="firstName"
                placeholder="Juan"
                {...register("firstName", { required: "Requerido" })}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Apellido *</Label>
              <Input
                id="lastName"
                placeholder="Pérez"
                {...register("lastName", { required: "Requerido" })}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Documento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <Select
                value={docType ?? ""}
                onValueChange={(v) => setValue("documentType", v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="documentNumber">N° de documento</Label>
              <Input
                id="documentNumber"
                placeholder="12345678"
                {...register("documentNumber")}
              />
            </div>
          </div>

          {/* Teléfono y Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                placeholder="+51 987 654 321"
                {...register("phone")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                {...register("email")}
              />
            </div>
          </div>

          {/* Fecha de nacimiento y Género */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                {...register("birthDate")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Género</Label>
              <Select
                value={gender ?? ""}
                onValueChange={(v) => setValue("gender", v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* WhatsApp opt-in */}
          <div className="flex items-center gap-2">
            <input
              id="whatsappOptIn"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...register("whatsappOptIn")}
            />
            <Label htmlFor="whatsappOptIn" className="font-normal cursor-pointer">
              Acepta mensajes por WhatsApp
            </Label>
          </div>

          {/* Notas clínicas */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas clínicas</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones, alergias, condiciones relevantes..."
              rows={3}
              {...register("notes")}
            />
          </div>

          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit ? "Guardando..." : "Creando..."
                : isEdit ? "Guardar cambios" : "Crear cliente"
              }
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
