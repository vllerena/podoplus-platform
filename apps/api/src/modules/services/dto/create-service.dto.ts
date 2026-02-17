import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from "class-validator";

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes: number; // 15 min a 8 horas

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  bufferMinutes?: number; // Buffer después del servicio

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsOptional()
  @IsBoolean()
  allowSelfService?: boolean; // Visible en portal del cliente
}
