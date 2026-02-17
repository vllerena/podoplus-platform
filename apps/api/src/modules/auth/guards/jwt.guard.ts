import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const wsClient = context.switchToWs().getClient();

    // Si es WebSocket, permitir (se valida en el gateway si es necesario)
    if (wsClient) {
      return true;
    }

    // Si es HTTP, validar JWT
    return super.canActivate(context);
  }
}
