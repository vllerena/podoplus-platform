import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsHexColor,
  IsPositive,
  Max,
  IsInt,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export type PlanType = "SESSION" | "DATE" | "HYBRID";

export class CreatePlanDto {
  @ApiProperty({ example: "Plan Mensual", description: "Nombre del plan", maxLength: 100 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100, { message: "name no puede superar 100 caracteres" })
  name: string;

  @ApiProperty({ example: "Acceso ilimitado durante 30 días", description: "Descripción del plan", required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "description no puede superar 500 caracteres" })
  description?: string;

  @ApiProperty({ example: "SESSION", description: "Tipo de plan: SESSION, DATE o HYBRID", enum: ["SESSION", "DATE", "HYBRID"] })
  @IsEnum(["SESSION", "DATE", "HYBRID"], {
    message: "plan_type debe ser SESSION, DATE o HYBRID",
  })
  plan_type: PlanType;

  @ApiProperty({ example: 49.99, description: "Precio del plan (máx 999999.99)" })
  @IsNumber({}, { message: "price debe ser un número" })
  @IsPositive()
  @Max(999_999.99)
  price: number;

  /**
   * SESSION: referencial (ej. 60 días para vencer si no usa las sesiones)
   * DATE:    duración real del período (ej. 365 para plan anual)
   * HYBRID:  duración máxima del período
   */
  @ApiProperty({ example: 30, description: "Duración del plan en días (máx 3650)" })
  @IsInt()
  @IsPositive()
  @Max(3650, { message: "duration_days no puede superar 3650 días (10 años)" })
  duration_days: number;

  /**
   * SESSION: número de sesiones incluidas (ej. 5)
   * DATE:    ignorado internamente, se guarda como 9999 (ilimitado)
   * HYBRID:  número de sesiones incluidas dentro del período
   */
  @ApiProperty({ example: 10, description: "Número de sesiones incluidas (requerido para SESSION e HYBRID)", required: false })
  @ValidateIf((o) => o.plan_type !== "DATE")
  @IsInt()
  @IsPositive()
  @Max(9998, { message: "included_sessions no puede superar 9998" })
  included_sessions?: number;

  @ApiProperty({ example: true, description: "Indica si el plan está activo", required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ example: "#3B82F6", description: "Color hexadecimal para identificar el plan visualmente", required: false })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
