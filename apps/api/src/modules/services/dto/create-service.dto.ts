import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// Códigos válidos de afectación IGV (SUNAT Tabla 7)
export const IGV_AFFECTATION_CODES = ["10", "20", "30", "40"] as const;
// 10 = Gravado - Operación Onerosa
// 20 = Exonerado - Operación Onerosa
// 30 = Inafecto - Operación Onerosa
// 40 = Exportación

// Códigos de unidad de medida relevantes para servicios (SUNAT Tabla 6)
export const UNIT_TYPE_CODES = ["ZZ", "NIU", "HUR", "MES"] as const;
// ZZ  = Actividad de Servicio (default)
// NIU = Unidad
// HUR = Hora
// MES = Mes

export class CreateServiceDto {
  @ApiProperty({ example: "Podología General", description: "Nombre del servicio (2–150 caracteres)" })
  @IsString()
  @IsNotEmpty({ message: "El nombre del servicio es requerido" })
  @MinLength(2, { message: "El nombre debe tener al menos 2 caracteres" })
  @MaxLength(150, { message: "El nombre no puede superar 150 caracteres" })
  name: string;

  @ApiProperty({ example: "Servicio completo de podología preventiva y curativa", description: "Descripción del servicio", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "La descripción no puede superar 2000 caracteres" })
  description?: string;

  @ApiProperty({
    example: 30,
    description:
      "Duración del servicio en minutos (0–480). " +
      "0 = servicio instantáneo / sin cita (ej: gift cards, accesorios, separación de cita).",
  })
  @IsInt({ message: "durationMinutes debe ser un número entero" })
  @Min(0,   { message: "durationMinutes no puede ser negativo" })
  @Max(480, { message: "La duración máxima es 480 minutos (8 horas)" })
  durationMinutes: number;

  @ApiProperty({ example: 10, description: "Tiempo de buffer tras la cita en minutos (0–120)", required: false })
  @IsOptional()
  @IsInt({ message: "bufferMinutes debe ser un número entero" })
  @Min(0,   { message: "bufferMinutes no puede ser negativo" })
  @Max(120, { message: "El buffer máximo es 120 minutos" })
  bufferMinutes?: number;

  @ApiProperty({ example: 80.00, description: "Precio base del servicio (≥ 0)" })
  @IsNumber({}, { message: "basePrice debe ser un número" })
  @Min(0,          { message: "El precio no puede ser negativo" })
  @Max(999_999.99, { message: "El precio supera el máximo permitido" })
  basePrice: number;

  @ApiProperty({ example: true, description: "Permite autoservicio desde el portal de reservas", required: false })
  @IsOptional()
  @IsBoolean()
  allowSelfService?: boolean;

  @ApiProperty({ example: "#3B82F6", description: "Color de identificación en formato hexadecimal", required: false })
  @IsOptional()
  @IsHexColor({ message: "color debe ser un color hexadecimal válido (ej: #3B82F6)" })
  color?: string;

  @ApiProperty({ example: "clx1abc123", description: "ID de la categoría a la que pertenece el servicio", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "categoryId no puede ser una cadena vacía" })
  categoryId?: string;

  // ── Campos SUNAT/Facturación ─────────────────────────────────────────────

  @ApiProperty({ example: "SRV-001", description: "Código interno del servicio (máx 50 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "internalCode no puede superar 50 caracteres" })
  internalCode?: string;

  @ApiProperty({ example: "S001", description: "Código de producto SUNAT (máx 20 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: "sunatProductCode no puede superar 20 caracteres" })
  sunatProductCode?: string;

  @ApiProperty({ example: "ZZ", description: "Código de unidad de medida SUNAT: ZZ=Servicio, NIU=Unidad, HUR=Hora, MES=Mes", required: false })
  @IsOptional()
  @IsEnum(UNIT_TYPE_CODES, {
    message: `unitTypeCode debe ser uno de: ${UNIT_TYPE_CODES.join(", ")}`,
  })
  unitTypeCode?: string;

  @ApiProperty({ example: "10", description: "Código de afectación IGV SUNAT: 10=Gravado, 20=Exonerado, 30=Inafecto, 40=Exportación", required: false })
  @IsOptional()
  @IsEnum(IGV_AFFECTATION_CODES, {
    message: `igvAffectationCode debe ser uno de: ${IGV_AFFECTATION_CODES.join(", ")} (10=Gravado, 20=Exonerado, 30=Inafecto)`,
  })
  igvAffectationCode?: string;

  @ApiProperty({ example: true, description: "Indica si el precio base incluye IGV", required: false })
  @IsOptional()
  @IsBoolean()
  hasIgv?: boolean;
}
