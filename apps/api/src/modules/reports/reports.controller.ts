import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { Response } from "express";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Reports")
@ApiBearerAuth("access-token")
@Controller("v1/reports")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  private readonly logger = new Logger("ReportsController");

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /v1/reports/dashboard
   * KPIs unificados: citas, ventas, suscripciones activas, stock bajo.
   * Query: branchId (req), from (req), to (req)
   */
  @ApiOperation({ summary: "KPIs unificados: citas, ventas, suscripciones activas y stock bajo" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "from", required: true, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: true, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiResponse({ status: 200, description: "Reporte de dashboard generado exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango de fechas incorrecto" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("dashboard")
  @RequirePermission("report.read")
  async getDashboardReport(
    @Query("branchId") branchId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    const { fromDate, toDate } = this.validateParams(branchId, from, to);
    this.logger.log(
      `Usuario ${user?.userId} generando dashboard — sede ${branchId} [${from} → ${to}]`
    );
    return this.reportsService.getDashboardReport(branchId, fromDate, toDate);
  }

  /**
   * GET /v1/reports/operations
   * Ocupación, citas por estado, fuente y servicio más demandado.
   * Query: branchId (req), from (req), to (req), format? (csv)
   */
  @ApiOperation({ summary: "Reporte de operaciones: ocupación, citas por estado y servicio más demandado" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "from", required: true, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: true, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiQuery({ name: "format", required: false, description: "Formato de exportación (csv)" })
  @ApiResponse({ status: 200, description: "Reporte de operaciones generado exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango de fechas incorrecto" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("operations")
  @RequirePermission("report.read")
  async getOperationsReport(
    @Query("branchId") branchId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("format") format?: string,
    @Res({ passthrough: true }) res?: Response,
    @CurrentUser() user?: CurrentUserData
  ) {
    const { fromDate, toDate } = this.validateParams(branchId, from, to);
    this.logger.log(
      `Usuario ${user?.userId} generando reporte de operaciones — sede ${branchId} [${from} → ${to}]`
    );

    if (format === "csv") {
      const csv = await this.reportsService.getOperationsReportCSV(branchId, fromDate, toDate);
      res!.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="operaciones_${from}_${to}.csv"`,
      });
      return csv;
    }
    return this.reportsService.getOperationsReport(branchId, fromDate, toDate);
  }

  /**
   * GET /v1/reports/sales
   * Ingresos, métodos de pago, top productos y servicios. Incluye reembolsos.
   * Query: branchId (req), from (req), to (req), format? (csv)
   */
  @ApiOperation({ summary: "Reporte de ventas: ingresos, métodos de pago, top productos y reembolsos" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "from", required: true, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: true, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiQuery({ name: "format", required: false, description: "Formato de exportación (csv)" })
  @ApiResponse({ status: 200, description: "Reporte de ventas generado exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango de fechas incorrecto" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("sales")
  @RequirePermission("report.read")
  async getSalesReport(
    @Query("branchId") branchId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("format") format?: string,
    @Res({ passthrough: true }) res?: Response,
    @CurrentUser() user?: CurrentUserData
  ) {
    const { fromDate, toDate } = this.validateParams(branchId, from, to);
    this.logger.log(
      `Usuario ${user?.userId} generando reporte de ventas — sede ${branchId} [${from} → ${to}]`
    );

    if (format === "csv") {
      const csv = await this.reportsService.getSalesReportCSV(branchId, fromDate, toDate);
      res!.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ventas_${from}_${to}.csv"`,
      });
      return csv;
    }
    return this.reportsService.getSalesReport(branchId, fromDate, toDate);
  }

  /**
   * GET /v1/reports/no-show
   * No-shows y cancelaciones: detalle, clientes recurrentes y motivos.
   * Query: branchId (req), from (req), to (req), format? (csv)
   */
  @ApiOperation({ summary: "Reporte de no-shows y cancelaciones con detalle y clientes recurrentes" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "from", required: true, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: true, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiQuery({ name: "format", required: false, description: "Formato de exportación (csv)" })
  @ApiResponse({ status: 200, description: "Reporte de no-shows generado exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango de fechas incorrecto" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("no-show")
  @RequirePermission("report.read")
  async getNoShowReport(
    @Query("branchId") branchId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("format") format?: string,
    @Res({ passthrough: true }) res?: Response,
    @CurrentUser() user?: CurrentUserData
  ) {
    const { fromDate, toDate } = this.validateParams(branchId, from, to);
    this.logger.log(
      `Usuario ${user?.userId} generando reporte de no-shows — sede ${branchId} [${from} → ${to}]`
    );

    if (format === "csv") {
      const csv = await this.reportsService.getNoShowReportCSV(branchId, fromDate, toDate);
      res!.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="no-shows_${from}_${to}.csv"`,
      });
      return csv;
    }
    return this.reportsService.getNoShowReport(branchId, fromDate, toDate);
  }

  /**
   * GET /v1/reports/inventory
   * Stock actual, alertas de stock bajo y rotación de productos.
   * Query: branchId (req), from (req), to (req), threshold? (default 5), format? (csv)
   */
  @ApiOperation({ summary: "Reporte de inventario: stock actual, alertas de stock bajo y rotación" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "from", required: true, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: true, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiQuery({ name: "threshold", required: false, description: "Umbral de stock bajo (default: 5)" })
  @ApiQuery({ name: "format", required: false, description: "Formato de exportación (csv)" })
  @ApiResponse({ status: 200, description: "Reporte de inventario generado exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango de fechas incorrecto" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("inventory")
  @RequirePermission("report.read")
  async getInventoryReport(
    @Query("branchId") branchId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("threshold") threshold?: string,
    @Query("format") format?: string,
    @Res({ passthrough: true }) res?: Response,
    @CurrentUser() user?: CurrentUserData
  ) {
    const { fromDate, toDate } = this.validateParams(branchId, from, to);
    const lowStockThreshold = threshold ? parseInt(threshold, 10) : 5;
    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      throw new BadRequestException("threshold debe ser un número entero positivo");
    }

    this.logger.log(
      `Usuario ${user?.userId} generando reporte de inventario — sede ${branchId} [${from} → ${to}]`
    );

    if (format === "csv") {
      const csv = await this.reportsService.getInventoryReportCSV(branchId);
      res!.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="inventario_${branchId}.csv"`,
      });
      return csv;
    }
    return this.reportsService.getInventoryReport(branchId, fromDate, toDate, lowStockThreshold);
  }

  /**
   * GET /v1/reports/customers
   * Clientes nuevos vs recurrentes, top spenders, top visitantes.
   * Query: branchId (req), from (req), to (req), format? (csv)
   */
  @ApiOperation({ summary: "Reporte de clientes: nuevos vs recurrentes, top spenders y top visitantes" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "from", required: true, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: true, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiQuery({ name: "format", required: false, description: "Formato de exportación (csv)" })
  @ApiResponse({ status: 200, description: "Reporte de clientes generado exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango de fechas incorrecto" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("customers")
  @RequirePermission("report.read")
  async getCustomersReport(
    @Query("branchId") branchId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("format") format?: string,
    @Res({ passthrough: true }) res?: Response,
    @CurrentUser() user?: CurrentUserData
  ) {
    const { fromDate, toDate } = this.validateParams(branchId, from, to);
    this.logger.log(
      `Usuario ${user?.userId} generando reporte de clientes — sede ${branchId} [${from} → ${to}]`
    );

    if (format === "csv") {
      const csv = await this.reportsService.getCustomersReportCSV(branchId, fromDate, toDate);
      res!.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="clientes_${from}_${to}.csv"`,
      });
      return csv;
    }
    return this.reportsService.getCustomersReport(branchId, fromDate, toDate);
  }

  /**
   * GET /v1/reports/plans
   * Uso de planes: suscripciones activas/pausadas/canceladas, sesiones consumidas, churn.
   * Query: branchId (req), from (req), to (req)
   */
  @ApiOperation({ summary: "Reporte de planes: suscripciones activas/pausadas/canceladas, sesiones y churn" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "from", required: true, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: true, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiResponse({ status: 200, description: "Reporte de planes generado exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango de fechas incorrecto" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("plans")
  @RequirePermission("report.read")
  async getPlansReport(
    @Query("branchId") branchId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    const { fromDate, toDate } = this.validateParams(branchId, from, to);
    this.logger.log(
      `Usuario ${user?.userId} generando reporte de planes — sede ${branchId} [${from} → ${to}]`
    );
    return this.reportsService.getPlansReport(branchId, fromDate, toDate);
  }

  // ─────────────────────────────────────────────────────────────────

  /**
   * Valida los parámetros comunes y devuelve fechas locales ya parseadas.
   * Usa new Date(year, month-1, day) para evitar el desfase UTC.
   */
  private validateParams(
    branchId: string,
    from: string,
    to: string
  ): { fromDate: Date; toDate: Date } {
    if (!branchId) throw new BadRequestException("branchId es requerido");
    if (!from) throw new BadRequestException("from es requerido (YYYY-MM-DD)");
    if (!to) throw new BadRequestException("to es requerido (YYYY-MM-DD)");

    const fromDate = this.parseLocalDate(from, false);
    const toDate = this.parseLocalDate(to, true);

    if (isNaN(fromDate.getTime())) throw new BadRequestException("from no es una fecha válida");
    if (isNaN(toDate.getTime())) throw new BadRequestException("to no es una fecha válida");
    if (fromDate > toDate) throw new BadRequestException("from debe ser anterior a to");

    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 366) throw new BadRequestException("El rango máximo permitido es 366 días");

    return { fromDate, toDate };
  }

  /**
   * Parsea "YYYY-MM-DD" como fecha local (sin desfase UTC).
   * endOfDay=true → 23:59:59.999
   */
  private parseLocalDate(dateStr: string, endOfDay: boolean): Date {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return new Date(NaN);
    }
    const [year, month, day] = parts;
    if (endOfDay) return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
}
