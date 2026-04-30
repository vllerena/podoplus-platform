import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignUserRoleDto {
  @ApiProperty({ example: "clx1234abcd", description: "ID del usuario al que se asigna o revoca el rol" })
  @IsString()
  @IsNotEmpty({ message: "userId es requerido" })
  userId: string;

  @ApiProperty({ example: "clx5678efgh", description: "ID del rol a asignar o revocar" })
  @IsString()
  @IsNotEmpty({ message: "roleId es requerido" })
  roleId: string;
}
