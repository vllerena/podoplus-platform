import {
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateServiceCategoryDto {
  @ApiProperty({ example: "Podología Clínica", description: "Nombre de la categoría (2–80 caracteres)" })
  @IsString()
  @IsNotEmpty({ message: "El nombre de la categoría es requerido" })
  @MinLength(2,   { message: "El nombre debe tener al menos 2 caracteres" })
  @MaxLength(80,  { message: "El nombre no puede superar 80 caracteres" })
  name: string;

  @ApiProperty({ example: "#FF5733", description: "Color de identificación en formato hexadecimal", required: false })
  @IsOptional()
  @IsHexColor({ message: "color debe ser un color hexadecimal válido (ej: #FF5733)" })
  color?: string;

  @ApiProperty({ example: 1, description: "Orden de visualización (0–9999)", required: false })
  @IsOptional()
  @IsInt({ message: "order debe ser un número entero" })
  @Min(0,    { message: "order no puede ser negativo" })
  @Max(9999, { message: "order supera el máximo permitido" })
  order?: number;
}
