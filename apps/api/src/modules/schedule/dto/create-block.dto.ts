import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
} from "class-validator";

export class CreateBlockDto {
  @IsString()
  type: string; // LUNCH, HOLIDAY, MAINTENANCE, EVENT, CUSTOM

  @IsString()
  title: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "date debe estar en formato YYYY-MM-DD",
  })
  date: string; // YYYY-MM-DD (fecha sin zona horaria)

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: "startTime debe estar en formato HH:mm",
  })
  startTime: string; // HH:mm

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "endTime debe estar en formato HH:mm" })
  endTime: string; // HH:mm

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean; // Si es recurrente (semanal)

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number; // Si es recurrente, qué día de la semana

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringStartTime?: string; // Si es recurrente, hora inicio

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringEndTime?: string; // Si es recurrente, hora fin
}
