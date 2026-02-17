import { IsString, IsDateString, IsOptional, Matches } from "class-validator";

export class CreateScheduleExceptionDto {
  @IsDateString()
  date: string; // ISO date YYYY-MM-DD

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
