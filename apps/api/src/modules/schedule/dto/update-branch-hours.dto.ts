import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateBranchHoursDto {
  @ApiProperty({ example: 1, description: "Día de la semana (0 = Domingo, 6 = Sábado)", required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @ApiProperty({ example: "08:00", description: "Hora de inicio en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: "startTime debe estar en formato HH:mm",
  })
  startTime?: string;

  @ApiProperty({ example: "18:00", description: "Hora de fin en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "endTime debe estar en formato HH:mm" })
  endTime?: string;
}
