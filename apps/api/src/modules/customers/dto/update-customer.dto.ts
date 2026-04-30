import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateCustomerDto {
  @ApiProperty({ example: "Juan", description: "Nombre del cliente", required: false })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "El nombre no puede estar vacío" })
  @MaxLength(100, { message: "El nombre no puede superar 100 caracteres" })
  firstName?: string;

  @ApiProperty({ example: "Pérez", description: "Apellido del cliente", required: false })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "El apellido no puede estar vacío" })
  @MaxLength(100, { message: "El apellido no puede superar 100 caracteres" })
  lastName?: string;

  @ApiProperty({
    example: "DNI",
    description: "Tipo de documento (DNI, CE, PASSPORT, RUC u OTHER)",
    required: false,
  })
  @IsOptional()
  @IsEnum(["DNI", "CE", "PASSPORT", "RUC", "OTHER"], {
    message: "documentType debe ser DNI, CE, PASSPORT, RUC u OTHER",
  })
  documentType?: string;

  @ApiProperty({ example: "12345678", description: "Número de documento", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: "El número de documento no puede superar 20 caracteres" })
  documentNumber?: string;

  @ApiProperty({ example: "+51 987 654 321", description: "Teléfono de contacto", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: "El teléfono no puede superar 20 caracteres" })
  @Matches(/^[\d\s\+\-\(\)]{7,20}$/, {
    message: "El teléfono solo puede contener dígitos, espacios, +, -, (, )",
  })
  phone?: string;

  @ApiProperty({ example: "juan.perez@email.com", description: "Correo electrónico", required: false })
  @IsOptional()
  @IsEmail({}, { message: "El email debe ser válido" })
  @MaxLength(254, { message: "El email no puede superar 254 caracteres" })
  email?: string;

  @ApiProperty({ example: "1990-05-15", description: "Fecha de nacimiento (YYYY-MM-DD)", required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "birthDate debe tener formato YYYY-MM-DD (ej: 1990-05-15)",
  })
  birthDate?: string;

  @ApiProperty({ example: "M", description: "Género (M, F u OTHER)", required: false })
  @IsOptional()
  @IsEnum(["M", "F", "OTHER"], {
    message: "gender debe ser M, F u OTHER",
  })
  gender?: string;

  @ApiProperty({ example: "Paciente con pie plano", description: "Notas internas del cliente", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Las notas no pueden superar 1000 caracteres" })
  notes?: string;

  @ApiProperty({ example: true, description: "Consentimiento para mensajes WhatsApp", required: false })
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  // ── Nuevos campos clínicos ──────────────────────────────────────────────────

  @ApiProperty({ example: "Ingeniero", description: "Ocupación del cliente", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @ApiProperty({
    example: ["Penicilina", "Ibuprofeno"],
    description: "Lista de alergias como array de strings",
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiProperty({ example: "María Pérez", description: "Nombre del contacto de emergencia", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContactName?: string;

  @ApiProperty({ example: "+51 999 888 777", description: "Teléfono del contacto de emergencia", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string;

  @ApiProperty({ example: "maria@email.com", description: "Email del contacto de emergencia", required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  emergencyContactEmail?: string;

  @ApiProperty({ example: "ch_abc123", description: "ID del canal de marketing", required: false })
  @IsOptional()
  @IsString()
  marketingChannelId?: string;
}
