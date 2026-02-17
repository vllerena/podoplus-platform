import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  Matches,
} from "class-validator";

export class UpdateBranchHoursDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: "startTime debe estar en formato HH:mm",
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "endTime debe estar en formato HH:mm" })
  endTime?: string;
}
