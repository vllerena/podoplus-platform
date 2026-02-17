import {
  createParamDecorator,
  ExecutionContext,
  Logger,
  BadRequestException,
} from "@nestjs/common";

const logger = new Logger("CurrentUserDecorator");

export interface CurrentUserData {
  sub: string;
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      logger.error(
        "CurrentUser decorator: usuario no encontrado o sin sub en request"
      );
      logger.error("request.user:", user);
      throw new BadRequestException("Usuario no autenticado");
    }

    return {
      sub: user.sub,
      userId: user.sub,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
);
