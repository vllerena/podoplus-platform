import { SetMetadata } from '@nestjs/common';

export const ROLE_KEY = 'roles';

/**
 * Requiere uno o más roles (OR logic)
 */
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLE_KEY, roles);