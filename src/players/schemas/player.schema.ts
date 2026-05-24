import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Document } from "mongoose";

export type PlayerDocument = Player & Document;

@Schema({ timestamps: true })
export class Player {
  @ApiProperty({ example: "RenamedUser", description: "Nick name" })
  @Prop({ required: true, unique: true })
  declare login: string;

  @ApiProperty({ example: "example@mail.ru", description: "Email" })
  @Prop({ required: true, unique: true, type: String })
  declare email: string;

  @ApiProperty({ example: "******", description: "Password" })
  @Prop({ required: true, type: String })
  declare password: string;

  @ApiProperty({ example: 1200, description: "Scores for 15s" })
  @Prop({ type: Number })
  declare score15: number;

  @ApiProperty({ example: 2200, description: "Scores for 30s" })
  @Prop({ type: Number })
  declare score30: number;

  @ApiProperty({ example: 4000, description: "Scores for 60s" })
  @Prop({ type: Number })
  declare score60: number;

  @ApiProperty({ example: '/uploads/avatars/abc123.jpg', description: 'Avatar URL' })
  @Prop({ type: String, default: null })
  declare avatarUrl: string;
}

export const PlayerSchema = SchemaFactory.createForClass(Player);
