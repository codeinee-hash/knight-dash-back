import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";

export type MultiplayerGameDocument = MultiplayerGame & Document;

export enum GameStatus {
  WAITING = "waiting",
  PLAYING = "playing",
  FINISHED = "finished",
}

@Schema({ timestamps: true })
export class MultiplayerGame {
  /** Уникальный короткий код комнаты для приглашения (6 символов) */
  @Prop({ required: true, unique: true })
  declare roomCode: string;

  /** Статус игры: waiting → playing → finished */
  @Prop({
    type: String,
    enum: GameStatus,
    default: GameStatus.WAITING,
  })
  declare status: GameStatus;

  /** Игрок 1 (создатель комнаты) */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
  })
  declare player1Id: mongoose.Types.ObjectId;

  /** Игрок 2 (присоединяется по roomCode) */
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: "Player" })
  declare player2Id: mongoose.Types.ObjectId;

  /** Итоговый счет игрока 1 */
  @Prop({ type: Number, default: 0 })
  declare player1Score: number;

  /** Итоговый счет игрока 2 */
  @Prop({ type: Number, default: 0 })
  declare player2Score: number;

  /** Режим времени (секунды): 15, 30, 60 */
  @Prop({ type: Number, required: true })
  declare timeMode: number;

  /** ID победителя (null если ничья) */
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: "Player" })
  declare winnerId: mongoose.Types.ObjectId;
}

export const MultiplayerGameSchema =
  SchemaFactory.createForClass(MultiplayerGame);
