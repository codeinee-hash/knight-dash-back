import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Response } from "express";
import { PlayerService } from "src/players/player.service";
import { TokensService, TokenType } from "src/auth/token.service";
import {
  MultiplayerGame,
  MultiplayerGameDocument,
  GameStatus,
} from "src/multiplayer-game/schemas/multiplayer-game.schema";

@Injectable()
export class ProfileService {
  constructor(
    private playerService: PlayerService,
    private tokensService: TokensService,
    @InjectModel(MultiplayerGame.name)
    private multiplayerGameModel: Model<MultiplayerGameDocument>,
  ) {}

  async getProfile(userId: string) {
    const player = await this.playerService.getPlayerById(userId);
    if (!player) {
      throw new HttpException("Игрок не найден", HttpStatus.NOT_FOUND);
    }

    const userObjectId = new Types.ObjectId(userId);

    // Stats aggregation
    const totalGames = await this.multiplayerGameModel.countDocuments({
      status: GameStatus.FINISHED,
      $or: [{ player1Id: userObjectId }, { player2Id: userObjectId }],
    });

    const wins = await this.multiplayerGameModel.countDocuments({
      status: GameStatus.FINISHED,
      winnerId: userObjectId,
    });

    const avgScoreResult = await this.multiplayerGameModel.aggregate([
      {
        $match: {
          status: GameStatus.FINISHED,
          $or: [{ player1Id: userObjectId }, { player2Id: userObjectId }],
        },
      },
      {
        $project: {
          myScore: {
            $cond: [
              { $eq: ["$player1Id", userObjectId] },
              "$player1Score",
              "$player2Score",
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$myScore" },
        },
      },
    ]);

    const avgScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgScore) : 0;
    const winRate = totalGames > 0 ? Number(((wins / totalGames) * 100).toFixed(2)) : 0;

    // Recent 5 games
    const recentGames = await this.multiplayerGameModel
      .find({
        status: GameStatus.FINISHED,
        $or: [{ player1Id: userObjectId }, { player2Id: userObjectId }],
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("player1Id", "login")
      .populate("player2Id", "login")
      .lean();

    return {
      player,
      stats: { totalGames, winRate, avgScore },
      recentGames,
    };
  }

  async updateLogin(userId: string, newLogin: string, res: Response) {
    const existing = await this.playerService.getPlayerByLogin(newLogin);
    if (existing && existing._id.toString() !== userId) {
      throw new HttpException("Этот логин уже занят", HttpStatus.BAD_REQUEST);
    }

    const player = await this.playerService.updatePlayer(userId, { login: newLogin });
    if (!player) {
      throw new HttpException("Игрок не найден", HttpStatus.NOT_FOUND);
    }

    // Re-issue tokens with updated login
    const { accessToken, refreshToken } = this.tokensService.generateTokens({
      _id: userId,
      login: newLogin,
      email: player.email,
      avatarUrl: player.avatarUrl,
    });

    this.tokensService.setRefreshTokenCookie(res, TokenType.REFRESH, refreshToken);
    this.tokensService.setRefreshTokenCookie(res, TokenType.ACCESS, accessToken);

    return player;
  }

  async updateAvatar(userId: string, file: Express.Multer.File, res: Response) {
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const player = await this.playerService.updatePlayer(userId, { avatarUrl });
    if (!player) {
      throw new HttpException("Игрок не найден", HttpStatus.NOT_FOUND);
    }

    const { accessToken, refreshToken } = this.tokensService.generateTokens({
      _id: userId,
      login: player.login,
      email: player.email,
      avatarUrl: player.avatarUrl,
    });

    this.tokensService.setRefreshTokenCookie(res, TokenType.REFRESH, refreshToken);
    this.tokensService.setRefreshTokenCookie(res, TokenType.ACCESS, accessToken);

    return player;
  }
}
