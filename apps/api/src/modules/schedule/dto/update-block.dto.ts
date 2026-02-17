import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
} from "class-validator";

export class UpdateBlockDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string; // HH:mm

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string; // HH:mm

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringEndTime?: string;
}
