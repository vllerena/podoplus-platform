import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum MovementType {
  IN  = "IN",
  OUT = "OUT",
}

export class ManualMovementDto {
  @ApiProperty({
    description: "Tipo de movimiento: IN (ingreso) u OUT (egreso)",
    enum: MovementType,
    example: MovementType.IN,
  })
  @IsEnum(MovementType, { message: "type debe ser IN u OUT" })
  type: MovementType;

  @ApiProperty({
    description: "Monto del movimiento (mínimo 0.01, máximo 999999.99)",
    example: 100.00,
  })
  @IsNumber({}, { message: "amount debe ser un número" })
  @Min(0.01,       { message: "El monto debe ser mayor a 0" })
  @Max(999_999.99, { message: "El monto excede el máximo permitido" })
  amount: number;

  @ApiProperty({
    description: "Motivo del movimiento manual de caja",
    example: "Retiro para pago de proveedor.",
  })
  @IsString()
  @IsNotEmpty({ message: "El motivo es requerido" })
  @MinLength(3,  { message: "El motivo debe tener al menos 3 caracteres" })
  @MaxLength(500, { message: "El motivo no puede superar 500 caracteres" })
  reason: string;
}
