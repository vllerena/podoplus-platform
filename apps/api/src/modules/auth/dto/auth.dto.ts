import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser un string' })
  @MinLength(6, { message: 'La contraseña debe tener mínimo 6 caracteres' })
  password: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'El refresh token debe ser un string' })
  @MinLength(10, { message: 'El refresh token inválido' })
  refreshToken: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsString({ message: 'El firstName debe ser un string' })
  @MinLength(2, { message: 'El firstName debe tener mínimo 2 caracteres' })
  firstName: string;

  @IsString({ message: 'El lastName debe ser un string' })
  @MinLength(2, { message: 'El lastName debe tener mínimo 2 caracteres' })
  lastName: string;

  @IsString({ message: 'La contraseña debe ser un string' })
  @MinLength(8, { message: 'La contraseña debe tener mínimo 8 caracteres' })
  password: string;
}