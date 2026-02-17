import { IsInt, IsString, Min, Max, Matches } from "class-validator";

export class CreateBranchHoursDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number; // 0 = Domingo, 6 = Sábado

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: "startTime debe estar en formato HH:mm",
  })
  startTime: string; // 08:00

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "endTime debe estar en formato HH:mm" })
  endTime: string; // 18:00
}
