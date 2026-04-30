import {
  IsArray, IsInt, IsNotEmpty, IsOptional, IsString,
  Max, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class StockInitEntry {
  @ApiProperty({ example: "clx1branch01", description: "ID de la sede" })
  @IsString()
  @IsNotEmpty()
  branch_id: string;

  @ApiProperty({ example: 10, description: "Cantidad inicial de stock (entero ≥ 0)" })
  @IsInt()
  @Min(0)
  @Max(999_999)
  quantity: number;
}

export class BulkStockInitDto {
  @ApiProperty({ example: "clx1product01", description: "ID del producto" })
  @IsString()
  @IsNotEmpty()
  product_id: string;

  @ApiProperty({ type: [StockInitEntry], description: "Lista de sedes con su cantidad inicial" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockInitEntry)
  entries: StockInitEntry[];

  @ApiProperty({ example: "Stock inicial de apertura", required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
