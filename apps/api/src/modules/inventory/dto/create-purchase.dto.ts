import {
  IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber,
  IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export const VOUCHER_TYPES = [
  "FACTURA", "BOLETA", "NOTA_ENTRADA", "LIQUIDACION", "TICKET", "OTHER",
] as const;

export const CURRENCIES = ["PEN", "USD"] as const;

export class CreatePurchaseItemDto {
  @ApiProperty({ example: "clx1product01", description: "ID del producto" })
  @IsString()
  @IsNotEmpty()
  product_id: string;

  @ApiProperty({ example: "clx1branch01", description: "ID de la sede/almacén de destino" })
  @IsString()
  @IsNotEmpty()
  branch_id: string;

  @ApiProperty({ example: "L20250430", description: "Número de lote del producto", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lot?: string;

  @ApiProperty({ example: "NIU", description: "Código de unidad (NIU, KGM, etc.)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit_type_code?: string;

  @ApiProperty({ example: 10, description: "Cantidad recibida (decimal, ej. 10.5)" })
  @IsNumber({}, { message: "quantity debe ser un número" })
  @Min(0.0001, { message: "quantity debe ser mayor a 0" })
  @Max(999_999)
  quantity: number;

  @ApiProperty({ example: 55.93, description: "Valor unitario sin IGV" })
  @IsNumber()
  @Min(0)
  @Max(999_999.999999)
  unit_value: number;

  @ApiProperty({ example: 65.99, description: "Precio unitario con IGV" })
  @IsNumber()
  @Min(0)
  @Max(999_999.999999)
  unit_price: number;

  @ApiProperty({ example: 0, description: "Descuento por ítem", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ example: 0, description: "Cargo adicional por ítem", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  charge?: number;

  @ApiProperty({ example: 659.90, description: "Total del ítem" })
  @IsNumber()
  @Min(0)
  total_amount: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ example: "clx1bu01", description: "ID de la razón social compradora", required: false })
  @IsOptional()
  @IsString()
  business_unit_id?: string;

  @ApiProperty({ example: "clx1supplier01", description: "ID del proveedor" })
  @IsString()
  @IsNotEmpty({ message: "supplier_id es requerido" })
  supplier_id: string;

  @ApiProperty({
    example: "NOTA_ENTRADA",
    description: "Tipo de comprobante: FACTURA | BOLETA | NOTA_ENTRADA | LIQUIDACION | TICKET | OTHER",
  })
  @IsEnum(VOUCHER_TYPES, { message: "voucher_type inválido" })
  voucher_type: string;

  @ApiProperty({ example: "PP", description: "Serie del comprobante" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  serie: string;

  @ApiProperty({ example: "4723", description: "Número del comprobante" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number: string;

  @ApiProperty({ example: "2026-04-27", description: "Fecha de emisión (YYYY-MM-DD)" })
  @IsDateString({}, { message: "emission_date debe ser una fecha válida (YYYY-MM-DD)" })
  emission_date: string;

  @ApiProperty({ example: "2026-04-27", description: "Fecha de vencimiento (YYYY-MM-DD)", required: false })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiProperty({ example: "PEN", description: "Moneda: PEN | USD", required: false })
  @IsOptional()
  @IsEnum(CURRENCIES, { message: "currency debe ser PEN o USD" })
  currency?: string;

  @ApiProperty({ example: 3.478, description: "Tipo de cambio (solo relevante si currency=USD)", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  exchange_rate?: number;

  @ApiProperty({ example: 0, description: "Subtotal sin impuestos", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiProperty({ example: 0, description: "IGV u otros impuestos", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @ApiProperty({ example: 0, description: "Total de la compra", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @ApiProperty({ example: "Pedido mensual de productos Foot Works", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseItemDto], description: "Ítems de la compra", required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items?: CreatePurchaseItemDto[];
}
