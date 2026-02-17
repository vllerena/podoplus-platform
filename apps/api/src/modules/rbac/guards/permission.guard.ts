import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger('PermissionGuard');

  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    // Si no hay permiso requerido, pasar
    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      this.logger.warn('No user in request');
      throw new ForbiddenException('No user found');
    }

    // Verificar todos los permisos requeridos
    const hasPermissions = await this.rbacService.hasAllPermissions(
      user.userId,
      requiredPermissions,
    );

    if (!hasPermissions) {
      this.logger.warn(
        `User ${user.userId} denied permission. Required: ${requiredPermissions.join(', ')}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}