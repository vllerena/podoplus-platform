import { IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SetServicePriceDto {
  @ApiProperty({ example: "clx1abc23def456", description: "ID del servicio al que se asigna el precio en esta sede" })
  @IsString()
  @IsNotEmpty({ message: "serviceId es requerido" })
  serviceId: string;

  @ApiProperty({ example: 85.00, description: "Precio del servicio en esta sede (0 - 999999.99)" })
  @IsNumber({}, { message: "price debe ser un número" })
  @Min(0,          { message: "El precio no puede ser negativo" })
  @Max(999_999.99, { message: "El precio excede el máximo permitido" })
  price: number;
}
