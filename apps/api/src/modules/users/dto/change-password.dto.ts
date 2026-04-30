import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MESSAGE } from "../../auth/dto/auth.dto";

export class ChangePasswordDto {
  @ApiProperty({ example: "OldPassw0rd!", description: "Contraseña actual del usuario" })
  @IsString()
  @IsNotEmpty({ message: "La contraseña actual es requerida" })
  currentPassword: string;

  @ApiProperty({ example: "NewPassw0rd!", description: "Nueva contraseña segura (mín. 8 chars, mayúscula, número y especial)" })
  @IsString()
  @MinLength(8,   { message: "La nueva contraseña debe tener mínimo 8 caracteres" })
  @MaxLength(128, { message: "La nueva contraseña no puede superar 128 caracteres" })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string;
}
