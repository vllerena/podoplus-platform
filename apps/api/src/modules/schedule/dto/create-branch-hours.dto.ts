import { IsInt, IsString, Min, Max, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateBranchHoursDto {
  @ApiProperty({ example: 1, description: "Día de la semana (0 = Domingo, 6 = Sábado)" })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number; // 0 = Domingo, 6 = Sábado

  @ApiProperty({ example: "08:00", description: "Hora de inicio en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: "startTime debe estar en formato HH:mm",
  })
  startTime: string; // 08:00

  @ApiProperty({ example: "18:00", description: "Hora de fin en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "endTime debe estar en formato HH:mm" })
  endTime: string; // 18:00
}
