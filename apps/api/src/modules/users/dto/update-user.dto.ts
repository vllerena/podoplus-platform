import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

const DOCUMENT_TYPES = ["DNI", "RUC", "PASSPORT", "CE", "OTHER"] as const;

export class UpdateUserDto {
  @ApiProperty({ example: "Juan", required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ example: "Pérez", required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: "juan@ejemplo.com", required: false })
  @IsOptional()
  @IsEmail({}, { message: "El email debe ser válido" })
  @MaxLength(254)
  email?: string;

  @ApiProperty({ example: "+51 999 999 999", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[\d\s\+\-\(\)]{7,20}$/, {
    message: "El teléfono solo puede contener dígitos, espacios, +, -, (, )",
  })
  phone?: string;

  // ── Documento de identidad ────────────────────────────────────────────────

  @ApiProperty({ example: "DNI", enum: DOCUMENT_TYPES, required: false })
  @IsOptional()
  @IsString()
  @IsIn(DOCUMENT_TYPES, { message: `documentType debe ser uno de: ${DOCUMENT_TYPES.join(", ")}` })
  documentType?: string;

  @ApiProperty({ example: "72492353", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentNumber?: string;

  // ── Datos personales ──────────────────────────────────────────────────────

  @ApiProperty({ example: "Av. Principal 123, Lima", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiProperty({ example: "1990-05-15", required: false })
  @IsOptional()
  @IsDateString({}, { message: "birthDate debe ser una fecha ISO válida" })
  birthDate?: string;
}
