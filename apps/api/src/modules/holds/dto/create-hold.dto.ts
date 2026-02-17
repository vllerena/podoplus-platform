import { IsString, IsOptional, IsEnum } from "class-validator";

export class CreateHoldDto {
  @IsString()
  branchId: string;

  @IsString()
  serviceId: string;

  @IsString()
  startAt: string; // Formato: "2026-01-20 10:00" (YYYY-MM-DD HH:mm)

  @IsOptional()
  @IsString()
  endAt?: string; // Formato: "2026-01-20 10:45" (YYYY-MM-DD HH:mm) - OPCIONAL, se calcula

  @IsEnum(["USER", "CUSTOMER"])
  holderType: "USER" | "CUSTOMER";

  @IsString()
  holderId: string;
}
