import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import { UpdateCustomerNoteDto } from "./dto/update-customer-note.dto";
import { CreateCustomerTagDto } from "./dto/customer-tag.dto";
import { SelfRegisterCustomerDto } from "./dto/self-register-customer.dto";
import { CreateCompanyDto, CreateMarketingChannelDto } from "./dto/company.dto";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3 MB

@Injectable()
export class CustomersService {
  private readonly logger = new Logger("CustomersService");

  constructor(
    private prisma: PrismaService,
    @Optional() private auditService?: AuditService,
  ) {}

  // ─── CRUD de cliente ─────────────────────────────────────────────────────────

  /**
   * Crea un nuevo cliente.
   * Solo firstName y lastName son obligatorios (validados en DTO).
   */
  async createCustomer(dto: CreateCustomerDto, actorId: string) {
    if (dto.documentNumber) {
      const existing = await this.prisma.customer.findUnique({
        where: { documentNumber: dto.documentNumber },
      });
      if (existing && !existing.deletedAt) {
        throw new ConflictException(
          `Ya existe un cliente activo con documento ${dto.documentNumber}`,
        );
      }
    }

    if (dto.familyHeadId) {
      const familyHead = await this.prisma.customer.findFirst({
        where: { id: dto.familyHeadId, deletedAt: null },
      });
      if (!familyHead) {
        throw new NotFoundException(`Familiar principal ${dto.familyHeadId} no encontrado`);
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        firstName:             dto.firstName,
        lastName:              dto.lastName,
        documentType:          dto.documentType          || null,
        documentNumber:        dto.documentNumber        || null,
        phone:                 dto.phone                 || null,
        email:                 dto.email                 || null,
        birthDate:             dto.birthDate ? this.parseDateOnly(dto.birthDate) : null,
        gender:                dto.gender                || null,
        notes:                 dto.notes                 || null,
        whatsappOptIn:         dto.whatsappOptIn         ?? false,
        familyHeadId:          dto.familyHeadId          || null,
        occupation:            dto.occupation            || null,
        allergies:             dto.allergies             ?? null,
        emergencyContactName:  dto.emergencyContactName  || null,
        emergencyContactPhone: dto.emergencyContactPhone || null,
        emergencyContactEmail: dto.emergencyContactEmail || null,
        marketingChannelId:    dto.marketingChannelId    || null,
      },
      include: {
        familyHead:       { select: { id: true, firstName: true, lastName: true } },
        tagAssignments:   { include: { tag: { select: { id: true, name: true, color: true } } } },
        marketingChannel: { select: { id: true, name: true } },
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.created",
      entityType: "customer",
      entityId: customer.id,
      metadata: {
        firstName:      customer.firstName,
        lastName:       customer.lastName,
        documentNumber: customer.documentNumber,
      },
    });

    this.logger.log(
      `Cliente creado: ${customer.id} - ${dto.firstName} ${dto.lastName}` +
        (dto.familyHeadId ? ` (familiar de ${dto.familyHeadId})` : ""),
    );

    return this.formatCustomer(customer);
  }

