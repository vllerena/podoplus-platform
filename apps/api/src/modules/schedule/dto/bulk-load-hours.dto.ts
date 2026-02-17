import {
  IsArray,
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class HourEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number; // 0-6

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;
}

export class BulkLoadHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HourEntryDto)
  hours: HourEntryDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[]; // Si no está, aplica a TODAS las sedes
}
