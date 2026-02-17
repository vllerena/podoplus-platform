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
import { AppointmentsService, AppointmentStatus } from "./appointments.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { BranchScopeGuard } from "../rbac/guards/branch-scope.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ConfirmAppointmentDto } from "./dto/confirm-appointment.dto";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { CancelAppointmentDto } from "./dto/cancel-appointment.dto";
import { parseLocalDate, isValidDate } from "../../utils/timezone";

@Controller("v1/appointments")
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard, BranchScopeGuard)
export class AppointmentsController {
  private readonly logger = new Logger("AppointmentsController");

  constructor(private appointmentsService: AppointmentsService) {}

  /**
   * GET /v1/appointments
   * Obtiene citas de una sede en un rango
   */
  @Get()
  async getAppointments(
    @Query("branchId") branchId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: AppointmentStatus,
    @Query("customerId") customerId?: string,
    @CurrentUser() user?: any
  ) {
    if (!branchId || !from || !to) {
      throw new BadRequestException("branchId, from, to son requeridos");
    }

    // Validar formato
    if (!isValidDate(from) || !isValidDate(to)) {
      throw new BadRequestException(
        "from y to deben tener formato: YYYY-MM-DD (ej: 2026-01-20)"
      );
    }

    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException("from debe ser menor o igual que to");
    }

    this.logger.log(
      `Usuario ${user.sub} consultando citas de sede ${branchId}`
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
   * GET /v1/appointments/:id
   * Obtiene detalle de una cita
   */
  @Get(":id")
  async getAppointmentById(@Param("id") appointmentId: string) {
    this.logger.log(`Consultando cita ${appointmentId}`);
    return this.appointmentsService.getAppointmentById(appointmentId);
  }

  /**
   * POST /v1/appointments/confirm
   * Confirma una cita usando un hold
   */
  @Post("confirm")
  async confirmAppointment(
    @Body() dto: ConfirmAppointmentDto,
    @CurrentUser() user: any
  ) {
    if (
      !dto.branch_id ||
      !dto.customer_id ||
      !dto.service_id ||
      !dto.start_date ||
      !dto.start_time
    ) {
      throw new BadRequestException(
        "branch_id, customer_id, service_id, start_date, start_time son requeridos"
      );
    }

    // Validar formato
    if (!isValidDate(dto.start_date)) {
      throw new BadRequestException(
        "start_date debe tener formato: YYYY-MM-DD (ej: 2026-01-20)"
      );
    }

    if (!/^\d{2}:\d{2}$/.test(dto.start_time)) {
      throw new BadRequestException(
        "start_time debe tener formato: HH:mm (ej: 10:00)"
      );
    }

    // Combinar fecha y hora
    const startAt = parseLocalDate(`${dto.start_date} ${dto.start_time}`);

    this.logger.log(
      `Usuario ${user.sub} confirmando cita en sede ${dto.branch_id}`
    );

    return this.appointmentsService.confirmAppointmentWithHold(
      dto.hold_id || "",
      dto.customer_id,
      dto.branch_id,
      dto.service_id,
      startAt,
      dto.notes,
      "RECEPTION",
      user.sub,
      dto.idempotency_key
    );
  }

  /**
   * POST /v1/appointments
   * Crear cita directa (recepción/admin)
   */
  @Post()
  async createAppointment(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: any
  ) {
    if (
      !dto.branch_id ||
      !dto.customer_id ||
      !dto.service_id ||
      !dto.start_date ||
      !dto.start_time
    ) {
      throw new BadRequestException(
        "branch_id, customer_id, service_id, start_date, start_time son requeridos"
      );
    }

    // Validar formato
    if (!isValidDate(dto.start_date)) {
      throw new BadRequestException(
        "start_date debe tener formato: YYYY-MM-DD (ej: 2026-01-20)"
      );
    }

    if (!/^\d{2}:\d{2}$/.test(dto.start_time)) {
      throw new BadRequestException(
        "start_time debe tener formato: HH:mm (ej: 10:00)"
      );
    }

    // Combinar fecha y hora
    const startAt = parseLocalDate(`${dto.start_date} ${dto.start_time}`);

    this.logger.log(
      `Usuario ${user.sub} creando cita en sede ${dto.branch_id}`
    );

    return this.appointmentsService.createAppointment(
      dto.branch_id,
      dto.customer_id,
      dto.service_id,
      startAt,
      dto.status || AppointmentStatus.CONFIRMED,
      dto.notes,
      dto.source || "RECEPTION",
      user.sub
    );
  }

  /**
   * POST /v1/appointments/:id/reschedule
   * Reprogramar cita
   */
  @Post(":id/reschedule")
  async rescheduleAppointment(
    @Param("id") appointmentId: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: any
  ) {
    if (!dto.new_start_date || !dto.new_start_time) {
      throw new BadRequestException(
        "new_start_date y new_start_time son requeridos"
      );
    }

    // Validar formato
    if (!isValidDate(dto.new_start_date)) {
      throw new BadRequestException(
        "new_start_date debe tener formato: YYYY-MM-DD (ej: 2026-01-20)"
      );
    }

    if (!/^\d{2}:\d{2}$/.test(dto.new_start_time)) {
      throw new BadRequestException(
        "new_start_time debe tener formato: HH:mm (ej: 10:00)"
      );
    }

    // Combinar fecha y hora
    const newStartAt = parseLocalDate(
      `${dto.new_start_date} ${dto.new_start_time}`
    );

    this.logger.log(`Usuario ${user.sub} reprogramando cita ${appointmentId}`);

    return this.appointmentsService.rescheduleAppointment(
      appointmentId,
      newStartAt,
      dto.hold_id,
      dto.reason,
      user.sub
    );
  }

  /**
   * POST /v1/appointments/:id/cancel
   * Cancelar cita
   */
  @Post(":id/cancel")
  async cancelAppointment(
    @Param("id") appointmentId: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: any
  ) {
    if (!dto.reason) {
      throw new BadRequestException("reason es requerido");
    }

    this.logger.log(`Usuario ${user.sub} cancelando cita ${appointmentId}`);

    return this.appointmentsService.cancelAppointment(
      appointmentId,
      dto.reason,
      user.sub
    );
  }

  /**
   * POST /v1/appointments/:id/check-in
   * Marcar check-in (cliente llegó)
   */
  @Post(":id/check-in")
  async checkInAppointment(
    @Param("id") appointmentId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.sub} check-in cita ${appointmentId}`);
    return this.appointmentsService.checkInAppointment(appointmentId);
  }

  /**
   * POST /v1/appointments/:id/start
   * Iniciar servicio
   */
  @Post(":id/start")
  async startServiceAppointment(
    @Param("id") appointmentId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.sub} iniciando servicio cita ${appointmentId}`
    );
    return this.appointmentsService.startServiceAppointment(appointmentId);
  }

  /**
   * POST /v1/appointments/:id/complete
   * Completar cita
   */
  @Post(":id/complete")
  async completeAppointment(
    @Param("id") appointmentId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.sub} completando cita ${appointmentId}`);
    return this.appointmentsService.completeAppointment(appointmentId);
  }

  /**
   * POST /v1/appointments/:id/no-show
   * Marcar como no-show
   */
  @Post(":id/no-show")
  async markNoShow(
    @Param("id") appointmentId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.sub} marcando NO_SHOW cita ${appointmentId}`
    );
    return this.appointmentsService.markNoShow(appointmentId);
  }
}
