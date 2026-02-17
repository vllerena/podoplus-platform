import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';

/**
 * Requiere uno o más permisos (AND logic)
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);