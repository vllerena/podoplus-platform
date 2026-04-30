import {
  IsEmail, IsEnum, IsNotEmpty, IsOptional,
  IsString, MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateSupplierDto {
  @ApiProperty({ example: "RUC", description: "Tipo de documento: RUC | DNI | OTHER", required: false })
  @IsOptional()
  @IsEnum(["RUC", "DNI", "OTHER"], { message: "documentType debe ser RUC, DNI u OTHER" })
  document_type?: string;

  @ApiProperty({ example: "20600740955", description: "Número de documento (RUC, DNI, etc.) — único", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document_number?: string;

  @ApiProperty({ example: "SUMACDERM S.A.C.", description: "Razón social o nombre del proveedor" })
  @IsString()
  @IsNotEmpty({ message: "El nombre del proveedor es requerido" })
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: "Av. Industrial 123, Lima", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiProperty({ example: "01-2345678", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ example: "ventas@sumacderm.com", required: false })
  @IsOptional()
  @IsEmail({}, { message: "email debe ser una dirección válida" })
  @MaxLength(254)
  email?: string;
}
