import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// ─── Constantes de password ───────────────────────────────────────────────────

/**
 * Requisitos de contraseña fuerte:
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula
 * - Al menos una minúscula
 * - Al menos un número
 * - Al menos un carácter especial
 */
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

export const STRONG_PASSWORD_MESSAGE =
  "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial";

// ─── Login ───────────────────────────────────────────────────────────────────

export class LoginDto {
  @ApiProperty({
    description: "Correo electrónico del usuario",
    example: "usuario@ejemplo.com",
    required: true,
  })
  @IsEmail({}, { message: "El email debe ser válido" })
  @MaxLength(254, { message: "El email no puede superar 254 caracteres" })
  email: string;

  /**
   * MinLength 8 alineado con ChangePasswordDto y CreateUserDto.
   * No aplicamos STRONG_PASSWORD_REGEX aquí: el login valida contra el hash
   * almacenado, no debe bloquear a usuarios con contraseñas antiguas.
   */
  @ApiProperty({
    description: "Contraseña del usuario (mínimo 8 caracteres)",
    example: "MiContraseña123!",
    required: true,
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty({ message: "La contraseña es requerida" })
  @MinLength(8,   { message: "La contraseña debe tener mínimo 8 caracteres" })
  @MaxLength(128, { message: "La contraseña no puede superar 128 caracteres" })
  password: string;

  /** Nombre descriptivo del dispositivo, ej. "iPhone 15", "Chrome / Windows". */
  @ApiProperty({
    description: "Nombre descriptivo del dispositivo desde el que se inicia sesión",
    example: "iPhone 15",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "deviceName no puede superar 100 caracteres" })
  deviceName?: string;
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token emitido durante el login o la rotación de tokens",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: "El refresh token es requerido" })
  @MinLength(10, { message: "Refresh token inválido" })
  refreshToken: string;
}

// ─── Forgot / Reset password ─────────────────────────────────────────────────

export class ForgotPasswordDto {
  @ApiProperty({
    description: "Correo electrónico de la cuenta para la que se solicita el restablecimiento",
    example: "usuario@ejemplo.com",
    required: true,
  })
  @IsEmail({}, { message: "El email debe ser válido" })
  @MaxLength(254, { message: "El email no puede superar 254 caracteres" })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: "Token de restablecimiento de contraseña recibido por email",
    example: "a3f5c8d1e9b2...",
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: "El token es requerido" })
  token: string;

  @ApiProperty({
    description: "Nueva contraseña (mínimo 8 caracteres, debe incluir mayúscula, minúscula, número y carácter especial)",
    example: "NuevaContraseña123!",
    required: true,
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8,   { message: "La contraseña debe tener mínimo 8 caracteres" })
  @MaxLength(128, { message: "La contraseña no puede superar 128 caracteres" })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string;
}

