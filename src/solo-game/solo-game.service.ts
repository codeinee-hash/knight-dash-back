import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { SoloGame, SoloGameDocument } from "./schemas/solo-game.schema";

@Injectable()
export class SoloGameService {
  constructor(
    @InjectModel(SoloGame.name) private soloGameModel: Model<SoloGameDocument>,
  ) {}

  async createGameSession({
    timeMode,
    playerId,
  }: {
    timeMode: number;
    playerId: string;
  }) {
    if (!playerId) {
      throw new BadRequestException("ID игрока не передан");
    }

    const createdSession = new this.soloGameModel({
      playerId,
      timeMode,
      finished: false,
      remainingTime: timeMode,
      startedAt: new Date(),
    });

    return await createdSession.save();
  }

  async getGameStatus(gameId: string) {
    if (gameId.length !== 24) {
      throw new NotFoundException("Игра с таким ID не найдена");
    }

    const session = await this.soloGameModel.findById(
      new Types.ObjectId(gameId),
    );
    if (!session) throw new NotFoundException("Игра не найдена");

    const now = new Date().getTime();
    const startedAt = session.startedAt.getTime();
    const elapsed = Math.floor((now - startedAt) / 1000);

    const remaining = session.timeMode - elapsed;

    return {
      gameId: session._id,
      timeMode: session.timeMode,
      remainingTime: Math.max(0, remaining),
      totalScore: session.totalScore,
      coin150: session.score150,
      coin200: session.score200,
      coin250: session.score250,
      coin300: session.score300,
      coin350: session.score350,
      finished: session.finished || remaining <= 0,
    };
  }

  async getGameInfo(gameId: string) {
    if (gameId.length !== 24) {
      throw new NotFoundException("Игра с таким ID не найдена");
    }

    const session = await this.soloGameModel.findById(
      new Types.ObjectId(gameId),
    );
    if (!session) throw new NotFoundException("Игра не найдена");

    return session;
  }

  async endGameSession(gameId: string) {
    const game = await this.soloGameModel.findById(new Types.ObjectId(gameId));
    if (!game) throw new NotFoundException("Игра не найдена");

    game.finished = true;

    return await game.save();
  }

  async submitScore({ score, gameId }: { score: number; gameId: string }) {
    if (![150, 200, 250, 300, 350].includes(score)) {
      throw new BadRequestException("Неверный номинал монеты");
    }

    const session = await this.soloGameModel.findById(
      new Types.ObjectId(gameId),
    );
    if (!session) throw new NotFoundException("Игра не найдена");

    const now = new Date().getTime();
    const startedAt = session.startedAt.getTime();
    const elapsed = Math.floor((now - startedAt) / 1000);

    const isFinished = elapsed >= session.timeMode;

    if (isFinished || session.finished) {
      session.finished = true;
      await session.save();
      throw new ForbiddenException("Игра уже закончена");
    }

    session[`score${score}`] += 1;
    session.totalScore += score;

    return await session.save();
  }

  async deleteGame(gameId: string, userId: string) {
    if (!Types.ObjectId.isValid(gameId)) {
      throw new BadRequestException("Неверный формат gameId");
    }

    const session = await this.soloGameModel.findById(
      new Types.ObjectId(gameId),
    );
    if (!session) {
      throw new NotFoundException("Игра не найдена");
    }

    if (session.playerId.toString() !== userId) {
      throw new ForbiddenException("У вас нет прав на удаление этой игры");
    }

    await this.soloGameModel.deleteOne({ _id: new Types.ObjectId(gameId) });

    return {
      status: "success",
      message: "Игра успешно удалена",
    };
  }
}
