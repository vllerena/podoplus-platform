import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { HoldsService } from "./holds.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateHoldDto } from "./dto/create-hold.dto";
import {
  parseLocalDate,
  isValidDate,
  formatDateOnly,
  formatTimeOnly,
} from "../../utils/timezone";
import { RealtimeService } from "../realtime/realtime.service";

@Controller("v1/holds")
@UseGuards(JwtAuthGuard)
export class HoldsController {
  private readonly logger = new Logger("HoldsController");

  constructor(
    private holdsService: HoldsService,
    private realtimeService: RealtimeService
  ) {}

  /**
   * POST /v1/holds
   * Crea un nuevo hold (bloqueo temporal)
   */
  @Post()
  async createHold(@Body() dto: CreateHoldDto, @CurrentUser() user: any) {
    if (!dto.branchId || !dto.serviceId || !dto.startAt) {
      throw new BadRequestException(
        "branchId, serviceId, startAt son requeridos"
      );
    }

    if (!dto.holderType || !dto.holderId) {
      throw new BadRequestException("holderType y holderId son requeridos");
    }

    if (!isValidDate(dto.startAt)) {
      throw new BadRequestException(
        "startAt debe tener formato: YYYY-MM-DD HH:mm (ej: 2026-01-20 10:00)"
      );
    }

    const startAt = parseLocalDate(dto.startAt);

    let endAt: Date;
    if (dto.endAt) {
      if (!isValidDate(dto.endAt)) {
        throw new BadRequestException(
          "endAt debe tener formato: YYYY-MM-DD HH:mm (ej: 2026-01-20 10:45)"
        );
      }
      endAt = parseLocalDate(dto.endAt);
    } else {
      const service = await this.holdsService.getServiceDuration(dto.serviceId);
      if (!service) {
        throw new BadRequestException(
          `Servicio ${dto.serviceId} no encontrado`
        );
      }
      endAt = new Date(
        startAt.getTime() +
          (service.durationMinutes + service.bufferMinutes) * 60000
      );
    }

    if (startAt >= endAt) {
      throw new BadRequestException("startAt debe ser menor que endAt");
    }

    this.logger.log(`Usuario ${user.sub} creando hold en sede ${dto.branchId}`);

    const holdResponse = await this.holdsService.createHold(
      dto.branchId,
      dto.serviceId,
      startAt,
      endAt,
      dto.holderType,
      dto.holderId,
      user.sub
    );

    this.realtimeService.notifyHoldCreated({
      hold_id: holdResponse.hold_id,
      branch_id: holdResponse.branch_id,
      service_id: holdResponse.service_id,
      start_at: holdResponse.start_at,
      start_date: formatDateOnly(new Date(holdResponse.start_at)),
      start_time: formatTimeOnly(new Date(holdResponse.start_at)),
      end_at: holdResponse.end_at,
      end_date: formatDateOnly(new Date(holdResponse.end_at)),
      end_time: formatTimeOnly(new Date(holdResponse.end_at)),
      expires_at: holdResponse.expires_at,
      expires_in_seconds: 90,
      holder_type: dto.holderType,
      holder_id: dto.holderId,
    });

    return {
      hold_id: holdResponse.hold_id,
      branch_id: holdResponse.branch_id,
      service_id: holdResponse.service_id,
      start_at: holdResponse.start_at,
      start_date: formatDateOnly(new Date(holdResponse.start_at)),
      start_time: formatTimeOnly(new Date(holdResponse.start_at)),
      end_at: holdResponse.end_at,
      end_date: formatDateOnly(new Date(holdResponse.end_at)),
      end_time: formatTimeOnly(new Date(holdResponse.end_at)),
      expires_at: holdResponse.expires_at,
      expires_in_seconds: 90,
      message: "Hold creado. Tienes 90 segundos para confirmar la cita.",
    };
  }

  /**
   * DELETE /v1/holds/:id
   */
  @Delete(":id")
  async releaseHold(@Param("id") holdId: string, @CurrentUser() user: any) {
    this.logger.log(`Usuario ${user.sub} liberando hold ${holdId}`);

    const hold = await this.holdsService.getHold(holdId);
    await this.holdsService.releaseHold(holdId);

    if (hold) {
      this.realtimeService.notifyHoldReleased(
        hold.branch_id,
        holdId,
        "Released by user"
      );
    }

    return { success: true };
  }

  /**
   * GET /v1/holds/:id
   */
  @Get(":id")
  async getHold(@Param("id") holdId: string) {
    const hold = await this.holdsService.getHold(holdId);
    if (!hold) {
      throw new BadRequestException("Hold no encontrado o expirado");
    }
    return hold;
  }

  /**
   * GET /v1/holds
   */
  @Get()
  async getHolds(
    @Query("branchId") branchId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @CurrentUser() user?: any
  ) {
    if (!branchId || !from || !to) {
      throw new BadRequestException("branchId, from, to son requeridos");
    }

    if (!isValidDate(from) || !isValidDate(to)) {
      throw new BadRequestException(
        "from y to deben tener formato: YYYY-MM-DD HH:mm"
      );
    }

    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException("from debe ser menor o igual que to");
    }

    this.logger.log(
      `Usuario ${user?.sub} consultando holds de sede ${branchId}`
    );

    const holds = await this.holdsService.getHoldsForRange(
      branchId,
      fromDate,
      toDate
    );

    return {
      holds: holds.map((h) => ({
        hold_id: h.hold_id,
        start_at: h.start_at,
        end_at: h.end_at,
        expires_at: h.expires_at,
      })),
      count: holds.length,
    };
  }

  /**
   * POST /v1/holds/:id/renew
   */
  @Post(":id/renew")
  async renewHold(@Param("id") holdId: string, @CurrentUser() user: any) {
    this.logger.log(`Usuario ${user.sub} renovando hold ${holdId}`);
    const hold = await this.holdsService.renewHold(holdId);

    const holdData = await this.holdsService.getHold(holdId);
    if (holdData) {
      this.realtimeService.notifyHoldRenewed(
        holdData.branch_id,
        hold.hold_id,
        hold.expires_at
      );
    }

    return {
      hold_id: hold.hold_id,
      expires_at: hold.expires_at,
      expires_in_seconds: 90,
      message: "Hold renovado. Tienes otros 90 segundos.",
    };
  }
}
