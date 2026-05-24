import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";

export type SoloGameDocument = SoloGame & Document;

@Schema({ timestamps: true })
export class SoloGame {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true })
  declare playerId: mongoose.Types.ObjectId;

  @Prop({ type: Number, required: true })
  declare timeMode: number;

  @Prop({ type: Number })
  declare remainingTime: number;

  @Prop({ default: Date.now })
  startedAt!: Date;

  @Prop({ type: Number, default: 0 })
  declare totalScore: number;

  @Prop({ type: Boolean })
  finished!: boolean;

  @Prop({ type: Number, default: 0 })
  declare score150: number;

  @Prop({ type: Number, default: 0 })
  declare score200: number;

  @Prop({ type: Number, default: 0 })
  declare score250: number;

  @Prop({ type: Number, default: 0 })
  declare score300: number;

  @Prop({ type: Number, default: 0 })
  declare score350: number;
}

export const SoloGameSchema = SchemaFactory.createForClass(SoloGame);
