import {
  IsArray,
  ArrayMinSize,
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

class HourEntryDto {
  @ApiProperty({ example: 1, description: "Día de la semana (0 = Domingo, 6 = Sábado)" })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number; // 0-6

  @ApiProperty({ example: "08:00", description: "Hora de inicio en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @ApiProperty({ example: "18:00", description: "Hora de fin en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;
}

export class BulkLoadHoursDto {
  @ApiProperty({ type: [HourEntryDto], description: "Lista de franjas horarias a cargar masivamente" })
  @IsArray()
  @ArrayMinSize(1, { message: "hours debe contener al menos un registro" })
  @ValidateNested({ each: true })
  @Type(() => HourEntryDto)
  hours: HourEntryDto[];

  @ApiProperty({ example: ["clx1abc", "clx2def"], description: "IDs de las sedes donde aplicar los horarios. Si se omite, aplica a todas las sedes.", required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[]; // Si no está, aplica a TODAS las sedes
}
