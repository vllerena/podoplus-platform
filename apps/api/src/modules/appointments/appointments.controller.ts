import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AppointmentsService, AppointmentStatus } from "./appointments.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { BranchScopeGuard } from "../rbac/guards/branch-scope.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";
import { ConfirmAppointmentDto } from "./dto/confirm-appointment.dto";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { CancelAppointmentDto } from "./dto/cancel-appointment.dto";
import { parseLocalDate } from "../../utils/timezone";

/** Máximo rango permitido en días para consultas de citas */
const MAX_RANGE_DAYS = 90;


@ApiTags("Appointments")
@ApiBearerAuth("access-token")
@Controller("v1/appointments")
@UseGuards(JwtAuthGuard, PermissionGuard, BranchScopeGuard)
export class AppointmentsController {
  private readonly logger = new Logger("AppointmentsController");

  constructor(private appointmentsService: AppointmentsService) {}

  // ─────────────────────────────────────────────────────────────────
  // LIST / GET
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /v1/appointments
   * Obtiene citas de una sede en un rango de fechas.
   * Máximo 90 días por consulta.
   */
  @ApiOperation({ summary: "Listar citas en un rango de fechas. branchId opcional: si se omite, devuelve todas las sedes (admin)." })
  @ApiResponse({ status: 200, description: "Lista de citas devuelta correctamente" })
  @ApiResponse({ status: 400, description: "Parámetros inválidos o rango excedido" })
  @ApiQuery({ name: "branchId", required: false, description: "UUID de la sede. Si se omite, devuelve citas de todas las sedes." })
  @ApiQuery({ name: "from", required: true, description: "Fecha inicio YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: true, description: "Fecha fin YYYY-MM-DD" })
  @ApiQuery({ name: "status", required: false, description: "Filtrar por estado" })
  @ApiQuery({ name: "customerId", required: false, description: "Filtrar por cliente" })
  @Get()
  @RequirePermission("appointment.read")
  async getAppointments(
    @Query("branchId") branchId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: AppointmentStatus,
    @Query("customerId") customerId?: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    if (!from || !to) {
      throw new BadRequestException("from y to son requeridos");
    }

    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);
    toDate.setUTCHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException("from y to deben tener formato YYYY-MM-DD");
    }

    if (fromDate > toDate) {
      throw new BadRequestException("from debe ser menor o igual que to");
    }

    const diffDays =
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `El rango máximo permitido es ${MAX_RANGE_DAYS} días`
      );
    }

    this.logger.log(
      `Usuario ${user?.userId} consultando citas ${branchId ? `sede ${branchId}` : "todas las sedes"} [${from} → ${to}]`
    );

    return this.appointmentsService.getAppointments(
      branchId,
      fromDate,
      toDate,
      status,
      customerId
    );
  }

  /**
   * GET /v1/appointments/today
   * Citas del día actual para una sede (vista de recepción / agenda del día).
   * Debe ir ANTES de :id para no ser interceptado.
   */
  @ApiOperation({ summary: "Obtener citas del día actual para una sede" })
  @ApiResponse({ status: 200, description: "Citas de hoy devueltas correctamente" })
  @ApiResponse({ status: 400, description: "branchId requerido" })
  @ApiQuery({ name: "branchId", required: true, description: "UUID de la sede" })
  @ApiQuery({ name: "serviceId", required: false, description: "Filtrar por servicio" })
  @Get("today")
  @RequirePermission("appointment.read")
  async getTodayAppointments(
    @Query("branchId") branchId?: string,
    @Query("serviceId") serviceId?: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    if (!branchId) {
      throw new BadRequestException("branchId es requerido");
    }

    this.logger.log(
      `Usuario ${user?.userId} consultando citas de hoy para sede ${branchId}`
    );

    return this.appointmentsService.getTodayAppointments(branchId, serviceId);
  }

  /**
   * GET /v1/appointments/:id
   * Obtiene detalle de una cita (incluye historial de estados).
   */
  @ApiOperation({ summary: "Obtener detalle de una cita por ID" })
  @ApiResponse({ status: 200, description: "Cita encontrada" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Get(":id")
  @RequirePermission("appointment.read")
  async getAppointmentById(
    @Param("id") appointmentId: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user?.userId} consultando cita ${appointmentId}`
    );
    return this.appointmentsService.getAppointmentById(appointmentId);
  }

  /**
   * GET /v1/appointments/:id/history
   * Historial de cambios de estado de una cita.
   */
  @ApiOperation({ summary: "Obtener historial de estados de una cita" })
  @ApiResponse({ status: 200, description: "Historial devuelto correctamente" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Get(":id/history")
  @RequirePermission("appointment.read")
  async getAppointmentHistory(
    @Param("id") appointmentId: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user?.userId} consultando historial de cita ${appointmentId}`
    );
    return this.appointmentsService.getAppointmentHistory(appointmentId);
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE / CONFIRM
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/appointments/confirm
   * Confirma una cita usando un hold existente.
   */
  @ApiOperation({ summary: "Confirmar una cita a partir de un hold existente" })
  @ApiResponse({ status: 200, description: "Cita confirmada correctamente" })
  @ApiResponse({ status: 404, description: "Hold o recursos no encontrados" })
  @Post("confirm")
  @RequirePermission("appointment.create")
  async confirmAppointment(
    @Body() dto: ConfirmAppointmentDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const startAt = parseLocalDate(`${dto.start_date} ${dto.start_time}`);

    this.logger.log(
      `Usuario ${user.userId} confirmando cita en sede ${dto.branch_id}`
    );

    return this.appointmentsService.confirmAppointmentWithHold(
      dto.hold_id || "",
      dto.customer_id,
      dto.branch_id,
      dto.service_id,
      startAt,
      dto.notes,
      dto.source ?? "RECEPTION",
      user.userId,
      dto.idempotency_key
    );
  }

  /**
   * POST /v1/appointments
   * Crear cita directa (recepción / admin, sin hold).
   */
  @ApiOperation({ summary: "Crear cita directa sin hold (recepción / admin)" })
  @ApiResponse({ status: 200, description: "Cita creada correctamente" })
  @ApiResponse({ status: 404, description: "Sede, cliente o servicio no encontrados" })
  @Post()
  @RequirePermission("appointment.create")
  async createAppointment(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const startAt = parseLocalDate(`${dto.start_date} ${dto.start_time}`);

    this.logger.log(
      `Usuario ${user.userId} creando cita en sede ${dto.branch_id}`
    );

    return this.appointmentsService.createAppointment(
      dto.branch_id,
      dto.customer_id,
      dto.service_id,
      startAt,
      dto.status || AppointmentStatus.CONFIRMED,
      dto.notes,
      dto.source || "RECEPTION",
      user.userId
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // STATE TRANSITIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/appointments/:id/reschedule
   * Reprogramar cita (PENDING o CONFIRMED → RESCHEDULED + nueva CONFIRMED).
   */
  @ApiOperation({ summary: "Reprogramar una cita a nueva fecha y hora" })
  @ApiResponse({ status: 200, description: "Cita reprogramada correctamente" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Post(":id/reschedule")
  @RequirePermission("appointment.update")
  async rescheduleAppointment(
    @Param("id") appointmentId: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const newStartAt = parseLocalDate(
      `${dto.new_start_date} ${dto.new_start_time}`
    );

    this.logger.log(
      `Usuario ${user.userId} reprogramando cita ${appointmentId}`
    );

    return this.appointmentsService.rescheduleAppointment(
      appointmentId,
      newStartAt,
      dto.hold_id,
      dto.reason,
      user.userId
    );
  }

  /**
   * POST /v1/appointments/:id/cancel
   * Cancelar cita (PENDING / CONFIRMED / CHECKED_IN → CANCELED).
   */
  @ApiOperation({ summary: "Cancelar una cita (PENDING / CONFIRMED / CHECKED_IN → CANCELED)" })
  @ApiResponse({ status: 200, description: "Cita cancelada correctamente" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Post(":id/cancel")
  @RequirePermission("appointment.update")
  async cancelAppointment(
    @Param("id") appointmentId: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user.userId} cancelando cita ${appointmentId}`
    );

    return this.appointmentsService.cancelAppointment(
      appointmentId,
      dto.reason,
      user.userId
    );
  }

  /**
   * POST /v1/appointments/:id/check-in
   * Marcar check-in (CONFIRMED → CHECKED_IN).
   */
  @ApiOperation({ summary: "Registrar check-in de una cita (CONFIRMED → CHECKED_IN)" })
  @ApiResponse({ status: 200, description: "Check-in registrado correctamente" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Post(":id/check-in")
  @RequirePermission("appointment.manage")
  async checkInAppointment(
    @Param("id") appointmentId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user.userId} check-in cita ${appointmentId}`
    );
    return this.appointmentsService.checkInAppointment(
      appointmentId,
      user.userId
    );
  }

  /**
   * POST /v1/appointments/:id/start
   * Iniciar servicio (CHECKED_IN → IN_SERVICE).
   */
  @ApiOperation({ summary: "Iniciar el servicio de una cita (CHECKED_IN → IN_SERVICE)" })
  @ApiResponse({ status: 200, description: "Servicio iniciado correctamente" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Post(":id/start")
  @RequirePermission("appointment.manage")
  async startServiceAppointment(
    @Param("id") appointmentId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user.userId} iniciando servicio cita ${appointmentId}`
    );
    return this.appointmentsService.startServiceAppointment(
      appointmentId,
      user.userId
    );
  }

  /**
   * POST /v1/appointments/:id/complete
   * Completar cita (IN_SERVICE → COMPLETED).
   */
  @ApiOperation({ summary: "Completar una cita (IN_SERVICE → COMPLETED)" })
  @ApiResponse({ status: 200, description: "Cita completada correctamente" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Post(":id/complete")
  @RequirePermission("appointment.manage")
  async completeAppointment(
    @Param("id") appointmentId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user.userId} completando cita ${appointmentId}`
    );
    return this.appointmentsService.completeAppointment(
      appointmentId,
      user.userId
    );
  }

  /**
   * POST /v1/appointments/:id/no-show
   * Marcar como no-show (CONFIRMED → NO_SHOW, post grace period).
   */
  @ApiOperation({ summary: "Marcar una cita como no-show (CONFIRMED → NO_SHOW)" })
  @ApiResponse({ status: 200, description: "Cita marcada como NO_SHOW" })
  @ApiResponse({ status: 404, description: "Cita no encontrada" })
  @Post(":id/no-show")
  @RequirePermission("appointment.manage")
  async markNoShow(
    @Param("id") appointmentId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user.userId} marcando NO_SHOW cita ${appointmentId}`
    );
    return this.appointmentsService.markNoShow(appointmentId, user.userId);
  }
}
