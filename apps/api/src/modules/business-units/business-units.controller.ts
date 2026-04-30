import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Res, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException, HttpCode, HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { RequireRole } from "../rbac/decorators/require-role.decorator";
import { BusinessUnitsService } from "./business-units.service";
import { CreateBusinessUnitDto } from "./dto/create-business-unit.dto";
import { UpdateBusinessUnitDto } from "./dto/update-business-unit.dto";

@ApiTags("Business Units")
@ApiBearerAuth("access-token")
@Controller("v1/business-units")
export class BusinessUnitsController {
  constructor(private readonly service: BusinessUnitsService) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RoleGuard)
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @RequireRole("SUPER_ADMIN")
  create(@Body() dto: CreateBusinessUnitDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @RequireRole("SUPER_ADMIN")
  update(@Param("id") id: string, @Body() dto: UpdateBusinessUnitDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @RequireRole("SUPER_ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  // ── Logo ─────────────────────────────────────────────────────────────────────
  // GET es público: los <img src> del browser no pueden enviar Bearer token.

  @Get(":id/logo")
  async getLogo(@Param("id") id: string, @Res() res: Response) {
    const logo = await this.service.getLogo(id);
    if (!logo) return res.status(404).json({ message: "Sin logo" });
    res.set("Content-Type", logo.mimeType);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(logo.data);
  }

  @Post(":id/logo")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @RequireRole("SUPER_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  uploadLogo(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Se requiere un archivo con la clave 'file'");
    return this.service.uploadLogo(id, file.buffer, file.mimetype);
  }

  @Delete(":id/logo")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @RequireRole("SUPER_ADMIN")
  deleteLogo(@Param("id") id: string) {
    return this.service.deleteLogo(id);
  }

  // ── Banner ───────────────────────────────────────────────────────────────────
  // GET es público: los <img src> del browser no pueden enviar Bearer token.

  @Get(":id/banner")
  async getBanner(@Param("id") id: string, @Res() res: Response) {
    const banner = await this.service.getBanner(id);
    if (!banner) return res.status(404).json({ message: "Sin banner" });
    res.set("Content-Type", banner.mimeType);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(banner.data);
  }

  @Post(":id/banner")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @RequireRole("SUPER_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  uploadBanner(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Se requiere un archivo con la clave 'file'");
    return this.service.uploadBanner(id, file.buffer, file.mimetype);
  }

  @Delete(":id/banner")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @RequireRole("SUPER_ADMIN")
  deleteBanner(@Param("id") id: string) {
    return this.service.deleteBanner(id);
  }
}
