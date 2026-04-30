import {
  IsArray,
  ArrayMinSize,
  IsString,
  IsDateString,
  IsOptional,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

class ScheduleExceptionEntryDto {
  @ApiProperty({ example: "2026-12-25", description: "Fecha de la excepción de horario (YYYY-MM-DD)" })
  @IsDateString()
  date: string;

  @ApiProperty({ example: "09:00", description: "Hora de inicio del horario excepcional en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @ApiProperty({ example: "14:00", description: "Hora de fin del horario excepcional en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @ApiProperty({ example: "Horario reducido por feriado nacional", description: "Motivo de la excepción de horario", required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkLoadScheduleExceptionsDto {
  @ApiProperty({ type: [ScheduleExceptionEntryDto], description: "Lista de excepciones de horario a cargar masivamente" })
  @IsArray()
  @ArrayMinSize(1, { message: "exceptions debe contener al menos un registro" })
  @ValidateNested({ each: true })
  @Type(() => ScheduleExceptionEntryDto)
  exceptions: ScheduleExceptionEntryDto[];

  @ApiProperty({ example: ["clx1abc", "clx2def"], description: "IDs de las sedes donde aplicar las excepciones. Si se omite, aplica a todas las sedes.", required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
