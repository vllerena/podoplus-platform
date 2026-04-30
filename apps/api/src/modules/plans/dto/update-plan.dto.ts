import {
  IsString,
  IsNumber,
  IsOptional,
  IsHexColor,
  IsPositive,
  Max,
  IsInt,
  MaxLength,
  MinLength,
  IsBoolean,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdatePlanDto {
  @ApiProperty({ example: "Plan Trimestral", description: "Nombre del plan", required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1,   { message: "name no puede estar vacío" })
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: "Acceso completo por 90 días", description: "Descripción del plan", required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 79.99, description: "Precio del plan", required: false })
  @IsOptional()
  @IsNumber({}, { message: "price debe ser un número" })
  @IsPositive()
  @Max(999_999.99)
  price?: number;

  @ApiProperty({ example: 90, description: "Duración del plan en días (máx 3650)", required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(3650)
  duration_days?: number;

  @ApiProperty({ example: 15, description: "Número de sesiones incluidas (máx 9998)", required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(9998)
  included_sessions?: number;

  @ApiProperty({ example: true, description: "Indica si el plan está activo", required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ example: "#10B981", description: "Color hexadecimal del plan", required: false })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
