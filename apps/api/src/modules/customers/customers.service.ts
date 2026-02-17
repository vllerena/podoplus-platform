import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

@Injectable()
export class CustomersService {
  private readonly logger = new Logger("CustomersService");

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService
  ) {}

  /**
   * Crea un nuevo cliente
   * Solo firstName y lastName son obligatorios
   */
  async createCustomer(
    firstName: string,
    lastName: string,
    documentType?: string,
    documentNumber?: string,
    phone?: string,
    email?: string,
    birthDate?: string,
    gender?: string,
    notes?: string,
    whatsappOptIn?: boolean,
    familyHeadId?: string
  ) {
    // Validar que tenga nombres obligatorios
    if (!firstName || !lastName) {
      throw new BadRequestException("firstName y lastName son requeridos");
    }

    // Si documentNumber se proporciona, validar que sea único
    if (documentNumber) {
      const existing = await this.prisma.customer.findUnique({
        where: { documentNumber },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe un cliente con documento ${documentNumber}`
        );
      }
    }

    // Si familyHeadId se proporciona, validar que exista
    if (familyHeadId) {
      const familyHead = await this.prisma.customer.findUnique({
        where: { id: familyHeadId },
      });
      if (!familyHead) {
        throw new NotFoundException(
          `Familiar principal ${familyHeadId} no encontrado`
        );
      }
    }

    // Parsear birthDate si se proporciona
    let parsedBirthDate: Date | undefined;
    if (birthDate) {
      const [year, month, day] = birthDate.split("-").map(Number);
      parsedBirthDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    }

    const customer = await this.prisma.customer.create({
      data: {
        firstName,
        lastName,
        documentType: documentType || null,
        documentNumber: documentNumber || null,
        phone: phone || null,
        email: email || null,
        birthDate: parsedBirthDate,
        gender: gender || null,
        notes: notes || null,
        whatsappOptIn: whatsappOptIn ?? false,
        familyHeadId: familyHeadId || null,
      },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `Cliente creado: ${customer.id} - ${firstName} ${lastName}` +
        (familyHeadId ? ` (familiar de ${familyHeadId})` : "")
    );

    return this.formatCustomer(customer);
  }

  /**
   * Obtiene un cliente por ID con relaciones de familia
   */
  async getCustomerById(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        familyMembers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        appointments: {
          orderBy: { startAt: "desc" },
          take: 10,
        },
        subscriptions: {
          where: { status: "ACTIVE" },
          include: {
            plan: true,
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
   * Busca clientes por criterios
   */
  async searchCustomers(
    query?: string,
    documentNumber?: string,
    phone?: string,
    email?: string,
    familyHeadId?: string,
    limit: number = 20,
    offset: number = 0
  ) {
    const where: any = {};

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ];
    }

    if (documentNumber) {
      where.documentNumber = {
        contains: documentNumber,
        mode: "insensitive",
      };
    }

    if (phone) {
      where.phone = { contains: phone, mode: "insensitive" };
    }

    if (email) {
      where.email = { contains: email, mode: "insensitive" };
    }

    if (familyHeadId) {
      where.familyHeadId = familyHeadId;
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          familyHead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers.map((c) => this.formatCustomer(c)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Obtiene todos los miembros de una familia
   */
  async getFamilyMembers(familyHeadId: string) {
    const familyHead = await this.prisma.customer.findUnique({
      where: { id: familyHeadId },
    });

    if (!familyHead) {
      throw new NotFoundException(`Cliente ${familyHeadId} no encontrado`);
    }

    const members = await this.prisma.customer.findMany({
      where: {
        OR: [{ id: familyHeadId }, { familyHeadId: familyHeadId }],
      },
      orderBy: { createdAt: "asc" },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      familyHead: this.formatCustomer(familyHead),
      members: members.map((m) => this.formatCustomer(m)),
      totalMembers: members.length,
    };
  }

  /**
   * Actualiza un cliente
   */
  async updateCustomer(
    customerId: string,
    firstName?: string,
    lastName?: string,
    phone?: string,
    email?: string,
    birthDate?: string,
    gender?: string,
    notes?: string,
    documentType?: string,
    documentNumber?: string
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }

    // Si documentNumber cambió, validar unicidad
    if (documentNumber && documentNumber !== customer.documentNumber) {
      const existing = await this.prisma.customer.findUnique({
        where: { documentNumber },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe un cliente con documento ${documentNumber}`
        );
      }
    }

    // Parsear birthDate si se proporciona
    let parsedBirthDate: Date | undefined;
    if (birthDate) {
      const [year, month, day] = birthDate.split("-").map(Number);
      parsedBirthDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: firstName ?? customer.firstName,
        lastName: lastName ?? customer.lastName,
        phone: phone !== undefined ? phone : customer.phone,
        email: email !== undefined ? email : customer.email,
        birthDate:
          birthDate !== undefined ? parsedBirthDate : customer.birthDate,
        gender: gender !== undefined ? gender : customer.gender,
        notes: notes !== undefined ? notes : customer.notes,
        documentType:
          documentType !== undefined ? documentType : customer.documentType,
        documentNumber:
          documentNumber !== undefined
            ? documentNumber
            : customer.documentNumber,
      },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Cliente actualizado: ${customerId}`);

    return this.formatCustomer(updated);
  }

  /**
   * Soft delete (marca como eliminado)
   */
  async deleteCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }

    if (customer.deletedAt) {
      throw new BadRequestException("Cliente ya ha sido eliminado");
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { deletedAt: new Date() },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Cliente eliminado (soft): ${customerId}`);

    return this.formatCustomer(updated);
  }

  /**
   * Vincula un cliente como familiar de otro
   */
  async linkFamilyMember(memberId: string, familyHeadId: string) {
    const member = await this.prisma.customer.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Cliente ${memberId} no encontrado`);
    }

    const familyHead = await this.prisma.customer.findUnique({
      where: { id: familyHeadId },
    });

    if (!familyHead) {
      throw new NotFoundException(`Cliente ${familyHeadId} no encontrado`);
    }

    if (memberId === familyHeadId) {
      throw new BadRequestException(
        "No puedes vincular a alguien consigo mismo"
      );
    }

    const updated = await this.prisma.customer.update({
      where: { id: memberId },
      data: { familyHeadId: familyHeadId },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `Cliente ${memberId} vinculado como familiar de ${familyHeadId}`
    );

    return this.formatCustomer(updated);
  }

  /**
   * Desvincula un cliente de su familiar
   */
  async unlinkFamilyMember(memberId: string) {
    const member = await this.prisma.customer.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Cliente ${memberId} no encontrado`);
    }

    const updated = await this.prisma.customer.update({
      where: { id: memberId },
      data: { familyHeadId: null },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Cliente ${memberId} desvinculado de familiar`);

    return this.formatCustomer(updated);
  }

  /**
   * Habilita/deshabilita WhatsApp opt-in
   */
  async setWhatsAppOptIn(customerId: string, optIn: boolean) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { whatsappOptIn: optIn },
      include: {
        familyHead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `WhatsApp opt-in actualizado para cliente ${customerId}: ${optIn}`
    );

    return this.formatCustomer(updated);
  }

  /**
   * Obtiene estadísticas de un cliente
   */
  async getCustomerStats(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }

    const [
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      activeSubscriptions,
      totalSpent,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: { customerId },
      }),
      this.prisma.appointment.count({
        where: { customerId, status: "COMPLETED" },
      }),
      this.prisma.appointment.count({
        where: { customerId, status: "CANCELED" },
      }),
      this.prisma.appointment.count({
        where: { customerId, status: "NO_SHOW" },
      }),
      this.prisma.customerSubscription.count({
        where: { customerId, status: "ACTIVE" },
      }),
      this.prisma.sale
        .aggregate({
          where: { customerId, status: "PAID" },
          _sum: { totalAmount: true },
        })
        .then((res) => res._sum.totalAmount || 0),
    ]);

    return {
      customerId,
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      noShowRate:
        totalAppointments > 0
          ? ((noShowAppointments / totalAppointments) * 100).toFixed(2)
          : 0,
      activeSubscriptions,
      totalSpent: totalSpent.toString(),
    };
  }

  /**
   * Helper: formatear cliente
   */
  private formatCustomer(customer: any) {
    return {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: `${customer.firstName} ${customer.lastName}`,
      documentType: customer.documentType,
      documentNumber: customer.documentNumber,
      phone: customer.phone,
      email: customer.email,
      birthDate: customer.birthDate
        ? this.formatDateOnly(customer.birthDate)
        : null,
      gender: customer.gender,
      notes: customer.notes,
      whatsappOptIn: customer.whatsappOptIn,
      familyHeadId: customer.familyHeadId,
      familyHead: customer.familyHead
        ? {
            id: customer.familyHead.id,
            fullName: `${customer.familyHead.firstName} ${customer.familyHead.lastName}`,
          }
        : null,
      isActive: !customer.deletedAt,
      createdAt: this.formatDateOnly(customer.createdAt),
      updatedAt: this.formatDateOnly(customer.updatedAt),
      deletedAt: customer.deletedAt
        ? this.formatDateOnly(customer.deletedAt)
        : null,
    };
  }

  /**
   * Helper: formatear cliente con relaciones
   */
  private formatCustomerWithRelations(customer: any) {
    return {
      ...this.formatCustomer(customer),
      familyMembers: customer.familyMembers.map((m: any) => ({
        id: m.id,
        fullName: `${m.firstName} ${m.lastName}`,
        phone: m.phone,
        email: m.email,
      })),
      recentAppointments: customer.appointments.map((a: any) => ({
        id: a.id,
        service: a.service?.name,
        startAt: a.startAt.toISOString(),
        status: a.status,
      })),
      activeSubscriptions: customer.subscriptions.map((s: any) => ({
        id: s.id,
        planName: s.plan?.name,
        remainingSessions: s.remainingSessions,
        endDate: this.formatDateOnly(s.endDate),
      })),
    };
  }

  /**
   * Helper: formatear fecha a YYYY-MM-DD
   */
  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
