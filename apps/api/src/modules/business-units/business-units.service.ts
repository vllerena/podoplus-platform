import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBusinessUnitDto } from "./dto/create-business-unit.dto";
import { UpdateBusinessUnitDto } from "./dto/update-business-unit.dto";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES      = 5 * 1024 * 1024; // 5 MB

function formatBusinessUnit(bu: any, includeCredentials = false) {
  return {
    id:       bu.id,
    name:     bu.name,
    ruc:      bu.ruc      ?? null,
    address:  bu.address  ?? null,
    hasLogo:  !!(bu.logoData),
    hasBanner:!!(bu.bannerData),
    website:  bu.website  ?? null,
    email:    bu.email    ?? null,
    phone:    bu.phone    ?? null,
    isActive: bu.isActive,
    branchCount: bu._count?.branches ?? bu.branches?.length ?? undefined,
    branches: bu.branches?.map((b: any) => ({
      id:           b.id,
      name:         b.name,
      code:         b.code         ?? null,
      address:      b.address      ?? null,
      attachedCode: b.attachedCode ?? null,
      isActive:     b.isActive,
    })) ?? undefined,
    // Credenciales SUNAT — solo se exponen en endpoints de detalle (SUPER_ADMIN)
    sunatEndpoint:  includeCredentials ? (bu.sunatEndpoint ?? null) : undefined,
    sunatToken:     includeCredentials ? (bu.sunatToken    ?? null) : undefined,
    createdAt: bu.createdAt,
    updatedAt: bu.updatedAt,
  };
}

@Injectable()
export class BusinessUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.businessUnit.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { branches: true } },
      },
    });
    return items.map((bu) => formatBusinessUnit(bu, false));
  }

  async findOne(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id },
      include: {
        branches: {
          orderBy: { name: "asc" },
          select: {
            id: true, name: true, code: true,
            address: true, attachedCode: true, isActive: true,
          },
        },
      },
    });
    if (!bu) throw new NotFoundException(`Business unit ${id} no encontrada`);
    return formatBusinessUnit(bu, true); // incluye sunatEndpoint + sunatToken
  }

  async create(dto: CreateBusinessUnitDto) {
    if (dto.ruc) {
      const existing = await this.prisma.businessUnit.findUnique({ where: { ruc: dto.ruc } });
      if (existing) throw new ConflictException(`Ya existe una business unit con RUC ${dto.ruc}`);
    }
    const bu = await this.prisma.businessUnit.create({ data: dto });
    return formatBusinessUnit(bu);
  }

  async update(id: string, dto: UpdateBusinessUnitDto) {
    await this.assertExists(id);
    if (dto.ruc) {
      const existing = await this.prisma.businessUnit.findFirst({
        where: { ruc: dto.ruc, NOT: { id } },
      });
      if (existing) throw new ConflictException(`Ya existe una business unit con RUC ${dto.ruc}`);
    }
    const bu = await this.prisma.businessUnit.update({ where: { id }, data: dto });
    return formatBusinessUnit(bu);
  }

  async remove(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id },
      include: { _count: { select: { branches: true } } },
    });
    if (!bu) throw new NotFoundException(`Business unit ${id} no encontrada`);
    if ((bu as any)._count.branches > 0) {
      throw new BadRequestException(
        "No puedes eliminar una business unit que tiene sedes asignadas. Reasigna o elimina las sedes primero."
      );
    }
    await this.prisma.businessUnit.delete({ where: { id } });
    return { message: "Business unit eliminada" };
  }

  // ── Logo ────────────────────────────────────────────────────────────────────

  async uploadLogo(id: string, buffer: Buffer, mimeType: string) {
    await this.assertExists(id);
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException(`Tipo de imagen no permitido. Use: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException("La imagen no puede superar 5 MB");
    }
    const bu = await this.prisma.businessUnit.update({
      where: { id },
      data: { logoData: buffer, logoMimeType: mimeType },
    });
    return formatBusinessUnit(bu);
  }

  async getLogo(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id },
      select: { logoData: true, logoMimeType: true },
    });
    if (!bu?.logoData || !bu.logoMimeType) return null;
    return { data: Buffer.from(bu.logoData), mimeType: bu.logoMimeType };
  }

  async deleteLogo(id: string) {
    await this.assertExists(id);
    await this.prisma.businessUnit.update({
      where: { id },
      data: { logoData: null, logoMimeType: null },
    });
    return { message: "Logo eliminado" };
  }

  // ── Banner ───────────────────────────────────────────────────────────────────

  async uploadBanner(id: string, buffer: Buffer, mimeType: string) {
    await this.assertExists(id);
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException(`Tipo de imagen no permitido. Use: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException("La imagen no puede superar 5 MB");
    }
    const bu = await this.prisma.businessUnit.update({
      where: { id },
      data: { bannerData: buffer, bannerMimeType: mimeType },
    });
    return formatBusinessUnit(bu);
  }

  async getBanner(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id },
      select: { bannerData: true, bannerMimeType: true },
    });
    if (!bu?.bannerData || !bu.bannerMimeType) return null;
    return { data: Buffer.from(bu.bannerData), mimeType: bu.bannerMimeType };
  }

  async deleteBanner(id: string) {
    await this.assertExists(id);
    await this.prisma.businessUnit.update({
      where: { id },
      data: { bannerData: null, bannerMimeType: null },
    });
    return { message: "Banner eliminado" };
  }

  private async assertExists(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({ where: { id } });
    if (!bu) throw new NotFoundException(`Business unit ${id} no encontrada`);
    return bu;
  }
}