  /**
   * Obtiene un cliente por ID con relaciones de familia.
   * Lanza 404 si el cliente fue borrado (soft delete).
   */
  async getCustomerById(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      include: {
        familyHead:    { select: { id: true, firstName: true, lastName: true } },
        familyMembers: {
          where:  { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        appointments: {
          orderBy: { startAt: "desc" },
          take: 10,
          include: {
            service: { select: { id: true, name: true } },
            branch:  { select: { id: true, name: true } },
          },
        },
        subscriptions: {
          where:   { status: "ACTIVE" },
          include: { plan: true },
        },
        tagAssignments: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
        marketingChannel: { select: { id: true, name: true } },
        companies: {
          include: {
            company: { select: { id: true, name: true, documentType: true, documentNumber: true, address: true } },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }

    return this.formatCustomerWithRelations(customer);
  }

  /**
   * Búsqueda con cursor-based pagination para escalar a 60k+ clientes.
   * Filtra siempre deletedAt: null (salvo que deleted=true para ver archivados).
   */
  async searchCustomers(params: {
    query?:        string;
    documentNumber?: string;
    phone?:        string;
    email?:        string;
    familyHeadId?: string;
    tagIds?:       string[];
    deleted?:      boolean;
    limit?:        number;
    cursor?:       string;
  }) {
    const {
      query, documentNumber, phone, email, familyHeadId,
      tagIds, deleted = false, limit: rawLimit = 20, cursor,
    } = params;

    const limit = Math.min(rawLimit, 100);

    const where: any = { deletedAt: deleted ? { not: null } : null };

    if (query) {
      const terms = query.trim().split(/\s+/);
      // Si parece un número de documento, buscar también por documentNumber
      const looksLikeDoc = /^\d{4,}/.test(query.trim());
      where.OR = [
        { firstName:      { contains: query, mode: "insensitive" } },
        { lastName:       { contains: query, mode: "insensitive" } },
        { documentNumber: { contains: query, mode: "insensitive" } },
        { phone:          { contains: query, mode: "insensitive" } },
        ...(terms.length >= 2
          ? [{
              AND: [
                { firstName: { contains: terms[0], mode: "insensitive" } },
                { lastName:  { contains: terms.slice(1).join(" "), mode: "insensitive" } },
              ],
            }]
          : []),
        ...(!looksLikeDoc && terms.length >= 2
          ? [{
              AND: [
                { lastName:  { contains: terms[0], mode: "insensitive" } },
                { firstName: { contains: terms.slice(1).join(" "), mode: "insensitive" } },
              ],
            }]
          : []),
      ];
    }

    if (documentNumber) where.documentNumber = { contains: documentNumber, mode: "insensitive" };
    if (phone)         where.phone           = { contains: phone,         mode: "insensitive" };
    if (email)         where.email           = { contains: email,         mode: "insensitive" };
    if (familyHeadId)  where.familyHeadId    = familyHeadId;
    if (tagIds?.length) {
      where.tagAssignments = { some: { tagId: { in: tagIds } } };
    }

    const findArgs: any = {
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limit + 1,
      include: {
        familyHead:       { select: { id: true, firstName: true, lastName: true } },
        tagAssignments:   { include: { tag: { select: { id: true, name: true, color: true } } } },
        marketingChannel: { select: { id: true, name: true } },
      },
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip   = 1;
    }

    const rows = await this.prisma.customer.findMany(findArgs);

    const hasNext    = rows.length > limit;
    const data       = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext ? data[data.length - 1].id : null;

    return {
      data: data.map((c) => this.formatCustomer(c)),
      nextCursor,
      hasNext,
    };
  }

  /**
   * Actualiza un cliente (solo campos enviados).
   */
  async updateCustomer(customerId: string, dto: UpdateCustomerDto, actorId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException(`Cliente ${customerId} no encontrado`);

    if (dto.documentNumber && dto.documentNumber !== customer.documentNumber) {
      const existing = await this.prisma.customer.findFirst({
        where: { documentNumber: dto.documentNumber, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(`Ya existe un cliente con documento ${dto.documentNumber}`);
      }
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName:             dto.firstName             ?? customer.firstName,
        lastName:              dto.lastName              ?? customer.lastName,
        phone:                 dto.phone                 !== undefined ? dto.phone                 : customer.phone,
        email:                 dto.email                 !== undefined ? dto.email                 : customer.email,
        birthDate:             dto.birthDate             !== undefined
          ? (dto.birthDate ? this.parseDateOnly(dto.birthDate) : null)
          : customer.birthDate,
        gender:                dto.gender                !== undefined ? dto.gender                : customer.gender,
        notes:                 dto.notes                 !== undefined ? dto.notes                 : customer.notes,
        documentType:          dto.documentType          !== undefined ? dto.documentType          : customer.documentType,
        documentNumber:        dto.documentNumber        !== undefined ? dto.documentNumber        : customer.documentNumber,
        occupation:            dto.occupation            !== undefined ? dto.occupation            : (customer as any).occupation,
        allergies:             dto.allergies             !== undefined ? dto.allergies             : (customer as any).allergies,
        emergencyContactName:  dto.emergencyContactName  !== undefined ? dto.emergencyContactName  : (customer as any).emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone !== undefined ? dto.emergencyContactPhone : (customer as any).emergencyContactPhone,
        emergencyContactEmail: dto.emergencyContactEmail !== undefined ? dto.emergencyContactEmail : (customer as any).emergencyContactEmail,
        marketingChannelId:    dto.marketingChannelId    !== undefined ? dto.marketingChannelId    : (customer as any).marketingChannelId,
      },
      include: {
        familyHead:       { select: { id: true, firstName: true, lastName: true } },
        tagAssignments:   { include: { tag: { select: { id: true, name: true, color: true } } } },
        marketingChannel: { select: { id: true, name: true } },
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.updated",
      entityType: "customer",
      entityId: customerId,
      metadata: dto as any,
    });

    this.logger.log(`Cliente actualizado: ${customerId}`);
    return this.formatCustomer(updated);
  }

  /**
   * Soft delete.
   */
  async deleteCustomer(customerId: string, actorId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException(`Cliente ${customerId} no encontrado`);

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data:  { deletedAt: new Date() },
      include: {
        familyHead:     { select: { id: true, firstName: true, lastName: true } },
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.deleted",
      entityType: "customer",
      entityId: customerId,
      metadata: { firstName: customer.firstName, lastName: customer.lastName },
    });

    this.logger.log(`Cliente eliminado (soft): ${customerId}`);
    return this.formatCustomer(updated);
  }

  /**
   * Restaura un cliente previamente eliminado (soft delete).
   */
  async restoreCustomer(customerId: string, actorId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer)          throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    if (!customer.deletedAt) throw new BadRequestException("El cliente no está eliminado");

    const restored = await this.prisma.customer.update({
      where: { id: customerId },
      data:  { deletedAt: null },
      include: {
        familyHead:     { select: { id: true, firstName: true, lastName: true } },
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.restored",
      entityType: "customer",
      entityId: customerId,
      metadata: { firstName: customer.firstName, lastName: customer.lastName },
    });

    this.logger.log(`Cliente restaurado: ${customerId}`);
    return this.formatCustomer(restored);
  }

  // ─── Detección y fusión de duplicados ────────────────────────────────────────

  /**
   * Busca clientes potencialmente duplicados por nombre o teléfono.
   * Endpoint: GET /v1/customers/dedup?q=
   */
  async findDuplicates(q: string) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException("q debe tener al menos 2 caracteres");
    }

    const terms = q.trim().split(/\s+/);

    const orConditions: any[] = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName:  { contains: q, mode: "insensitive" } },
      { phone:     { contains: q, mode: "insensitive" } },
    ];
    if (terms.length >= 2) {
      orConditions.push({
        AND: [
          { firstName: { contains: terms[0],                  mode: "insensitive" } },
          { lastName:  { contains: terms.slice(1).join(" "), mode: "insensitive" } },
        ],
      });
    }

    const customers = await this.prisma.customer.findMany({
      where: { deletedAt: null, OR: orConditions },
      take: 20,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    return { data: customers.map((c) => this.formatCustomer(c)), total: customers.length };
  }

  /**
   * Fusiona un cliente duplicado en el cliente superviviente.
   * Todos los registros (citas, ventas, suscripciones, notas, tags) se
   * reasignan al superviviente; el duplicado queda con soft-delete.
   */
  async mergeCustomers(survivorId: string, duplicateId: string, actorId: string) {
    if (survivorId === duplicateId) {
      throw new BadRequestException("No puedes fusionar un cliente consigo mismo");
    }

    const [survivor, duplicate] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: survivorId,  deletedAt: null } }),
      this.prisma.customer.findFirst({ where: { id: duplicateId, deletedAt: null } }),
    ]);

    if (!survivor)  throw new NotFoundException(`Cliente superviviente ${survivorId} no encontrado`);
    if (!duplicate) throw new NotFoundException(`Cliente duplicado ${duplicateId} no encontrado`);

    await this.prisma.$transaction(async (tx) => {
      // Si el superviviente era familiar del duplicado, romper ese vínculo primero
      if (survivor.familyHeadId === duplicateId) {
        await tx.customer.update({ where: { id: survivorId }, data: { familyHeadId: null } });
      }

      // Reasignar los miembros de familia del duplicado al superviviente
      await tx.customer.updateMany({
        where: { familyHeadId: duplicateId },
        data:  { familyHeadId: survivorId },
      });

      // Mover registros relacionados
      await tx.appointment.updateMany({
        where: { customerId: duplicateId }, data: { customerId: survivorId },
      });
      await tx.sale.updateMany({
        where: { customerId: duplicateId }, data: { customerId: survivorId },
      });
      await tx.customerSubscription.updateMany({
        where: { customerId: duplicateId }, data: { customerId: survivorId },
      });
      await tx.whatsappMessageLog.updateMany({
        where: { customerId: duplicateId }, data: { customerId: survivorId },
      });
      await tx.customerNote.updateMany({
        where: { customerId: duplicateId }, data: { customerId: survivorId },
      });

      // Mover tags evitando duplicados (restricción @@id([customerId, tagId]))
      const [survivorTags, duplicateTags] = await Promise.all([
        tx.customerTagAssignment.findMany({
          where: { customerId: survivorId }, select: { tagId: true },
        }),
        tx.customerTagAssignment.findMany({
          where: { customerId: duplicateId }, select: { tagId: true },
        }),
      ]);
      const survivorTagSet = new Set(survivorTags.map((t) => t.tagId));
      const tagsToAdd = duplicateTags.filter((t) => !survivorTagSet.has(t.tagId));

      await tx.customerTagAssignment.deleteMany({ where: { customerId: duplicateId } });
      if (tagsToAdd.length > 0) {
        await tx.customerTagAssignment.createMany({
          data: tagsToAdd.map((t) => ({ customerId: survivorId, tagId: t.tagId })),
        });
      }

      // Soft delete del duplicado
      await tx.customer.update({
        where: { id: duplicateId },
        data:  { deletedAt: new Date() },
      });
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.merged",
      entityType: "customer",
      entityId: survivorId,
      metadata: {
        duplicateId,
        duplicateName: `${duplicate.firstName} ${duplicate.lastName}`,
      },
    });

    this.logger.log(`Cliente ${duplicateId} fusionado en ${survivorId}`);
    return this.getCustomerById(survivorId);
  }

  // ─── Avatar ───────────────────────────────────────────────────────────────────

  async uploadAvatar(customerId: string, buffer: Buffer, mimeType: string, actorId: string) {
    await this.assertCustomerExists(customerId);

    if (!ALLOWED_AVATAR_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Solo se aceptan: ${ALLOWED_AVATAR_TYPES.join(", ")}`,
      );
    }
    if (buffer.length > MAX_AVATAR_BYTES) {
      throw new BadRequestException("El archivo supera el límite de 3 MB");
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data:  { avatarData: buffer, avatarMimeType: mimeType },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.avatar_uploaded",
      entityType: "customer",
      entityId: customerId,
      metadata: { mimeType, sizeBytes: buffer.length },
    });

    this.logger.log(`Avatar subido para cliente ${customerId}`);
    return { message: "Avatar actualizado correctamente" };
  }

  async getAvatar(customerId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const customer = await this.prisma.customer.findFirst({
      where:  { id: customerId, deletedAt: null },
      select: { avatarData: true, avatarMimeType: true },
    });

    if (!customer || !customer.avatarData || !customer.avatarMimeType) return null;
    return { data: Buffer.from(customer.avatarData), mimeType: customer.avatarMimeType };
  }

  async deleteAvatar(customerId: string, actorId: string) {
    await this.assertCustomerExists(customerId);

    await this.prisma.customer.update({
      where: { id: customerId },
      data:  { avatarData: null, avatarMimeType: null },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.avatar_deleted",
      entityType: "customer",
      entityId: customerId,
    });

    return { message: "Avatar eliminado correctamente" };
  }

  // ─── Historial de auditoría ───────────────────────────────────────────────────

  async getHistory(customerId: string) {
    await this.assertCustomerExists(customerId);
    if (!this.auditService) return { data: [] };
    return { data: await this.auditService.getEntityHistory("customer", customerId) };
  }

  // ─── Notas clínicas ───────────────────────────────────────────────────────────

  async createNote(customerId: string, dto: CreateCustomerNoteDto, actorId: string) {
    await this.assertCustomerExists(customerId);

    const note = await this.prisma.customerNote.create({
      data:    { customerId, content: dto.content, authorId: actorId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.note_created",
      entityType: "customer",
      entityId: customerId,
      metadata: { noteId: note.id },
    });

    return this.formatNote(note);
  }

  async getNotes(customerId: string) {
    await this.assertCustomerExists(customerId);

    const notes = await this.prisma.customerNote.findMany({
      where:   { customerId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return { data: notes.map((n) => this.formatNote(n)), total: notes.length };
  }

  async updateNote(customerId: string, noteId: string, dto: UpdateCustomerNoteDto, actorId: string) {
    await this.assertCustomerExists(customerId);

    const note = await this.prisma.customerNote.findFirst({
      where: { id: noteId, customerId },
    });
    if (!note) throw new NotFoundException(`Nota ${noteId} no encontrada`);

    // Solo el autor puede editar su propia nota
    if (note.authorId !== actorId) {
      throw new ForbiddenException("Solo el autor puede editar esta nota");
    }

    const updated = await this.prisma.customerNote.update({
      where:   { id: noteId },
      data:    { content: dto.content },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });

    return this.formatNote(updated);
  }

  async deleteNote(customerId: string, noteId: string, actorId: string) {
    await this.assertCustomerExists(customerId);

    const note = await this.prisma.customerNote.findFirst({
      where: { id: noteId, customerId },
    });
    if (!note) throw new NotFoundException(`Nota ${noteId} no encontrada`);

    // Solo el autor puede eliminar su propia nota
    if (note.authorId !== actorId) {
      throw new ForbiddenException("Solo el autor puede eliminar esta nota");
    }

    await this.prisma.customerNote.delete({ where: { id: noteId } });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.note_deleted",
      entityType: "customer",
      entityId: customerId,
      metadata: { noteId },
    });

    return { message: "Nota eliminada correctamente" };
  }

  // ─── Tags ─────────────────────────────────────────────────────────────────────

  async listTags() {
    const tags = await this.prisma.customerTag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assignments: true } } },
    });

    return {
      data: tags.map((t) => ({
        id:             t.id,
        name:           t.name,
        color:          t.color,
        description:    t.description,
        customersCount: t._count.assignments,
        createdAt:      t.createdAt.toISOString(),
      })),
      total: tags.length,
    };
  }

  async createTag(dto: CreateCustomerTagDto, actorId: string) {
    const existing = await this.prisma.customerTag.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException(`Ya existe un tag con el nombre "${dto.name}"`);

    const tag = await this.prisma.customerTag.create({
      data: {
        name:        dto.name,
        color:       dto.color       ?? "#6B7280",
        description: dto.description ?? null,
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer_tag.created",
      entityType: "customer_tag",
      entityId: tag.id,
      metadata: { name: tag.name, color: tag.color },
    });

    this.logger.log(`Tag creado: ${tag.id} - "${tag.name}"`);
    return { id: tag.id, name: tag.name, color: tag.color, description: tag.description };
  }

  async deleteTag(tagId: string, actorId: string) {
    const tag = await this.prisma.customerTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException(`Tag ${tagId} no encontrado`);

    await this.prisma.customerTag.delete({ where: { id: tagId } });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer_tag.deleted",
      entityType: "customer_tag",
      entityId: tagId,
      metadata: { name: tag.name },
    });

    return { message: `Tag "${tag.name}" eliminado correctamente` };
  }

  async assignTag(customerId: string, tagId: string, actorId: string) {
    await this.assertCustomerExists(customerId);

    const tag = await this.prisma.customerTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException(`Tag ${tagId} no encontrado`);

    const existing = await this.prisma.customerTagAssignment.findUnique({
      where: { customerId_tagId: { customerId, tagId } },
    });
    if (existing) throw new ConflictException("El tag ya está asignado a este cliente");

    await this.prisma.customerTagAssignment.create({ data: { customerId, tagId } });

    this.logger.log(`Tag ${tagId} asignado a cliente ${customerId} por usuario ${actorId}`);
    return { message: `Tag "${tag.name}" asignado correctamente` };
  }

  async removeTag(customerId: string, tagId: string, actorId: string) {
    await this.assertCustomerExists(customerId);

    const assignment = await this.prisma.customerTagAssignment.findUnique({
      where: { customerId_tagId: { customerId, tagId } },
    });
    if (!assignment) throw new NotFoundException("El tag no está asignado a este cliente");

    await this.prisma.customerTagAssignment.delete({
      where: { customerId_tagId: { customerId, tagId } },
    });

    this.logger.log(`Tag ${tagId} removido de cliente ${customerId} por usuario ${actorId}`);
    return { message: "Tag removido correctamente" };
  }

  // ─── Auto-registro (portal de autoservicio) ──────────────────────────────────

  /**
   * Registro público desde el portal de autoservicio.
   * Retorna DUPLICATE_FOUND si ya existe un cliente con el mismo teléfono.
   * Sin autenticación requerida.
   */
  async selfRegister(dto: SelfRegisterCustomerDto) {
    // Detectar duplicados por teléfono (phone puede compartirse entre familia,
    // pero para autoservicio se advierte primero)
    if (dto.phone) {
      const byPhone = await this.prisma.customer.findMany({
        where: { phone: dto.phone, deletedAt: null },
        take: 5,
        select: { id: true, firstName: true, lastName: true, phone: true },
      });

      if (byPhone.length > 0) {
        return {
          status: "DUPLICATE_FOUND",
          message:
            "Ya existe un cliente registrado con este teléfono. Por favor contacta directamente a la sede.",
          possibleMatches: byPhone.map((c) => ({
            id:       c.id,
            fullName: `${c.firstName} ${c.lastName}`,
            phone:    c.phone,
          })),
        };
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        firstName:     dto.firstName,
        lastName:      dto.lastName,
        phone:         dto.phone         || null,
        email:         dto.email         || null,
        selfRegistered: true,
        whatsappOptIn: dto.whatsappOptIn ?? false,
      },
    });

    this.auditService?.log({
      actorType: "SYSTEM",
      action: "customer.self_registered",
      entityType: "customer",
      entityId: customer.id,
      metadata: {
        firstName: customer.firstName,
        lastName:  customer.lastName,
        phone:     customer.phone,
      },
    });

    this.logger.log(`Auto-registro de cliente: ${customer.id} - ${dto.firstName} ${dto.lastName}`);

    return {
      status:     "CREATED",
      customerId: customer.id,
      fullName:   `${customer.firstName} ${customer.lastName}`,
    };
  }

  // ─── Familia ──────────────────────────────────────────────────────────────────

  async getFamilyMembers(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException(`Cliente ${customerId} no encontrado`);

    // Si el customer ya es miembro de otro grupo, ascender al titular real
    const headId = customer.familyHeadId ?? customer.id;

    const head = customer.familyHeadId
      ? await this.prisma.customer.findFirst({ where: { id: headId, deletedAt: null } })
      : customer;

    if (!head) throw new NotFoundException(`Titular de familia ${headId} no encontrado`);

    // Todos los miembros del grupo (excluye al titular)
    const members = await this.prisma.customer.findMany({
      where:   { familyHeadId: headId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    return {
      familyHead:   this.formatCustomer(head),
      members:      members.map((m) => this.formatCustomer(m)),
      totalMembers: members.length,
    };
  }

  async linkFamilyMember(
    memberId: string,
    familyHeadId: string,
    actorId: string,
    relation?: string,
  ) {
    const [member, familyHead] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: memberId,     deletedAt: null } }),
      this.prisma.customer.findFirst({ where: { id: familyHeadId, deletedAt: null } }),
    ]);

    if (!member)     throw new NotFoundException(`Cliente ${memberId} no encontrado`);
    if (!familyHead) throw new NotFoundException(`Cliente ${familyHeadId} no encontrado`);
    if (memberId === familyHeadId)
      throw new BadRequestException("No puedes vincular a alguien consigo mismo");

    // Si ya está vinculado a OTRO titular, desvincularlo primero automáticamente
    if (member.familyHeadId && member.familyHeadId !== familyHeadId) {
      await this.prisma.customer.update({
        where: { id: memberId },
        data:  { familyHeadId: null, familyRelation: null },
      });
    }

    const updated = await this.prisma.customer.update({
      where:   { id: memberId },
      data:    { familyHeadId, familyRelation: relation ?? null },
      include: {
        familyHead:     { select: { id: true, firstName: true, lastName: true } },
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.family_linked",
      entityType: "customer",
      entityId: memberId,
      metadata: {
        familyHeadId,
        familyHeadName: `${familyHead.firstName} ${familyHead.lastName}`,
        relation: relation ?? null,
      },
    });

    this.logger.log(`Cliente ${memberId} vinculado como familiar de ${familyHeadId} (${relation ?? "sin relación"})`);
    return this.formatCustomer(updated);
  }

  async unlinkFamilyMember(memberId: string, actorId: string) {
    const member = await this.prisma.customer.findFirst({
      where: { id: memberId, deletedAt: null },
    });
    if (!member) throw new NotFoundException(`Cliente ${memberId} no encontrado`);
    if (!member.familyHeadId) throw new BadRequestException("El cliente no tiene familiar vinculado");

    const updated = await this.prisma.customer.update({
      where:   { id: memberId },
      data:    { familyHeadId: null },
      include: {
        familyHead:     { select: { id: true, firstName: true, lastName: true } },
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "customer.family_unlinked",
      entityType: "customer",
      entityId: memberId,
      metadata: { previousFamilyHeadId: member.familyHeadId },
    });

    this.logger.log(`Cliente ${memberId} desvinculado de familiar`);
    return this.formatCustomer(updated);
  }

  // ─── WhatsApp ─────────────────────────────────────────────────────────────────

  async setWhatsAppOptIn(customerId: string, optIn: boolean, actorId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException(`Cliente ${customerId} no encontrado`);

    const updated = await this.prisma.customer.update({
      where:   { id: customerId },
      data:    { whatsappOptIn: optIn },
      include: {
        familyHead:     { select: { id: true, firstName: true, lastName: true } },
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: optIn ? "customer.whatsapp_optin" : "customer.whatsapp_optout",
      entityType: "customer",
      entityId: customerId,
      metadata: { whatsappOptIn: optIn },
    });

    this.logger.log(`WhatsApp opt-in actualizado para cliente ${customerId}: ${optIn}`);
    return this.formatCustomer(updated);
  }

  /**
   * Historial de mensajes WhatsApp del cliente con cursor-based pagination.
   */
  async getMessages(customerId: string, params: { limit?: number; cursor?: string }) {
    await this.assertCustomerExists(customerId);

    const limit = Math.min(params.limit ?? 20, 100);
    const findArgs: any = {
      where:   { customerId },
      orderBy: { createdAt: "desc" },
      take:    limit + 1,
      include: {
        template: { select: { id: true, name: true, templateKey: true } },
        branch:   { select: { id: true, name: true } },
      },
    };

    if (params.cursor) {
      findArgs.cursor = { id: params.cursor };
      findArgs.skip   = 1;
    }

    const rows    = await this.prisma.whatsappMessageLog.findMany(findArgs);
    const hasNext = rows.length > limit;
    const data    = hasNext ? rows.slice(0, limit) : rows;

    return {
      data: data.map((m) => ({
        id:                m.id,
        branchId:          m.branchId,
        branchName:        (m as any).branch?.name ?? undefined,
        templateId:        m.templateId ?? undefined,
        templateKey:       (m as any).template?.templateKey ?? undefined,
        toPhone:           m.toPhone,
        messageType:       m.messageType,
        status:            m.status,
        providerMessageId: m.providerMessageId ?? undefined,
        errorMessage:      m.errorMessage ?? undefined,
        scheduledFor:      m.scheduledFor?.toISOString() ?? undefined,
        sentAt:            m.sentAt?.toISOString() ?? undefined,
        createdAt:         m.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? data[data.length - 1].id : null,
      hasNext,
    };
  }

  // ─── Suscripciones, citas y ventas del cliente ────────────────────────────────

  async getCustomerSubscriptions(
    customerId: string,
    status?: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    await this.assertCustomerExists(customerId);

    // Expirar en batch suscripciones DATE/HYBRID vencidas
    await this.prisma.customerSubscription.updateMany({
      where: {
        customerId,
        status:  "ACTIVE",
        endDate: { lt: new Date() },
        plan:    { planType: { in: ["DATE", "HYBRID"] } },
      },
      data: { status: "EXPIRED" },
    });

    const where: any = { customerId };
    if (status) where.status = status;

    const [subs, total] = await Promise.all([
      this.prisma.customerSubscription.findMany({
        where,
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take:    limit,
        skip:    offset,
      }),
      this.prisma.customerSubscription.count({ where }),
    ]);

    return { data: subs.map((s) => this.formatSubscription(s)), total, limit, offset };
  }

  async getCustomerAppointments(
    customerId: string,
    status?: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    await this.assertCustomerExists(customerId);

    const where: any = { customerId };
    if (status) where.status = status;

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { startAt: "desc" },
        take:    limit,
        skip:    offset,
        include: {
          service: { select: { id: true, name: true } },
          branch:  { select: { id: true, name: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments.map((a) => ({
        id:         a.id,
        branchId:   a.branchId,
        branchName: (a as any).branch?.name ?? undefined,
        serviceId:  a.serviceId,
        serviceName:(a as any).service?.name ?? undefined,
        status:     a.status,
        startAt:    a.startAt.toISOString(),
        endAt:      a.endAt.toISOString(),
        notes:      a.notes ?? undefined,
        createdAt:  a.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  async getCustomerSales(
    customerId: string,
    status?: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    await this.assertCustomerExists(customerId);

    const where: any = { customerId };
    if (status) where.status = status;

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take:    limit,
        skip:    offset,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data: sales.map((s) => ({
        id:             s.id,
        branchId:       s.branchId,
        appointmentId:  s.appointmentId ?? undefined,
        totalAmount:    s.totalAmount.toString(),
        discountAmount: s.discountAmount.toString(),
        paymentMethod:  s.paymentMethod,
        status:         s.status,
        voidReason:     s.voidReason ?? undefined,
        itemsCount:     s.items.length,
        createdAt:      s.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  // ─── Estadísticas ─────────────────────────────────────────────────────────────

  /**
   * Estadísticas del cliente.
   * totalSpent = PAID; totalRefunded = REFUNDED; netSpent = totalSpent - totalRefunded.
   */
  async getCustomerStats(customerId: string) {
    await this.assertCustomerExists(customerId);

    const [
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      activeSubscriptions,
      paidAgg,
      refundedAgg,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { customerId } }),
      this.prisma.appointment.count({ where: { customerId, status: "COMPLETED" } }),
      this.prisma.appointment.count({ where: { customerId, status: "CANCELED" } }),
      this.prisma.appointment.count({ where: { customerId, status: "NO_SHOW" } }),
      this.prisma.customerSubscription.count({ where: { customerId, status: "ACTIVE" } }),
      this.prisma.sale.aggregate({
        where: { customerId, status: "PAID" },
        _sum:  { totalAmount: true },
      }),
      this.prisma.sale.aggregate({
        where: { customerId, status: "REFUNDED" },
        // refundAmount para reembolsos parciales; fallback a totalAmount si no está seteado
        _sum:  { refundAmount: true, totalAmount: true },
      }),
    ]);

    const totalSpent    = Number(paidAgg._sum.totalAmount ?? 0);
    const totalRefunded = Number(
      refundedAgg._sum.refundAmount ?? refundedAgg._sum.totalAmount ?? 0
    );
    const netSpent      = totalSpent - totalRefunded;

    return {
      customerId,
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      noShowRate:
        totalAppointments > 0
          ? Number(((noShowAppointments / totalAppointments) * 100).toFixed(2))
          : 0,
      activeSubscriptions,
      totalSpent:    totalSpent.toFixed(2),
      totalRefunded: totalRefunded.toFixed(2),
      netSpent:      netSpent.toFixed(2),
    };
  }

  // ─── Timeline unificado ───────────────────────────────────────────────────────

  /**
   * Feed cronológico de eventos del cliente: citas, ventas y suscripciones.
   * Cursor basado en ISO timestamp (createdAt del evento más antiguo de la página).
   */
  async getCustomerTimeline(
    customerId: string,
    limit: number = 30,
    cursor?: string,
  ) {
    await this.assertCustomerExists(customerId);

    const take    = Math.min(limit, 100) + 1;
    const before  = cursor ? new Date(cursor) : new Date();

    const [appointments, sales, subscriptions] = await Promise.all([
      this.prisma.appointment.findMany({
        where:   { customerId, createdAt: { lt: before } },
        orderBy: { createdAt: "desc" },
        take,
        include: {
          service: { select: { name: true } },
          branch:  { select: { name: true } },
        },
      }),
      this.prisma.sale.findMany({
        where:   { customerId, createdAt: { lt: before } },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true, status: true, totalAmount: true,
          paymentMethod: true, branchId: true, createdAt: true,
        },
      }),
      this.prisma.customerSubscription.findMany({
        where:   { customerId, createdAt: { lt: before } },
        orderBy: { createdAt: "desc" },
        take,
        include: { plan: { select: { name: true } } },
      }),
    ]);

    type TimelineEvent = {
      type: "APPOINTMENT" | "SALE" | "SUBSCRIPTION";
      id: string;
      date: Date;
      description: string;
      status: string;
      metadata: Record<string, unknown>;
    };

    const events: TimelineEvent[] = [
      ...appointments.map((a) => ({
        type:        "APPOINTMENT" as const,
        id:          a.id,
        date:        a.createdAt,
        description: `Cita: ${(a as any).service?.name ?? ""} — ${(a as any).branch?.name ?? ""}`,
        status:      a.status,
        metadata: {
          serviceId: a.serviceId,
          branchId:  a.branchId,
          startAt:   a.startAt.toISOString(),
        },
      })),
      ...sales.map((s) => ({
        type:        "SALE" as const,
        id:          s.id,
        date:        s.createdAt,
        description: `Venta: S/ ${s.totalAmount} (${s.paymentMethod})`,
        status:      s.status,
        metadata: {
          totalAmount:   s.totalAmount.toString(),
          paymentMethod: s.paymentMethod,
          branchId:      s.branchId,
        },
      })),
      ...subscriptions.map((s) => ({
        type:        "SUBSCRIPTION" as const,
        id:          s.id,
        date:        s.createdAt,
        description: `Suscripción: ${(s as any).plan?.name ?? ""}`,
        status:      s.status,
        metadata: {
          planId:  s.planId,
          endDate: s.endDate ? s.endDate.toISOString() : null,
        },
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, take);

    const hasNext   = events.length > limit;
    const data      = hasNext ? events.slice(0, limit) : events;
    const nextCursor = hasNext ? data[data.length - 1].date.toISOString() : null;

    return {
      data: data.map((e) => ({ ...e, date: e.date.toISOString() })),
      nextCursor,
      hasNext,
    };
  }

  // ─── Clientes con cumpleaños ──────────────────────────────────────────────────

  /**
   * Lista clientes con cumpleaños en el mes indicado (o el mes actual).
   * Ordenados por día del mes para facilitar los recordatorios.
   */
  async getCustomerBirthdays(month?: number) {
    const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
    const nowLima = new Date(Date.now() - LIMA_OFFSET_MS);
    const targetMonth = month ?? nowLima.getUTCMonth() + 1;
    if (targetMonth < 1 || targetMonth > 12) {
      throw new BadRequestException("month debe ser un número entre 1 y 12");
    }

    const customers = await this.prisma.$queryRaw<
      {
        id: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        email: string | null;
        birthDate: Date;
        dayOfMonth: number;
      }[]
    >`
      SELECT
        id,
        "firstName",
        "lastName",
        phone,
        email,
        "birthDate",
        EXTRACT(DAY FROM "birthDate")::int AS "dayOfMonth"
      FROM "Customer"
      WHERE "deletedAt" IS NULL
        AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${targetMonth}
      ORDER BY EXTRACT(DAY FROM "birthDate") ASC
    `;

    return {
      month: targetMonth,
      total: customers.length,
      data: customers.map((c) => ({
        id:         c.id,
        fullName:   `${c.firstName} ${c.lastName}`,
        phone:      c.phone,
        email:      c.email,
        birthDate:  this.formatDateOnly(c.birthDate),
        dayOfMonth: c.dayOfMonth,
      })),
    };
  }

  // ─── Export CSV ───────────────────────────────────────────────────────────────

  /**
   * Exporta el listado de clientes como CSV con los mismos filtros que searchCustomers.
   * Máximo 5000 registros por exportación.
   */
  async exportCustomersCSV(params: {
    query?:          string;
    documentNumber?: string;
    phone?:          string;
    email?:          string;
    tagIds?:         string[];
    deleted?:        boolean;
  }): Promise<string> {
    const { query, documentNumber, phone, email, tagIds, deleted = false } = params;

    const where: any = { deletedAt: deleted ? { not: null } : null };

    if (query) {
      const terms = query.trim().split(/\s+/);
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName:  { contains: query, mode: "insensitive" } },
        ...(terms.length >= 2
          ? [{
              AND: [
                { firstName: { contains: terms[0], mode: "insensitive" } },
                { lastName:  { contains: terms.slice(1).join(" "), mode: "insensitive" } },
              ],
            }]
          : []),
      ];
    }

    if (documentNumber) where.documentNumber = { contains: documentNumber, mode: "insensitive" };
    if (phone)         where.phone           = { contains: phone,          mode: "insensitive" };
    if (email)         where.email           = { contains: email,          mode: "insensitive" };
    if (tagIds?.length) {
      where.tagAssignments = { some: { tagId: { in: tagIds } } };
    }

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 5000,
      include: {
        tagAssignments: { include: { tag: { select: { name: true } } } },
      },
    });

    const rows = customers.map((c) => ({
      id:              c.id,
      nombre:          c.firstName,
      apellido:        c.lastName,
      tipo_documento:  c.documentType ?? "",
      numero_documento: c.documentNumber ?? "",
      telefono:        c.phone ?? "",
      email:           c.email ?? "",
      fecha_nacimiento: c.birthDate ? this.formatDateOnly(c.birthDate) : "",
      edad:            c.birthDate ? String(this.calculateAge(c.birthDate)) : "",
      genero:          c.gender ?? "",
      whatsapp_optin:  c.whatsappOptIn ? "Sí" : "No",
      tags:            c.tagAssignments.map((a: any) => a.tag.name).join(", "),
      auto_registrado: c.selfRegistered ? "Sí" : "No",
      estado:          c.deletedAt ? "Inactivo" : "Activo",
      fecha_registro:  this.formatDateOnly(c.createdAt),
    }));

    const columns = [
      { key: "id",               header: "ID" },
      { key: "nombre",           header: "Nombre" },
      { key: "apellido",         header: "Apellido" },
      { key: "tipo_documento",   header: "Tipo Documento" },
      { key: "numero_documento", header: "N° Documento" },
      { key: "telefono",         header: "Teléfono" },
      { key: "email",            header: "Email" },
      { key: "fecha_nacimiento", header: "Fecha Nacimiento" },
      { key: "edad",             header: "Edad" },
      { key: "genero",           header: "Género" },
      { key: "whatsapp_optin",   header: "WhatsApp Opt-In" },
      { key: "tags",             header: "Tags" },
      { key: "auto_registrado",  header: "Auto Registrado" },
      { key: "estado",           header: "Estado" },
      { key: "fecha_registro",   header: "Fecha Registro" },
    ];

    const header = columns.map((c) => `"${c.header}"`).join(",");
    const lines  = rows.map((row) =>
      columns.map((c) => `"${String(row[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    return [header, ...lines].join("\r\n");
  }

  // ─── Empresas / datos fiscales ────────────────────────────────────────────────

  async getCustomerCompanies(customerId: string) {
    await this.assertCustomerExists(customerId);
    const links = await this.prisma.customerCompany.findMany({
      where:   { customerId },
      include: { company: true },
      orderBy: { createdAt: "asc" },
    });
    return { data: links.map((l) => l.company) };
  }

  async assignCompanyToCustomer(customerId: string, companyId: string, actorId: string) {
    await this.assertCustomerExists(customerId);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException(`Empresa ${companyId} no encontrada`);

    const existing = await this.prisma.customerCompany.findUnique({
      where: { customerId_companyId: { customerId, companyId } },
    });
    if (existing) throw new ConflictException("La empresa ya está asignada a este cliente");

    await this.prisma.customerCompany.create({ data: { customerId, companyId } });
    this.auditService?.log({
      actorType: "USER", actorId,
      action: "customer.company_assigned",
      entityType: "customer", entityId: customerId,
      metadata: { companyId, companyName: company.name },
    });
    return { message: `Empresa "${company.name}" asignada correctamente` };
  }

  async removeCompanyFromCustomer(customerId: string, companyId: string, actorId: string) {
    await this.assertCustomerExists(customerId);
    const link = await this.prisma.customerCompany.findUnique({
      where: { customerId_companyId: { customerId, companyId } },
    });
    if (!link) throw new NotFoundException("La empresa no está asignada a este cliente");

    await this.prisma.customerCompany.delete({
      where: { customerId_companyId: { customerId, companyId } },
    });
    this.auditService?.log({
      actorType: "USER", actorId,
      action: "customer.company_removed",
      entityType: "customer", entityId: customerId,
      metadata: { companyId },
    });
    return { message: "Empresa desvinculada correctamente" };
  }

  // ─── Empresas (CRUD global) ───────────────────────────────────────────────────

  async listCompanies(query?: string) {
    const where: any = {};
    if (query) {
      where.OR = [
        { name:           { contains: query, mode: "insensitive" } },
        { documentNumber: { contains: query, mode: "insensitive" } },
      ];
    }
    const companies = await this.prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      take: 100,
    });
    return { data: companies, total: companies.length };
  }

  async createCompany(dto: CreateCompanyDto, actorId: string) {
    // Si tiene número de documento, verificar unicidad
    if (dto.documentNumber) {
      const existing = await this.prisma.company.findFirst({
        where: { documentNumber: dto.documentNumber },
      });
      if (existing) throw new ConflictException(`Ya existe una empresa con documento ${dto.documentNumber}`);
    }

    const company = await this.prisma.company.create({
      data: {
        name:           dto.name,
        documentType:   dto.documentType   || null,
        documentNumber: dto.documentNumber || null,
        address:        dto.address        || null,
      },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "company.created",
      entityType: "company", entityId: company.id,
      metadata: { name: company.name, documentNumber: company.documentNumber },
    });

    this.logger.log(`Empresa creada: ${company.id} - ${company.name}`);
    return company;
  }

  async deleteCompany(companyId: string, actorId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException(`Empresa ${companyId} no encontrada`);

    // Desvincular de todos los clientes primero
    await this.prisma.customerCompany.deleteMany({ where: { companyId } });
    await this.prisma.company.delete({ where: { id: companyId } });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "company.deleted",
      entityType: "company", entityId: companyId,
      metadata: { name: company.name },
    });

    return { message: `Empresa "${company.name}" eliminada correctamente` };
  }

  // ─── Canales de marketing ─────────────────────────────────────────────────────

  async listMarketingChannels() {
    const channels = await this.prisma.marketingChannel.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
    });
    return { data: channels, total: channels.length };
  }

  async createMarketingChannel(dto: CreateMarketingChannelDto, actorId: string) {
    const existing = await this.prisma.marketingChannel.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException(`Ya existe un canal con el nombre "${dto.name}"`);

    const channel = await this.prisma.marketingChannel.create({
      data: { name: dto.name },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "marketing_channel.created",
      entityType: "marketing_channel", entityId: channel.id,
      metadata: { name: channel.name },
    });

    return channel;
  }

  async deleteMarketingChannel(channelId: string, actorId: string) {
    const channel = await this.prisma.marketingChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException(`Canal ${channelId} no encontrado`);

    // Desasignar de los clientes que lo tengan
    await this.prisma.customer.updateMany({
      where: { marketingChannelId: channelId },
      data:  { marketingChannelId: null },
    });
    await this.prisma.marketingChannel.delete({ where: { id: channelId } });

    return { message: `Canal "${channel.name}" eliminado correctamente` };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  private async assertCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where:  { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    return customer;
  }

  private formatCustomer(customer: any) {
    const tags = (customer.tagAssignments ?? []).map((a: any) => a.tag);
    const companies = (customer.companies ?? []).map((cc: any) => cc.company ?? cc);

    return {
      id:             customer.id,
      firstName:      customer.firstName,
      lastName:       customer.lastName,
      fullName:       `${customer.firstName} ${customer.lastName}`,
      documentType:   customer.documentType   ?? null,
      documentNumber: customer.documentNumber ?? null,
      phone:          customer.phone          ?? null,
      email:          customer.email          ?? null,
      birthDate:      customer.birthDate ? this.formatDateOnly(customer.birthDate) : null,
      age:            customer.birthDate ? this.calculateAge(customer.birthDate)   : null,
      gender:         customer.gender         ?? null,
      notes:          customer.notes          ?? null,
      whatsappOptIn:  customer.whatsappOptIn,
      selfRegistered: customer.selfRegistered,
      hasAvatar:      !!(customer.avatarData),
      familyHeadId:   customer.familyHeadId   ?? null,
      familyRelation: customer.familyRelation ?? null,
      familyHead:     customer.familyHead
        ? {
            id:       customer.familyHead.id,
            fullName: `${customer.familyHead.firstName} ${customer.familyHead.lastName}`,
          }
        : null,
      tags,
      // Datos clínicos
      occupation:            customer.occupation            ?? null,
      allergies:             customer.allergies             ?? [],
      emergencyContactName:  customer.emergencyContactName  ?? null,
      emergencyContactPhone: customer.emergencyContactPhone ?? null,
      emergencyContactEmail: customer.emergencyContactEmail ?? null,
      // Citas desnormalizadas
      lastAppointmentDate:   customer.lastAppointmentDate   ? customer.lastAppointmentDate.toISOString() : null,
      lastAppointmentStatus: customer.lastAppointmentStatus ?? null,
      nextAppointmentDate:   customer.nextAppointmentDate   ? customer.nextAppointmentDate.toISOString() : null,
      nextAppointmentStatus: customer.nextAppointmentStatus ?? null,
      // Canal de marketing
      marketingChannelId:   customer.marketingChannelId     ?? null,
      marketingChannel:     customer.marketingChannel       ?? null,
      // Empresas / datos fiscales
      companies,
      isActive:   !customer.deletedAt,
      createdAt:  customer.createdAt.toISOString(),
      updatedAt:  customer.updatedAt.toISOString(),
      deletedAt:  customer.deletedAt ? customer.deletedAt.toISOString() : null,
    };
  }

  private formatCustomerWithRelations(customer: any) {
    return {
      ...this.formatCustomer(customer),
      familyMembers: (customer.familyMembers ?? []).map((m: any) => ({
        id:       m.id,
        fullName: `${m.firstName} ${m.lastName}`,
        phone:    m.phone,
        email:    m.email,
      })),
      recentAppointments: (customer.appointments ?? []).map((a: any) => ({
        id:          a.id,
        serviceName: a.service?.name,
        branchName:  a.branch?.name,
        startAt:     a.startAt.toISOString(),
        status:      a.status,
      })),
      activeSubscriptions: (customer.subscriptions ?? []).map((s: any) => ({
        id:                s.id,
        planName:          s.plan?.name,
        remainingSessions: s.remainingSessions,
        endDate:           s.endDate ? this.formatDateOnly(s.endDate) : null,
      })),
    };
  }

  private formatNote(note: any) {
    return {
      id:         note.id,
      content:    note.content,
      author:     note.author
        ? {
            id:       note.author.id,
            fullName: `${note.author.firstName} ${note.author.lastName}`,
          }
        : null,
      createdAt:  note.createdAt.toISOString(),
      updatedAt:  note.updatedAt.toISOString(),
    };
  }

  private formatSubscription(sub: any) {
    const planType    = sub.plan?.planType ?? "";
    const isUnlimited = planType === "DATE";
    return {
      id:                sub.id,
      planId:            sub.planId,
      planName:          sub.plan?.name ?? undefined,
      planType,
      branchId:          sub.branchId,
      status:            sub.status,
      startDate:         this.formatDateOnly(sub.startDate),
      endDate:           sub.endDate ? this.formatDateOnly(sub.endDate) : null,
      remainingSessions: isUnlimited ? "unlimited" : sub.remainingSessions,
      cancelReason:      sub.cancelReason ?? undefined,
      createdAt:         sub.createdAt.toISOString(),
      updatedAt:         sub.updatedAt.toISOString(),
    };
  }

  private parseDateOnly(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  private formatDateOnly(date: Date): string {
    const year  = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day   = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = today.getUTCMonth() - birthDate.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) age--;
    return age;
  }
}
