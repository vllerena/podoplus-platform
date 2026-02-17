import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service';
import { BRANCH_PARAM_KEY } from '../decorators/require-branch-access.decorator';

@Injectable()
export class BranchScopeGuard implements CanActivate {
  private readonly logger = new Logger('BranchScopeGuard');

  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const branchParamName = this.reflector.get<string>(
      BRANCH_PARAM_KEY,
      context.getHandler(),
    );

    // Si no hay validación de rama, pasar
    if (!branchParamName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      this.logger.warn('No user in request');
      throw new ForbiddenException('No user found');
    }

    // Obtener branchId del parámetro (puede ser params, query o body)
    const branchId =
      request.params[branchParamName] ||
      request.query[branchParamName] ||
      request.body?.[branchParamName];

    if (!branchId) {
      this.logger.warn(`Branch parameter '${branchParamName}' not found`);
      throw new ForbiddenException('Branch ID required');
    }

    // Validar acceso a la sede
    const hasAccess = await this.rbacService.hasAccessToBranch(user.userId, branchId);

    if (!hasAccess) {
      this.logger.warn(`User ${user.userId} denied access to branch ${branchId}`);
      throw new ForbiddenException('Access denied to this branch');
    }

    return true;
  }
}