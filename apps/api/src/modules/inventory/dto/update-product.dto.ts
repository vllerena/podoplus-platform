import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateProductDto {
  @ApiProperty({ example: "Crema podológica 500ml", description: "Nuevo nombre del producto (máx 200 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "El nombre no puede estar vacío" })
  @MaxLength(200, { message: "El nombre no puede superar 200 caracteres" })
  name?: string;

  @ApiProperty({ example: "Crema hidratante de uso podológico para pies secos y agrietados", description: "Nueva descripción del producto (máx 1000 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "La descripción no puede superar 1000 caracteres" })
  description?: string;

  @ApiProperty({ example: "bottle", description: "Nuevo tipo de unidad: unit, box, bottle, pair, bag, other", required: false })
  @IsOptional()
  @IsEnum(["unit", "box", "bottle", "pair", "bag", "other"], {
    message: "unit_type debe ser unit, box, bottle, pair, bag u other",
  })
  unit_type?: string;

  @ApiProperty({ example: 15.00, description: "Nuevo precio de costo (≥ 0)", required: false })
  @IsOptional()
  @IsNumber({}, { message: "cost_price debe ser un número" })
  @Min(0,          { message: "El precio de costo no puede ser negativo" })
  @Max(999_999.99, { message: "El precio de costo excede el máximo permitido" })
  cost_price?: number;

  @ApiProperty({ example: 30.00, description: "Nuevo precio de venta (≥ 0)", required: false })
  @IsOptional()
  @IsNumber({}, { message: "sale_price debe ser un número" })
  @Min(0,          { message: "El precio de venta no puede ser negativo" })
  @Max(999_999.99, { message: "El precio de venta excede el máximo permitido" })
  sale_price?: number;

  @ApiProperty({ example: true, description: "Indica si el producto está activo", required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  // ─── Campos SUNAT ─────────────────────────────────────────────────
  @ApiProperty({ example: "PROD-001", description: "Código interno del producto (máx 50 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  internal_code?: string;

  @ApiProperty({ example: "50101501", description: "Código de producto SUNAT (máx 20 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sunat_product_code?: string;

  @ApiProperty({ example: "NIU", description: "Código de unidad de medida SUNAT (máx 10 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit_type_code?: string;

  @ApiProperty({ example: "10", description: "Código de afectación IGV SUNAT (máx 10 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  igv_affectation_code?: string;

  @ApiProperty({ example: true, description: "Indica si el precio de venta incluye IGV", required: false })
  @IsOptional()
  @IsBoolean()
  has_igv?: boolean;
}
