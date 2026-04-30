import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class SimulateSunatSyncDto {
  @ApiProperty({
    example: "01",
    enum: ["01", "03"],
    description: "Tipo de documento SUNAT: 01=Factura, 03=Boleta",
  })
  @IsIn(["01", "03"])
  docType!: "01" | "03";
}
