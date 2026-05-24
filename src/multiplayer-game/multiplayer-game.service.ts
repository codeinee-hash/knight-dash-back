import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { nanoid } from "nanoid";
import {
  GameStatus,
  MultiplayerGame,
  MultiplayerGameDocument,
} from "./schemas/multiplayer-game.schema";

@Injectable()
export class MultiplayerGameService {
  constructor(
    @InjectModel(MultiplayerGame.name)
    private multiplayerGameModel: Model<MultiplayerGameDocument>,
  ) {}

  /**
   * Создает новую мультиплеерную комнату.
   * Генерирует уникальный 6-символьный roomCode.
   */
  async createRoom(playerId: string, timeMode: number) {
    if (!playerId) {
      throw new BadRequestException("ID игрока не передан");
    }

    const roomCode = nanoid(6).toUpperCase();

    const room = new this.multiplayerGameModel({
      roomCode,
      status: GameStatus.WAITING,
      player1Id: playerId,
      timeMode,
    });

    const saved = await room.save();

    return {
      gameId: saved._id,
      roomCode: saved.roomCode,
      status: saved.status,
      timeMode: saved.timeMode,
    };
  }

  /**
   * Второй игрок присоединяется к комнате по roomCode.
   */
  async joinRoom(playerId: string, roomCode: string) {
    if (!playerId) {
      throw new BadRequestException("ID игрока не передан");
    }

    const room = await this.multiplayerGameModel.findOne({
      roomCode: roomCode.toUpperCase(),
    });

    if (!room) {
      throw new NotFoundException("Комната не найдена");
    }

    if (room.status !== GameStatus.WAITING) {
      throw new ForbiddenException("Комната уже заполнена или игра завершена");
    }

    if (room.player1Id.toString() === playerId) {
      throw new BadRequestException("Нельзя присоединиться к своей игре");
    }

    room.player2Id = new Types.ObjectId(playerId);
    room.status = GameStatus.WAITING; // Всё ещё ждём, пока оба не "ready" через сокет

    await room.save();

    return {
      gameId: room._id,
      roomCode: room.roomCode,
      status: room.status,
      timeMode: room.timeMode,
      player1Id: room.player1Id,
      player2Id: room.player2Id,
    };
  }

  /**
   * Получает информацию о комнате по ID.
   */
  async getRoomById(gameId: string) {
    if (!Types.ObjectId.isValid(gameId)) {
      throw new BadRequestException("Неверный формат gameId");
    }

    const room = await this.multiplayerGameModel.findById(gameId)
      .populate("player1Id", "login avatarUrl")
      .populate("player2Id", "login avatarUrl");
      
    if (!room) {
      throw new NotFoundException("Комната не найдена");
    }

    return room;
  }

  /**
   * Получает информацию о комнате по roomCode.
   */
  async getRoomByCode(roomCode: string) {
    const room = await this.multiplayerGameModel.findOne({
      roomCode: roomCode.toUpperCase(),
    });

    if (!room) {
      throw new NotFoundException("Комната не найдена");
    }

    return room;
  }

  /**
   * Обновляет статус игры на 'playing'.
   */
  async startGame(gameId: string) {
    return this.multiplayerGameModel.findByIdAndUpdate(
      gameId,
      { status: GameStatus.PLAYING },
      { new: true },
    );
  }

  /**
   * Сохраняет итоговые результаты игры.
   */
  async finishGame(
    gameId: string,
    player1Score: number,
    player2Score: number,
    winnerId: string | null,
  ) {
    const updateData: any = {
      status: GameStatus.FINISHED,
      player1Score,
      player2Score,
    };

    if (winnerId) {
      updateData.winnerId = new Types.ObjectId(winnerId);
    }

    return this.multiplayerGameModel.findByIdAndUpdate(gameId, updateData, {
      new: true,
    });
  }

  /**
   * Удаляет игру (отменяет), если она еще не начата.
   */
  async cancelGame(playerId: string, gameId: string) {
    const room = await this.multiplayerGameModel.findById(gameId);
    if (!room) {
      throw new NotFoundException("Комната не найдена");
    }

    if (room.status !== GameStatus.WAITING) {
      throw new BadRequestException("Нельзя отменить игру, которая уже началась или завершена");
    }

    if (room.player1Id.toString() !== playerId) {
      throw new ForbiddenException("Только создатель может отменить игру");
    }

    await this.multiplayerGameModel.findByIdAndDelete(gameId);
    return { success: true, message: "Игра успешно отменена" };
  }
}
