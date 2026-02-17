import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Controller("v1/customers")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomersController {
  private readonly logger = new Logger("CustomersController");

  constructor(private customersService: CustomersService) {}

  /**
   * POST /v1/customers
   * Crea un nuevo cliente
   */
  @Post()
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: any
  ) {
    if (!dto.firstName || !dto.lastName) {
      throw new BadRequestException("firstName y lastName son requeridos");
    }

    this.logger.log(
      `Usuario ${user.sub} creando cliente: ${dto.firstName} ${dto.lastName}`
    );

    return this.customersService.createCustomer(
      dto.firstName,
      dto.lastName,
      dto.documentType,
      dto.documentNumber,
      dto.phone,
      dto.email,
      dto.birthDate, // Pasar como string, no como Date
      dto.gender,
      dto.notes,
      dto.whatsappOptIn,
      dto.familyHeadId
    );
  }

  /**
   * GET /v1/customers/search
   * Busca clientes por criterios
   */
  @Get("search")
  async searchCustomers(
    @Query("q") query?: string,
    @Query("documentNumber") documentNumber?: string,
    @Query("phone") phone?: string,
    @Query("email") email?: string,
    @Query("familyHeadId") familyHeadId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @CurrentUser() user?: any
  ) {
    const limitNum = Math.min(parseInt(limit || "20"), 100);
    const offsetNum = parseInt(offset || "0");

    this.logger.log(`Usuario ${user?.sub} buscando clientes`);

    return this.customersService.searchCustomers(
      query,
      documentNumber,
      phone,
      email,
      familyHeadId,
      limitNum,
      offsetNum
    );
  }

  /**
   * GET /v1/customers/:id
   * Obtiene detalle de un cliente
   */
  @Get(":id")
  async getCustomerById(
    @Param("id") customerId: string,
    @CurrentUser() user?: any
  ) {
    this.logger.log(`Usuario ${user?.sub} consultando cliente ${customerId}`);
    return this.customersService.getCustomerById(customerId);
  }

  /**
   * GET /v1/customers/:id/family
   * Obtiene todos los miembros de una familia
   */
  @Get(":id/family")
  async getFamilyMembers(
    @Param("id") familyHeadId: string,
    @CurrentUser() user?: any
  ) {
    this.logger.log(
      `Usuario ${user?.sub} consultando familia de ${familyHeadId}`
    );
    return this.customersService.getFamilyMembers(familyHeadId);
  }

  /**
   * PATCH /v1/customers/:id
   * Actualiza un cliente
   */
  @Patch(":id")
  async updateCustomer(
    @Param("id") customerId: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.sub} actualizando cliente ${customerId}`);

    return this.customersService.updateCustomer(
      customerId,
      dto.firstName,
      dto.lastName,
      dto.phone,
      dto.email,
      dto.birthDate, // Pasar como string, no como Date
      dto.gender,
      dto.notes,
      dto.documentType,
      dto.documentNumber
    );
  }

  /**
   * DELETE /v1/customers/:id
   * Soft delete de cliente
   */
  @Delete(":id")
  async deleteCustomer(
    @Param("id") customerId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.sub} eliminando cliente ${customerId}`);

    await this.customersService.deleteCustomer(customerId);

    return { success: true };
  }

  /**
   * POST /v1/customers/:id/link-family/:familyHeadId
   * Vincula un cliente como familiar de otro
   */
  @Post(":id/link-family/:familyHeadId")
  async linkFamilyMember(
    @Param("id") memberId: string,
    @Param("familyHeadId") familyHeadId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.sub} vinculando ${memberId} a familia ${familyHeadId}`
    );

    return this.customersService.linkFamilyMember(memberId, familyHeadId);
  }

  /**
   * POST /v1/customers/:id/unlink-family
   * Desvincula un cliente de su familiar
   */
  @Post(":id/unlink-family")
  async unlinkFamilyMember(
    @Param("id") memberId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.sub} desvinculando ${memberId}`);

    return this.customersService.unlinkFamilyMember(memberId);
  }

  /**
   * POST /v1/customers/:id/whatsapp-optin
   * Habilita WhatsApp opt-in
   */
  @Post(":id/whatsapp-optin")
  async enableWhatsAppOptIn(
    @Param("id") customerId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.sub} habilitando WhatsApp para cliente ${customerId}`
    );

    return this.customersService.setWhatsAppOptIn(customerId, true);
  }

  /**
   * POST /v1/customers/:id/whatsapp-optout
   * Deshabilita WhatsApp opt-in
   */
  @Post(":id/whatsapp-optout")
  async disableWhatsAppOptIn(
    @Param("id") customerId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.sub} deshabilitando WhatsApp para cliente ${customerId}`
    );

    return this.customersService.setWhatsAppOptIn(customerId, false);
  }

  /**
   * GET /v1/customers/:id/stats
   * Obtiene estadísticas del cliente
   */
  @Get(":id/stats")
  async getCustomerStats(
    @Param("id") customerId: string,
    @CurrentUser() user?: any
  ) {
    this.logger.log(
      `Usuario ${user?.sub} consultando estadísticas de cliente ${customerId}`
    );

    return this.customersService.getCustomerStats(customerId);
  }
}
