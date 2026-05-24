import { Injectable, Logger, UseGuards } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Model } from "mongoose";
import { Server, Socket } from "socket.io";
import { WsJwtGuard } from "src/auth/guards/ws-jwt.guard";
import { GameRoomManager } from "src/game-engine/game-room-manager";
import { SoloGame, SoloGameDocument } from "../schemas/solo-game.schema";

/**
 * SoloGameSocketService — WebSocket Gateway для одиночной игры.
 *
 * Authoritative Server: вся игровая логика (ходы коня, монетки, очки)
 * обрабатывается на сервере. Клиент только отправляет намерения
 * и получает обновленное состояние.
 *
 * События:
 * Client → Server:
 *   - 'start-game'   { gameId }          — запуск игры (инициализация движка)
 *   - 'move-figure'  { gameId, toX, toY } — попытка хода коня
 *
 * Server → Client:
 *   - 'game-state'    { players, coins, finished, remainingTime }  — начальное состояние
 *   - 'state-updated' { players, coins, finished, remainingTime }  — обновленное состояние после хода
 *   - 'game-over'     { players, coins, finished, remainingTime }  — игра завершена
 *   - 'server-error'  { message, status }                          — ошибка
 */
@Injectable()
@WebSocketGateway({ namespace: "/solo", cors: { origin: true, credentials: true } })
export class SoloGameSocketService
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SoloGameSocketService.name);

  /** Маппинг socketId → gameId для корректной обработки disconnect */
  private socketToGame = new Map<string, string>();

  constructor(
    @InjectModel(SoloGame.name)
    private soloGameModel: Model<SoloGameDocument>,
    private gameRoomManager: GameRoomManager,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Solo client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const gameId = this.socketToGame.get(client.id);
    if (gameId) {
      this.socketToGame.delete(client.id);
    }
    this.logger.log(`Solo client disconnected: ${client.id}`);
  }

  /**
   * Клиент запускает игру. Сервер инициализирует in-memory движок
   * и отправляет начальное состояние (позиция коня + монетки).
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("start-game")
  async handleStartGame(
    @MessageBody() { gameId }: { gameId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        return client.emit("server-error", {
          message: "Не авторизован",
          status: 401,
        });
      }

      // Проверяем, что сессия существует в MongoDB
      const session = await this.soloGameModel.findById(gameId);
      if (!session) {
        return client.emit("server-error", {
          message: "Игра не найдена",
          status: 404,
        });
      }

      if (session.finished) {
        return client.emit("server-error", {
          message: "Игра уже закончена",
          status: 403,
        });
      }

      // Проверяем, что это игра текущего пользователя
      if (session.playerId.toString() !== user._id) {
        return client.emit("server-error", {
          message: "Нет доступа к этой игре",
          status: 403,
        });
      }

      let engine = this.gameRoomManager.getRoom(gameId);

      if (!engine) {
        // Создаем in-memory движок
        engine = this.gameRoomManager.createRoom(
          gameId,
          session.timeMode,
          "solo",
        );
        engine.initGame([user._id]);

        // Запускаем таймеры
        engine.startTimers(async () => {
          // Callback при окончании времени
          await this.handleGameOverInternal(gameId);
        });
      }

      // Привязываем сокет к игре
      this.socketToGame.set(client.id, gameId);
      client.join(`solo_${gameId}`);

      // Отправляем начальное состояние
      client.emit("game-state", engine.getState());
    } catch (error) {
      client.emit("server-error", {
        message: error instanceof Error ? error.message : "Ошибка при запуске игры",
        status: 500,
      });
    }
  }

  /**
   * Клиент пытается переместить коня.
   * Сервер проверяет валидность хода и отправляет обновленный стейт.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("move-figure")
  async handleMoveFigure(
    @MessageBody()
    { gameId, toX, toY }: { gameId: string; toX: number; toY: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        return client.emit("server-error", {
          message: "Не авторизован",
          status: 401,
        });
      }

      const engine = this.gameRoomManager.getRoom(gameId);
      if (!engine) {
        return client.emit("server-error", {
          message: "Игра не найдена или не запущена",
          status: 404,
        });
      }

      if (engine.isFinished()) {
        return client.emit("server-error", {
          message: "Игра уже закончена",
          status: 403,
        });
      }

      const result = engine.movePlayer(user._id, toX, toY);
      if (!result) {
        return client.emit("server-error", {
          message: "Невалидный ход",
          status: 400,
        });
      }

      client.emit("state-updated", result.state);
    } catch (error) {
      client.emit("server-error", {
        message: error instanceof Error ? error.message : "Ошибка при выполнении хода",
        status: 500,
      });
    }
  }

  /**
   * Внутренний метод: вызывается при истечении таймера.
   * Сохраняет результат в MongoDB и уведомляет клиента.
   */
  private async handleGameOverInternal(gameId: string): Promise<void> {
    try {
      const engine = this.gameRoomManager.getRoom(gameId);
      if (!engine) return;

      const state = engine.getState();
      const player = state.players[0];

      if (player) {
        // Сохраняем результат в MongoDB
        await this.soloGameModel.findByIdAndUpdate(gameId, {
          finished: true,
          totalScore: player.score,
          score150: player.coinCounts[150] || 0,
          score200: player.coinCounts[200] || 0,
          score250: player.coinCounts[250] || 0,
          score300: player.coinCounts[300] || 0,
          score350: player.coinCounts[350] || 0,
        });
      }

      // Уведомляем всех в комнате
      this.server.to(`solo_${gameId}`).emit("game-over", state);

      // Удаляем комнату из памяти
      this.gameRoomManager.removeRoom(gameId);
    } catch (error) {
      this.logger.error(`Error ending game ${gameId}:`, error);
    }
  }
}
