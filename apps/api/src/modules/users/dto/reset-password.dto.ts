import { IsString, MaxLength, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MESSAGE } from "../../auth/dto/auth.dto";

/** Usado por administradores para forzar una nueva contraseña en cualquier usuario. */
export class AdminResetPasswordDto {
  @ApiProperty({ example: "NewPassw0rd!", description: "Nueva contraseña segura (mín. 8 chars, mayúscula, número y especial)" })
  @IsString()
  @MinLength(8,   { message: "La nueva contraseña debe tener mínimo 8 caracteres" })
  @MaxLength(128, { message: "La nueva contraseña no puede superar 128 caracteres" })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  new_password: string;
}
