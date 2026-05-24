import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  SoloGame,
  SoloGameDocument,
} from "src/solo-game/schemas/solo-game.schema";
import { CreatePlayerDto } from "./dto/player.dto";
import { Player, PlayerDocument } from "./schemas/player.schema";
import {
  MultiplayerGame,
  MultiplayerGameDocument,
  GameStatus,
} from "src/multiplayer-game/schemas/multiplayer-game.schema";
import { TopPlayer, TopPlayersByMode } from "./types/player.interface";

@Injectable()
export class PlayerService {
  constructor(
    @InjectModel(Player.name) private playerModel: Model<PlayerDocument>,
    @InjectModel(SoloGame.name) private soloGameModel: Model<SoloGameDocument>,
    @InjectModel(MultiplayerGame.name) private multiplayerGameModel: Model<MultiplayerGameDocument>,
  ) {}

  async createPlayer(dto: CreatePlayerDto) {
    const createdPlayer = new this.playerModel(dto);
    const player = await createdPlayer.save();

    return {
      status: "success",
      player,
    };
  }

  async getAllPlayers() {
    const players = await this.playerModel.find().exec();

    return {
      status: "success",
      data: players,
    };
  }

  async getPlayerByEmail(email: string) {
    const player = await this.playerModel.findOne({ email }).lean();

    return player;
  }

  async getPlayerByLogin(login: string) {
    const player = await this.playerModel.findOne({ login }).lean();

    return player;
  }

  async getPlayerByLoginOrEmail(loginOrEmail: string) {
    const player = await this.playerModel
      .findOne({ $or: [{ login: loginOrEmail }, { email: loginOrEmail }] })
      .lean();

    return player;
  }

  async getTopPlayers() {
    const timeModes = [15, 30, 60];
    const topPlayersByMode: TopPlayersByMode[] = [];

    for (const timeMode of timeModes) {
      const topPlayers = await this.soloGameModel
        .aggregate<TopPlayer>([
          { $match: { timeMode } },
          {
            $group: {
              _id: "$playerId",
              totalScore: { $max: "$totalScore" },
            },
          },
          {
            $lookup: {
              from: "players",
              localField: "_id",
              foreignField: "_id",
              as: "player",
            },
          },
          { $unwind: "$player" },
          { $sort: { totalScore: -1 } },
          { $limit: 10 },
          {
            $project: {
              _id: "$player._id",
              login: "$player.login",
              avatarUrl: "$player.avatarUrl",
              totalScore: 1,
              timeMode: { $literal: timeMode },
            },
          },
        ])
        .exec();

      topPlayersByMode.push({
        timeMode,
        players: topPlayers,
      });
    }

    return {
      status: "success",
      data: topPlayersByMode,
    };
  }

  async getTopMultiplayerPlayers() {
    const players = await this.playerModel.find().select('login avatarUrl _id').lean();
    const games = await this.multiplayerGameModel.find({ status: GameStatus.FINISHED }).lean();

    const statsMap = new Map();
    for (const player of players) {
      statsMap.set(player._id.toString(), {
        _id: player._id.toString(),
        login: player.login,
        avatarUrl: player.avatarUrl,
        wins: 0,
        losses: 0,
        totalGames: 0,
        winRate: 0,
      });
    }

    for (const game of games) {
      const p1 = game.player1Id?.toString();
      const p2 = game.player2Id?.toString();
      const winner = game.winnerId?.toString();

      if (p1 && statsMap.has(p1)) {
        statsMap.get(p1).totalGames++;
        if (winner === p1) statsMap.get(p1).wins++;
      }
      if (p2 && statsMap.has(p2)) {
        statsMap.get(p2).totalGames++;
        if (winner === p2) statsMap.get(p2).wins++;
      }
    }

    const result = Array.from(statsMap.values()).map(stat => {
      stat.losses = stat.totalGames - stat.wins;
      stat.winRate = stat.totalGames > 0 ? Number(((stat.wins / stat.totalGames) * 100).toFixed(2)) : 0;
      return stat;
    });

    result.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalGames - a.totalGames;
    });

    return {
      status: 'success',
      data: result.slice(0, 10)
    };
  }

  async getPlayerById(id: string) {
    const player = await this.playerModel.findById(id).select('-password').lean();
    return player;
  }

  async updatePlayer(id: string, updateData: Partial<{ login: string; avatarUrl: string }>) {
    const player = await this.playerModel.findByIdAndUpdate(id, updateData, { new: true }).select('-password').lean();
    return player;
  }
}
