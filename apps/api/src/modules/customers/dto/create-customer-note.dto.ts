import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCustomerNoteDto {
  @ApiProperty({
    example: "El paciente presenta dolor en el talón derecho.",
    description: "Contenido de la nota clínica",
  })
  @IsString()
  @IsNotEmpty({ message: "El contenido de la nota es requerido" })
  @MinLength(3, { message: "La nota debe tener al menos 3 caracteres" })
  @MaxLength(5000, { message: "La nota no puede superar 5000 caracteres" })
  content: string;
}
