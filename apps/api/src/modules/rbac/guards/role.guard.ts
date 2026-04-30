import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RbacService } from "../rbac.service";
import { ROLE_KEY } from "../decorators/require-role.decorator";

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger("RoleGuard");

  constructor(
    private reflector: Reflector,
    private rbacService: RbacService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>(
      ROLE_KEY,
      context.getHandler()
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.userId) {
      this.logger.warn("No user in request");
      throw new ForbiddenException("No user found");
    }

    // Una sola query → comparación en memoria (OR logic)
    const hasRole = await this.rbacService.hasAnyRole(user.userId, requiredRoles);

    if (!hasRole) {
      this.logger.warn(
        `User ${user.userId} denied — required roles: ${requiredRoles.join(", ")}`
      );
      throw new ForbiddenException("Insufficient role");
    }

    return true;
  }
}
