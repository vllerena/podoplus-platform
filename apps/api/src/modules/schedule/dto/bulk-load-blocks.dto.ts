import {
  IsArray,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class BlockEntryDto {
  @IsString()
  type: string; // LUNCH, HOLIDAY, MAINTENANCE, etc

  @IsString()
  title: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string; // YYYY-MM-DD

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string; // HH:mm

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string; // HH:mm

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number; // Si es recurrente (semanal)

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringEndTime?: string;
}

export class BulkLoadBlocksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockEntryDto)
  blocks: BlockEntryDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
