import {
  createParamDecorator,
  ExecutionContext,
  Logger,
  BadRequestException,
} from "@nestjs/common";

const logger = new Logger("CurrentUserDecorator");

export interface CurrentUserData {
  sub: string;
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Roles del usuario embebidos en el JWT (ej. ["RECEPTIONIST", "SUPERVISOR"]) */
  roles: string[];
  /** JTI del access token actual */
  jti?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      logger.error("CurrentUser: usuario no encontrado o sin sub en request");
      throw new BadRequestException("Usuario no autenticado");
    }

    return {
      sub:       user.sub,
      userId:    user.sub,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      roles:     user.roles ?? [],
      jti:       user.jti,
    };
  }
);
