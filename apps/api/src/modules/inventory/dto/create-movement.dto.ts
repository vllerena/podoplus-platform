import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Tipos de movimiento manejables manualmente desde la API.
 * - PURCHASE_IN  : entrada por compra manual (sin módulo de compras)
 * - ADJUSTMENT   : ajuste de stock → quantity es el stock ABSOLUTO final
 * - TRANSFER_OUT : salida por traslado a otra sede (requiere target_branch_id)
 * - TRANSFER_IN  : entrada por traslado desde otra sede
 * - REMOVAL      : retiro explícito de stock (merma, vencimiento, robo, etc.)
 *
 * SALE_OUT y RETURN_IN son gestionados automáticamente por SalesService.
 */
export type ManualMovementType =
  | "PURCHASE_IN"
  | "ADJUSTMENT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "REMOVAL";

export class CreateMovementDto {
  @ApiProperty({ example: "clx1branch01", description: "ID de la sede donde se registra el movimiento" })
  @IsString()
  @IsNotEmpty({ message: "branch_id es requerido" })
  branch_id: string;

  @ApiProperty({ example: "clx1product01", description: "ID del producto" })
  @IsString()
  @IsNotEmpty({ message: "product_id es requerido" })
  product_id: string;

  @ApiProperty({
    example: "PURCHASE_IN",
    description:
      "Tipo de movimiento: PURCHASE_IN (compra manual), ADJUSTMENT (ajuste absoluto), " +
      "TRANSFER_OUT (traslado salida — requiere target_branch_id), " +
      "TRANSFER_IN (traslado entrada), REMOVAL (retiro por merma/vencimiento/robo)",
  })
  @IsEnum(["PURCHASE_IN", "ADJUSTMENT", "TRANSFER_OUT", "TRANSFER_IN", "REMOVAL"], {
    message: "type debe ser PURCHASE_IN, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN o REMOVAL",
  })
  type: ManualMovementType;

  /**
   * - ADJUSTMENT  → cantidad absoluta final (0 para vaciar stock)
   * - REMOVAL     → unidades a retirar
   * - Demás tipos → unidades a agregar/restar
   */
  @ApiProperty({ example: 50, description: "Cantidad. Para ADJUSTMENT: stock absoluto final. Para el resto: unidades (0–999999)" })
  @IsInt({ message: "quantity debe ser un número entero" })
  @Min(0,       { message: "quantity no puede ser negativo" })
  @Max(999_999, { message: "quantity excede el máximo permitido" })
  quantity: number;

  @ApiProperty({ example: "Merma por vencimiento — Lote: L20250430", description: "Motivo del movimiento (máx 500 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "reason no puede superar 500 caracteres" })
  reason?: string;

  @ApiProperty({ example: "clx1branch02", description: "Sede destino (solo para TRANSFER_OUT)", required: false })
  @IsOptional()
  @IsString()
  target_branch_id?: string;

  @ApiProperty({ example: "L20250430", description: "Número de lote del producto (opcional, para trazabilidad)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lot?: string;
}
