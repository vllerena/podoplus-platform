/**
 * Factory que devuelve un mock completo de PrismaService con jest.fn()
 * en cada operación de modelo utilizada en la API.
 *
 * Uso en un spec file:
 *   import { createPrismaMock } from '../../test/prisma.mock';
 *   let prisma: ReturnType<typeof createPrismaMock>;
 *   beforeEach(() => {
 *     prisma = createPrismaMock();
 *     // Mock $transaction para ejecutar la callback inline:
 *     prisma.$transaction.mockImplementation(async (cb: any) =>
 *       typeof cb === 'function' ? cb(prisma) : Promise.all(cb)
 *     );
 *   });
 */
export const createPrismaMock = () => ({
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),

  customer: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },

  service: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },

  branch: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },

  appointment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },

  appointmentStatusHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
  },

  branchCapacityRule: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },

  hold: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },

  sale: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },

  saleItem: {
    create: jest.fn(),
    findMany: jest.fn(),
  },

  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },

  plan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },

  customerSubscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },

  subscriptionConsumption: {
    create: jest.fn(),
    findMany: jest.fn(),
  },

  inventoryStock: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },

  inventoryMovement: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },

  cashRegister: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },

  cashMovement: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },

  notification: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  auditLog: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },

  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

export type PrismaMock = ReturnType<typeof createPrismaMock>;
