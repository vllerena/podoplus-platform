import { IsString, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class GetAvailabilityDto {
  @ApiProperty({ example: "clx1234branchid", description: "UUID de la sede" })
  @IsString()
  branchId: string;

  @ApiProperty({ example: "clx1234serviceid", description: "UUID del servicio" })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: "2026-01-20", description: "Fecha de inicio del rango en formato YYYY-MM-DD" })
  @IsDateString()
  from: string; // ISO date YYYY-MM-DD

  @ApiProperty({ example: "2026-01-27", description: "Fecha de fin del rango en formato YYYY-MM-DD" })
  @IsDateString()
  to: string; // ISO date YYYY-MM-DD
}
