import {
  IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SendWhatsappDto {
  @ApiProperty({
    description: "Número de teléfono destino en formato E.164",
    example: "+51987654321",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: "toPhone debe estar en formato E.164 (ej: +51987654321)",
  })
  toPhone: string;

  @ApiProperty({ description: "ID de la sede desde la que se envía" })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ enum: ["TEXT", "TEMPLATE"] })
  @IsEnum(["TEXT", "TEMPLATE"])
  messageType: "TEXT" | "TEMPLATE";

  @ApiPropertyOptional({
    description: "Nombre del template (requerido cuando messageType=TEMPLATE)",
    example: "appointment_reminder",
  })
  @IsString()
  @IsOptional()
  templateName?: string;

  @ApiPropertyOptional({
    description: "Cuerpo del mensaje (requerido cuando messageType=TEXT)",
    example: "Hola, tu cita es mañana a las 10:00.",
  })
  @IsString()
  @IsOptional()
  messageBody?: string;

  @ApiPropertyOptional({
    description: "Variables del template indexadas por posición ('1', '2', ...)",
    example: { "1": "María García", "2": "25 de abril, 10:00 AM" },
  })
  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;

  @ApiPropertyOptional({ description: "ID del cliente (para vincular en el log)" })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: "ID de la cita (para vincular en el log)" })
  @IsString()
  @IsOptional()
  appointmentId?: string;
}
