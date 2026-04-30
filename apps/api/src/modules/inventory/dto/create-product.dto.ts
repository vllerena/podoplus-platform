import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateProductDto {
  @ApiProperty({ example: "PROD-001", description: "SKU único del producto (letras, números, guiones y guiones bajos, máx 50 caracteres)" })
  @IsString()
  @IsNotEmpty({ message: "El SKU es requerido" })
  @MaxLength(50, { message: "El SKU no puede superar 50 caracteres" })
  @Matches(/^[A-Za-z0-9\-_]+$/, {
    message: "El SKU solo puede contener letras, números, guiones y guiones bajos",
  })
  sku: string;

  @ApiProperty({ example: "Crema podológica 250ml", description: "Nombre del producto (máx 200 caracteres)" })
  @IsString()
  @IsNotEmpty({ message: "El nombre es requerido" })
  @MaxLength(200, { message: "El nombre no puede superar 200 caracteres" })
  name: string;

  @ApiProperty({ example: "Crema hidratante de uso podológico para pies secos y agrietados", description: "Descripción del producto (máx 1000 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "La descripción no puede superar 1000 caracteres" })
  description?: string;

  @ApiProperty({ example: "unit", description: "Tipo de unidad del producto: unit, box, bottle, pair, bag, other" })
  @IsEnum(["unit", "box", "bottle", "pair", "bag", "other"], {
    message: "unit_type debe ser unit, box, bottle, pair, bag u other",
  })
  unit_type: string;

  @ApiProperty({ example: 12.50, description: "Precio de costo del producto (≥ 0, default 0)", required: false })
  @IsOptional()
  @IsNumber({}, { message: "cost_price debe ser un número" })
  @Min(0,          { message: "El precio de costo no puede ser negativo" })
  @Max(999_999.99, { message: "El precio de costo excede el máximo permitido" })
  cost_price?: number;

  @ApiProperty({ example: 25.00, description: "Precio de venta del producto (≥ 0)" })
  @IsNumber({}, { message: "sale_price debe ser un número" })
  @Min(0,          { message: "El precio de venta no puede ser negativo" })
  @Max(999_999.99, { message: "El precio de venta excede el máximo permitido" })
  sale_price: number;

  @ApiProperty({ example: true, description: "Indica si el producto está activo", required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  // ─── Campos SUNAT (facturación electrónica) ───────────────────────
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

  @ApiProperty({ example: "10", description: "Código de afectación IGV SUNAT: 10=Gravado, 20=Exonerado, 30=Inafecto (máx 10 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  igv_affectation_code?: string;

  @ApiProperty({ example: true, description: "Indica si el precio de venta incluye IGV", required: false })
  @IsOptional()
  @IsBoolean()
  has_igv?: boolean;
}
