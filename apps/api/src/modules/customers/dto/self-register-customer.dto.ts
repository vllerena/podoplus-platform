import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SelfRegisterCustomerDto {
  @ApiProperty({ example: "María", description: "Nombre del cliente" })
  @IsString()
  @IsNotEmpty({ message: "El nombre es requerido" })
  @MaxLength(100, { message: "El nombre no puede superar 100 caracteres" })
  firstName: string;

  @ApiProperty({ example: "García", description: "Apellido del cliente" })
  @IsString()
  @IsNotEmpty({ message: "El apellido es requerido" })
  @MaxLength(100, { message: "El apellido no puede superar 100 caracteres" })
  lastName: string;

  @ApiProperty({ example: "+51 987 654 321", description: "Teléfono de contacto", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: "El teléfono no puede superar 20 caracteres" })
  @Matches(/^[\d\s\+\-\(\)]{7,20}$/, {
    message: "El teléfono solo puede contener dígitos, espacios, +, -, (, )",
  })
  phone?: string;

  @ApiProperty({ example: "maria.garcia@email.com", description: "Correo electrónico", required: false })
  @IsOptional()
  @IsEmail({}, { message: "El email debe ser válido" })
  @MaxLength(254, { message: "El email no puede superar 254 caracteres" })
  email?: string;

  @ApiProperty({ example: true, description: "Consentimiento para mensajes WhatsApp", required: false })
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}
