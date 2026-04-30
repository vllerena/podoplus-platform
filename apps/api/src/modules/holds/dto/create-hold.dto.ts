import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateHoldDto {
  @ApiProperty({ example: "clx1234branchid", description: "UUID de la sede" })
  @IsString()
  @IsNotEmpty({ message: "branchId es requerido" })
  branchId: string;

  @ApiProperty({ example: "clx1234serviceid", description: "UUID del servicio" })
  @IsString()
  @IsNotEmpty({ message: "serviceId es requerido" })
  serviceId: string;

  @ApiProperty({ example: "2026-01-20 10:00", description: "Fecha y hora de inicio en formato YYYY-MM-DD HH:mm" })
  @IsString()
  @IsNotEmpty({ message: "startAt es requerido" })
  startAt: string; // Formato: "2026-01-20 10:00" (YYYY-MM-DD HH:mm)

  @ApiProperty({ example: "2026-01-20 10:45", description: "Fecha y hora de fin en formato YYYY-MM-DD HH:mm (opcional, se calcula desde la duración del servicio)", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "endAt no puede ser una cadena vacía" })
  endAt?: string; // Formato: "2026-01-20 10:45" (YYYY-MM-DD HH:mm) - OPCIONAL, se calcula

  @ApiProperty({ example: "USER", description: "Tipo de titular del hold", enum: ["USER", "CUSTOMER"] })
  @IsEnum(["USER", "CUSTOMER"], {
    message: "holderType debe ser USER o CUSTOMER",
  })
  holderType: "USER" | "CUSTOMER";

  @ApiProperty({ example: "clx1234holderid", description: "UUID del titular del hold (usuario o cliente)" })
  @IsString()
  @IsNotEmpty({ message: "holderId es requerido" })
  holderId: string;
}
