import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { VALID_TIMEZONES } from "./create-branch.dto";

export class UpdateBranchDto {
  @ApiProperty({ example: "Sede Central Lima", description: "Nombre de la sede", required: false })
  @IsOptional()
  @IsString()
  @MinLength(1,   { message: "El nombre no puede estar vacío" })
  @MaxLength(150, { message: "El nombre no puede superar 150 caracteres" })
  name?: string;

  @ApiProperty({ example: "Av. Javier Prado Este 1234", description: "Dirección de la sede", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "La dirección no puede superar 300 caracteres" })
  address?: string;

  @ApiProperty({ example: "San Isidro", description: "Distrito de la sede", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "El distrito no puede superar 100 caracteres" })
  district?: string;

  @ApiProperty({ example: "Lima", description: "Ciudad de la sede", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "La ciudad no puede superar 100 caracteres" })
  city?: string;

  @ApiProperty({ example: "+51 999 888 777", description: "Teléfono de contacto de la sede", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: "El teléfono no puede superar 20 caracteres" })
  phone?: string;

  @ApiProperty({ example: "sede@podoplus.pe", description: "Email de contacto de la sede", required: false })
  @IsOptional()
  @IsEmail({}, { message: "El email debe ser válido" })
  @MaxLength(254, { message: "El email no puede superar 254 caracteres" })
  email?: string;

  @ApiProperty({ example: -12.0464, description: "Latitud geográfica de la sede", required: false })
  @IsOptional()
  @IsNumber({}, { message: "latitude debe ser un número" })
  @Min(-90,  { message: "Latitud inválida" })
  @Max(90,   { message: "Latitud inválida" })
  latitude?: number;

  @ApiProperty({ example: -77.0428, description: "Longitud geográfica de la sede", required: false })
  @IsOptional()
  @IsNumber({}, { message: "longitude debe ser un número" })
  @Min(-180, { message: "Longitud inválida" })
  @Max(180,  { message: "Longitud inválida" })
  longitude?: number;

  @ApiProperty({ example: "https://maps.google.com/?q=-12.0464,-77.0428", description: "URL de Google Maps de la sede", required: false })
  @IsOptional()
  @IsUrl({}, { message: "googleMapsUrl debe ser una URL válida" })
  @MaxLength(500, { message: "La URL no puede superar 500 caracteres" })
  googleMapsUrl?: string;

  @ApiProperty({ example: 5, description: "Capacidad predeterminada de atención simultánea (1-50)", required: false })
  @IsOptional()
  @IsInt({ message: "defaultCapacity debe ser un número entero" })
  @Min(1,  { message: "La capacidad mínima es 1" })
  @Max(50, { message: "La capacidad máxima es 50" })
  defaultCapacity?: number;

  @ApiProperty({ example: "America/Lima", description: "Zona horaria IANA de la sede", required: false })
  @IsOptional()
  @IsEnum(VALID_TIMEZONES, {
    message: `timezone debe ser una zona horaria válida`,
  })
  timezone?: string;

  @ApiProperty({ example: true, description: "Estado activo/inactivo de la sede", required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: "ID de la business unit a la que pertenece la sede (null para desasignar)", required: false })
  @IsOptional()
  @ValidateIf((o) => o.businessUnitId !== null)
  @IsString()
  businessUnitId?: string | null;

  @ApiProperty({ description: "URL o path del banner de la sede", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "El banner no puede superar 500 caracteres" })
  banner?: string;

  @ApiProperty({ example: "ATT-001", description: "Código adjunto de la sede", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: "El attachedCode no puede superar 20 caracteres" })
  attachedCode?: string;

  @ApiProperty({ example: "150120", description: "Código de ubigeo INEI de la sede (6 dígitos)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: "El ubigeo no puede superar 10 caracteres" })
  ubigeo?: string;
}
