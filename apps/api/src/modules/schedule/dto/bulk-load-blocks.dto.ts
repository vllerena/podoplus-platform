import {
  IsArray,
  ArrayMinSize,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

class BlockEntryDto {
  @ApiProperty({ example: "LUNCH", description: "Tipo de bloqueo", enum: ["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"] })
  @IsEnum(["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"], {
    message: "type debe ser LUNCH, HOLIDAY, MAINTENANCE, EVENT o CUSTOM",
  })
  type: string;

  @ApiProperty({ example: "Refrigerio", description: "Título descriptivo del bloqueo" })
  @IsString()
  @IsNotEmpty({ message: "title es requerido" })
  title: string;

  @ApiProperty({ example: "2026-04-15", description: "Fecha del bloqueo en formato YYYY-MM-DD" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string; // YYYY-MM-DD

  @ApiProperty({ example: "12:00", description: "Hora de inicio del bloqueo en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string; // HH:mm

  @ApiProperty({ example: "13:00", description: "Hora de fin del bloqueo en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string; // HH:mm

  @ApiProperty({ example: 3, description: "Día de la semana para bloqueos recurrentes (0 = Domingo, 6 = Sábado)", required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number; // Si es recurrente (semanal)

  @ApiProperty({ example: "12:00", description: "Hora de inicio para el bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringStartTime?: string;

  @ApiProperty({ example: "13:00", description: "Hora de fin para el bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringEndTime?: string;
}

export class BulkLoadBlocksDto {
  @ApiProperty({ type: [BlockEntryDto], description: "Lista de bloqueos a cargar masivamente" })
  @IsArray()
  @ArrayMinSize(1, { message: "blocks debe contener al menos un registro" })
  @ValidateNested({ each: true })
  @Type(() => BlockEntryDto)
  blocks: BlockEntryDto[];

  @ApiProperty({ example: ["clx1abc", "clx2def"], description: "IDs de las sedes donde aplicar los bloqueos. Si se omite, aplica a todas las sedes.", required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
