import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, MaxLength } from "class-validator";
import { Request } from "express";

export class UpdateLoginDto {
  @ApiProperty({ example: "NewNickname", description: "New login" })
  @IsString()
  @MinLength(3, { message: "Логин должен содержать минимум 3 символа" })
  @MaxLength(20, { message: "Логин должен содержать максимум 20 символов" })
  declare login: string;
}

export interface RequestWithUser extends Request {
  user: { login: string; email: string; _id: string };
}
