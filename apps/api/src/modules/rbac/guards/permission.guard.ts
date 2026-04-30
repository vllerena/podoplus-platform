import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RbacService } from "../rbac.service";
import { PERMISSION_KEY } from "../decorators/require-permission.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger("PermissionGuard");

  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    // Sin permiso requerido → acceso libre
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.userId) {
      this.logger.warn("PermissionGuard: no hay usuario en el request");
      throw new ForbiddenException("No autenticado");
    }

    /**
     * Short-circuit: si el usuario tiene roles embebidos en el JWT, usamos
     * el caché de RBAC por userId (30s TTL en Redis) evitando la DB.
     * Ambas rutas llaman a RbacService que ya tiene caché Redis.
     */
    const hasPermissions = await this.rbacService.hasAllPermissions(
      user.userId,
      requiredPermissions,
    );

    if (!hasPermissions) {
      this.logger.warn(
        `Acceso denegado: userId=${user.userId} roles=[${(user.roles ?? []).join(", ")}] required=${requiredPermissions.join(", ")}`,
      );
      throw new ForbiddenException("Permisos insuficientes");
    }

    return true;
  }
}
