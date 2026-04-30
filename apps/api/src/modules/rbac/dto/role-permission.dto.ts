import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignRolePermissionDto {
  @ApiProperty({ example: "clx1234abcd", description: "ID del rol al que se asigna o revoca el permiso" })
  @IsString()
  @IsNotEmpty({ message: "roleId es requerido" })
  roleId: string;

  @ApiProperty({ example: "clx5678efgh", description: "ID del permiso a asignar o revocar" })
  @IsString()
  @IsNotEmpty({ message: "permissionId es requerido" })
  permissionId: string;
}
