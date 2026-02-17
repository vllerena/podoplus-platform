import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ServicesService } from "./services.service";
import { CreateServiceDto, UpdateServiceDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";

@Controller("v1/services")
export class ServicesController {
  private readonly logger = new Logger("ServicesController");

  constructor(private servicesService: ServicesService) {}

  /**
   * GET /v1/services
   * Obtiene todos los servicios activos
   */
  @Get()
  @Public()
  async getAllServices() {
    this.logger.log("Solicitando listado de servicios");
    return this.servicesService.findAll();
  }

  /**
   * GET /v1/services/self-service
   * Obtiene servicios disponibles para autoservicio (portal cliente)
   */
  @Get("self-service")
  @Public()
  async getServicesForSelfService() {
    this.logger.log("Solicitando servicios de autoservicio");
    return this.servicesService.findAvailableForSelfService();
  }

  /**
   * GET /v1/services/:id
   * Obtiene un servicio por ID
   */
  @Get(":id")
  @Public()
  async getService(@Param("id") id: string) {
    this.logger.log(`Solicitando servicio ${id}`);
    return this.servicesService.findOne(id);
  }

  /**
   * POST /v1/services
   * Crea un nuevo servicio (solo admin)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
  async createService(@Body() dto: CreateServiceDto, @CurrentUser() user: any) {
    this.logger.log(`Usuario ${user.userId} creando servicio: ${dto.name}`);
    return this.servicesService.create(dto, user.userId);
  }

  /**
   * PATCH /v1/services/:id
   * Actualiza un servicio
   */
  @Patch(":id")
  @UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
  async updateService(
    @Param("id") id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando servicio ${id}`);
    return this.servicesService.update(id, dto, user.userId);
  }

  /**
   * DELETE /v1/services/:id
   * Desactiva un servicio
   */
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
  async deleteService(@Param("id") id: string, @CurrentUser() user: any) {
    this.logger.log(`Usuario ${user.userId} desactivando servicio ${id}`);
    return this.servicesService.deactivate(id, user.userId);
  }
}
