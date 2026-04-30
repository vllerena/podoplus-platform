import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class ExtractUserMiddleware implements NestMiddleware {
  private readonly logger = new Logger("ExtractUserMiddleware");

  constructor(private jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.jwtService.verify(token);
      req.user = {
        sub:       payload.sub,
        userId:    payload.sub,
        email:     payload.email,
        firstName: payload.firstName,
        lastName:  payload.lastName,
        roles:     payload.roles ?? [],
        jti:       payload.jti,
      };
      this.logger.debug(`User attached: ${payload.sub} [${(payload.roles ?? []).join(", ")}]`);
    } catch (error) {
      this.logger.warn(`JWT verification failed: ${error.message}`);
    }

    next();
  }
}
