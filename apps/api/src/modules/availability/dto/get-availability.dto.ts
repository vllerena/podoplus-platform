import { IsString, IsDateString } from "class-validator";

export class GetAvailabilityDto {
  @IsString()
  branchId: string;

  @IsString()
  serviceId: string;

  @IsDateString()
  from: string; // ISO date YYYY-MM-DD

  @IsDateString()
  to: string; // ISO date YYYY-MM-DD
}
