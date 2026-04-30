import { IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VoidSaleDto {
  @ApiProperty({
    description: "Motivo de la anulación de la venta",
    example: "Error en los ítems registrados.",
  })
  @IsString()
  @MinLength(3,   { message: "El motivo debe tener al menos 3 caracteres" })
  @MaxLength(500, { message: "El motivo no puede superar 500 caracteres" })
  reason: string;
}
