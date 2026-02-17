import { SetMetadata } from '@nestjs/common';

export const BRANCH_PARAM_KEY = 'branchParam';

/**
 * Valida que el usuario tenga acceso a la rama especificada
 * @param paramName nombre del parámetro que contiene el branchId (ej: 'branchId')
 */
export const RequireBranchAccess = (paramName: string) =>
  SetMetadata(BRANCH_PARAM_KEY, paramName);