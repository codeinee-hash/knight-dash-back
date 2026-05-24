import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";
import { Request } from "express";

export class CreateMultiplayerGameDto {
  @ApiProperty({ example: 30, description: "Time mode: 15 | 30 | 60" })
  @IsNumber()
  readonly timeMode!: number;
}

export class JoinMultiplayerGameDto {
  @ApiProperty({
    example: "ABC123",
    description: "Room code to join",
  })
  @IsString()
  readonly roomCode!: string;
}

export interface RequestWithUser extends Request {
  user: { login: string; email: string; _id: string };
}
