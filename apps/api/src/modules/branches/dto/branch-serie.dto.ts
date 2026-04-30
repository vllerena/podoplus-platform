import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Códigos de tipo de documento SUNAT admitidos para series.
 */
export const TIPO_DOC_CODES = [
  "01", // Factura Electrónica
  "03", // Boleta de Venta Electrónica
  "07", // Nota de Crédito
  "08", // Nota de Débito
  "NV", // Nota de Venta
  "04", // Liquidación de Compra
  "09", // Guía de Remisión
  "31", // Guía de Ingreso Almacén
  "32", // Guía de Salida Almacén
  "33", // Guía de Transferencia Almacén
] as const;

export type TipoDocCode = (typeof TIPO_DOC_CODES)[number];

export class CreateBranchSerieDto {
  @ApiProperty({
    description: "Código SUNAT del tipo de documento",
    enum: TIPO_DOC_CODES,
    example: "03",
  })
  @IsEnum(TIPO_DOC_CODES, {
    message: `tipoDocumento debe ser uno de: ${TIPO_DOC_CODES.join(", ")}`,
  })
  tipoDocumento: TipoDocCode;

  @ApiProperty({
    description: "Número de serie, e.g. 'B020', 'F020'",
    example: "B020",
  })
  @IsString()
  @IsNotEmpty({ message: "La serie no puede estar vacía" })
  @MaxLength(10, { message: "La serie no puede superar 10 caracteres" })
  serie: string;

  @ApiProperty({
    description: "Indica si es serie de contingencia",
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  contingencia?: boolean;
}
