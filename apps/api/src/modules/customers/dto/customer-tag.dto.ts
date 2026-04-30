import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCustomerTagDto {
  @ApiProperty({ example: "VIP", description: "Nombre del tag" })
  @IsString()
  @IsNotEmpty({ message: "El nombre del tag es requerido" })
  @MinLength(2, { message: "El nombre debe tener al menos 2 caracteres" })
  @MaxLength(50, { message: "El nombre no puede superar 50 caracteres" })
  name: string;

  @ApiProperty({ example: "#FF5733", description: "Color hexadecimal del tag", required: false })
  @IsOptional()
  @IsHexColor({ message: "color debe ser un color hexadecimal válido (ej: #FF5733)" })
  color?: string;

  @ApiProperty({ example: "Clientes con membresía premium", description: "Descripción del tag", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "La descripción no puede superar 200 caracteres" })
  description?: string;
}
