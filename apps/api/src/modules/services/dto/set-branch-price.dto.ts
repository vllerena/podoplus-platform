import { IsNumber, Max, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SetBranchPriceDto {
  @ApiProperty({ example: 75.00, description: "Precio personalizado del servicio en la sede (≥ 0)" })
  @IsNumber({}, { message: "price debe ser un número" })
  @Min(0,          { message: "price no puede ser negativo" })
  @Max(999_999.99, { message: "price supera el máximo permitido" })
  price: number;
}
