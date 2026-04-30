import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class BranchHourDto {
  /** 0 = Domingo … 6 = Sábado */
  @ApiProperty({ example: 1, description: "Día de la semana (0 = Domingo, 6 = Sábado)" })
  @IsInt({ message: "weekday debe ser un entero" })
  @Min(0, { message: "weekday mínimo es 0 (Domingo)" })
  @Max(6, { message: "weekday máximo es 6 (Sábado)" })
  weekday: number;

  @ApiProperty({ example: "08:00", description: "Hora de apertura en formato HH:mm" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "startTime debe tener formato HH:mm (ej. 08:00)",
  })
  startTime: string;

  @ApiProperty({ example: "20:00", description: "Hora de cierre en formato HH:mm" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "endTime debe tener formato HH:mm (ej. 20:00)",
  })
  endTime: string;

  @ApiProperty({ example: true, description: "Indica si el horario está activo", required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetBranchHoursDto {
  @ApiProperty({ type: [BranchHourDto], description: "Lista de franjas horarias de la sede (máx. 28)" })
  @IsArray()
  @ArrayMaxSize(28, { message: "Máximo 28 franjas horarias (4 por día × 7 días)" })
  @ValidateNested({ each: true })
  @Type(() => BranchHourDto)
  hours: BranchHourDto[];
}
