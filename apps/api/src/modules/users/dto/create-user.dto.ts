import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MESSAGE } from "../../auth/dto/auth.dto";

const DOCUMENT_TYPES = ["DNI", "RUC", "PASSPORT", "CE", "OTHER"] as const;

export class CreateUserDto {
  @ApiProperty({ example: "Juan", description: "Nombre del usuario" })
  @IsString()
  @IsNotEmpty({ message: "El nombre es requerido" })
  @MaxLength(100, { message: "El nombre no puede superar 100 caracteres" })
  firstName: string;

  @ApiProperty({ example: "Pérez", description: "Apellido del usuario" })
  @IsString()
  @IsNotEmpty({ message: "El apellido es requerido" })
  @MaxLength(100, { message: "El apellido no puede superar 100 caracteres" })
  lastName: string;

  @ApiProperty({ example: "juan.perez@example.com", description: "Email del usuario" })
  @IsEmail({}, { message: "El email debe ser válido" })
  @IsNotEmpty({ message: "El email es requerido" })
  @MaxLength(254, { message: "El email no puede superar 254 caracteres" })
  email: string;

  @ApiProperty({ example: "Passw0rd!", description: "Contraseña segura" })
  @IsString()
  @MinLength(8,   { message: "La contraseña debe tener mínimo 8 caracteres" })
  @MaxLength(128, { message: "La contraseña no puede superar 128 caracteres" })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  password: string;

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
  @IsDateString({}, { message: "birthDate debe ser una fecha ISO válida (YYYY-MM-DD)" })
  birthDate?: string;

  // ── Rol y sede ────────────────────────────────────────────────────────────

  @ApiProperty({ example: "RECEPTIONIST", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "roleCode no puede ser una cadena vacía" })
  roleCode?: string;

  @ApiProperty({ example: "clx1234abcd", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "branchId no puede ser una cadena vacía" })
  branchId?: string;
}
