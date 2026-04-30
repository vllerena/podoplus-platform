import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "YAPE"
  | "PLIN"
  | "TRANSFER"
  | "MIXED";

export type ItemType = "PRODUCT" | "SERVICE" | "PLAN";

export class SaleItemDto {
  @ApiProperty({
    description: "Tipo de ítem de la venta",
    enum: ["PRODUCT", "SERVICE", "PLAN"],
    example: "SERVICE",
  })
  @IsEnum(["PRODUCT", "SERVICE", "PLAN"], {
    message: "item_type debe ser PRODUCT, SERVICE o PLAN",
  })
  item_type: ItemType;

  @ApiProperty({
    description: "ID del producto (requerido si item_type es PRODUCT)",
    example: "prod_abc123",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "product_id no puede ser una cadena vacía" })
  product_id?: string;

  @ApiProperty({
    description: "ID del servicio (requerido si item_type es SERVICE)",
    example: "svc_xyz789",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "service_id no puede ser una cadena vacía" })
  service_id?: string;

  @ApiProperty({
    description: "ID del plan (requerido si item_type es PLAN)",
    example: "plan_def456",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "plan_id no puede ser una cadena vacía" })
  plan_id?: string;

  @ApiProperty({
    description: "Cantidad de unidades del ítem",
    example: 1,
  })
  @IsInt({ message: "quantity debe ser un entero positivo" })
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: "Precio unitario del ítem",
    example: 50.00,
  })
  @IsNumber({}, { message: "unit_price debe ser un número" })
  @Min(0)
  @Max(999_999.99)
  unit_price: number;
}

export class CustomerBillingDto {
  @IsOptional() @IsString() tipo_doc?: string;   // "1"=DNI, "6"=RUC
  @IsOptional() @IsString() num_doc?: string;
  @IsOptional() @IsString() razon_social?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() ubigeo?: string;
}

export class CreateSaleDto {
  @ApiProperty({
    description: "ID de la sede donde se registra la venta",
    example: "branch_abc123",
  })
  @IsNotEmpty()
  @IsString()
  branch_id: string;

  @ApiProperty({
    description: "ID del cliente asociado a la venta",
    example: "cust_xyz789",
    required: false,
  })
  @IsOptional()
  @IsString()
  customer_id?: string;

  @ApiProperty({
    description: "ID de la cita asociada a la venta",
    example: "appt_def456",
    required: false,
  })
  @IsOptional()
  @IsString()
  appointment_id?: string;

  @ApiProperty({
    description: "Lista de ítems de la venta (mínimo 1, máximo 50)",
    type: [SaleItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: "La venta debe tener al menos un ítem" })
  @ArrayMaxSize(50, { message: "La venta no puede tener más de 50 ítems" })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiProperty({
    description: "Monto de descuento aplicado a la venta",
    example: 10.00,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "discount_amount debe ser un número" })
  @Min(0)
  @Max(999_999.99)
  discount_amount?: number;

  @ApiProperty({
    description: "Método de pago utilizado",
    enum: ["CASH", "CARD", "YAPE", "PLIN", "TRANSFER", "MIXED"],
    example: "CASH",
  })
  @IsEnum(["CASH", "CARD", "YAPE", "PLIN", "TRANSFER", "MIXED"], {
    message: "payment_method inválido. Valores: CASH, CARD, YAPE, PLIN, TRANSFER, MIXED",
  })
  payment_method: PaymentMethod;

  @ApiProperty({
    description: "Notas adicionales sobre la venta",
    example: "Cliente solicitó factura.",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "notes no puede superar 500 caracteres" })
  notes?: string;

  @ApiProperty({
    description: "Clave de idempotencia para evitar duplicados",
    example: "idem_key_20260411_001",
    required: false,
  })
  @IsOptional()
  @IsString()
  idempotency_key?: string;

  // ── Facturación electrónica ──────────────────────────────────────────────
  @ApiProperty({
    description: "Tipo de comprobante: '01'=Factura, '03'=Boleta",
    example: "03",
    required: false,
  })
  @IsOptional()
  @IsEnum(["01", "03"], { message: "tipo_comprobante debe ser '01' (Factura) o '03' (Boleta)" })
  tipo_comprobante?: "01" | "03";

  @ApiProperty({
    description: "Serie del comprobante, e.g. 'B020' o 'F020'",
    example: "B020",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  serie_documento?: string;

  @ApiProperty({
    description: "Datos del receptor para la factura/boleta",
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerBillingDto)
  customer_billing?: CustomerBillingDto;
}
