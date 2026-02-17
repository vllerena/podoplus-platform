import {
  IsArray,
  IsString,
  IsDateString,
  IsOptional,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class ScheduleExceptionEntryDto {
  @IsDateString()
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkLoadScheduleExceptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleExceptionEntryDto)
  exceptions: ScheduleExceptionEntryDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
