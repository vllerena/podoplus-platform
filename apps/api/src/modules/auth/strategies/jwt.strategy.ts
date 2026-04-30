import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../../cache/cache.service";
import { TokenPayload } from "../auth.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: TokenPayload) {
    // Verificar que el access token no esté en la blacklist (logout)
    if (payload.jti) {
      const blacklisted = await this.cache.get<string>(`bl:${payload.jti}`);
      if (blacklisted) {
        throw new UnauthorizedException("Token revocado");
      }
    }

    return {
      sub:         payload.sub,
      userId:      payload.sub,
      email:       payload.email,
      firstName:   payload.firstName,
      lastName:    payload.lastName,
      roles:       payload.roles ?? [],
      jti:         payload.jti,
    };
  }
}
