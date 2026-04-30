import {
  IsArray, IsDateString, IsEnum, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { CreatePurchaseItemDto, VOUCHER_TYPES, CURRENCIES } from "./create-purchase.dto";

/**
 * DTO para actualizar una compra en estado DRAFT.
 * Todos los campos son opcionales. Los ítems se reemplazan en bloque
 * si se envían (si se omiten, quedan sin cambios).
 * El supplier_id no se puede cambiar en un update.
 */
export class UpdatePurchaseDto {
  @ApiProperty({ example: "clx1bu01", required: false })
  @IsOptional()
  @IsString()
  business_unit_id?: string;

  @ApiProperty({ example: "NOTA_ENTRADA", required: false })
  @IsOptional()
  @IsEnum(VOUCHER_TYPES, { message: "voucher_type inválido" })
  voucher_type?: string;

  @ApiProperty({ example: "PP", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  serie?: string;

  @ApiProperty({ example: "4723", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @ApiProperty({ example: "2026-04-27", required: false })
  @IsOptional()
  @IsDateString({}, { message: "emission_date debe ser una fecha válida (YYYY-MM-DD)" })
  emission_date?: string;

  @ApiProperty({ example: "2026-04-27", required: false })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiProperty({ example: "PEN", required: false })
  @IsOptional()
  @IsEnum(CURRENCIES, { message: "currency debe ser PEN o USD" })
  currency?: string;

  @ApiProperty({ example: 3.478, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  exchange_rate?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @ApiProperty({ example: "Pedido mensual", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items?: CreatePurchaseItemDto[];
}
