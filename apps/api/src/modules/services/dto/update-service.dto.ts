import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from "class-validator";

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  bufferMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsBoolean()
  allowSelfService?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
