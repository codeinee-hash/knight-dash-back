import { Injectable, Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { WsJwtGuard } from "src/auth/guards/ws-jwt.guard";
import { GameRoomManager } from "src/game-engine/game-room-manager";
import { MultiplayerGameService } from "../multiplayer-game.service";

/**
 * MultiplayerSocketService — WebSocket Gateway для мультиплеерной игры.
 *
 * Используем Socket.io Rooms для изоляции игровых комнат.
 * Authoritative Server: вся логика (ходы, монетки, очки) на сервере.
 *
 * Поток:
 * 1. Player1 создает комнату через REST API → получает roomCode
 * 2. Player2 присоединяется через REST API → POST /join с roomCode
 * 3. Оба подключаются к сокету и отправляют 'join-room' { gameId }
 * 4. Когда оба в комнате, каждый отправляет 'player-ready' { gameId }
 * 5. Когда оба ready, сервер запускает игру и отправляет 'game-started'
 * 6. Игроки отправляют 'move-figure' { gameId, toX, toY }
 * 7. По окончании времени сервер отправляет 'game-over'
 *
 * События:
 * Client → Server:
 *   - 'join-room'     { gameId }          — войти в Socket.io комнату
 *   - 'player-ready'  { gameId }          — игрок готов к старту
 *   - 'move-figure'   { gameId, toX, toY } — попытка хода коня
 *
 * Server → Client:
 *   - 'room-joined'         { message }               — успешный вход в комнату
 *   - 'player-joined'       { playerId }               — второй игрок присоединился
 *   - 'game-started'        { state }                  — оба готовы, игра началась
 *   - 'state-updated'       { state }                  — обновленное состояние после хода
 *   - 'game-over'           { state, winnerId }        — игра завершена
 *   - 'player-disconnected' { playerId }               — игрок отключился
 *   - 'server-error'        { message, status }        — ошибка
 */
@Injectable()
@WebSocketGateway({ namespace: "/multiplayer", cors: { origin: true, credentials: true } })
export class MultiplayerSocketService
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MultiplayerSocketService.name);

  /** socketId → gameId */
  private socketToGame = new Map<string, string>();
  /** socketId → playerId */
  private socketToPlayer = new Map<string, string>();
  /** gameId → Set<playerId> (игроки, отправившие 'player-ready') */
  private readyPlayers = new Map<string, Set<string>>();
  /** gameId → { playerId, timeout } — таймауты на отключение */
  private disconnectTimers = new Map<string, { playerId: string; timeout: ReturnType<typeof setTimeout> }>();

  /** Время ожидания переподключения (30 секунд) */
  private readonly RECONNECT_GRACE_MS = 30_000;

  constructor(
    private gameRoomManager: GameRoomManager,
    private multiplayerService: MultiplayerGameService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Multiplayer client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const gameId = this.socketToGame.get(client.id);
    const playerId = this.socketToPlayer.get(client.id);

    if (gameId && playerId) {
      const engine = this.gameRoomManager.getRoom(gameId);

      if (engine && !engine.isFinished()) {
        // Уведомляем второго игрока что соперник отключился (но игра ещё жива)
        client.to(`mp_${gameId}`).emit("player-disconnected", {
          playerId,
        });

        // Ставим таймер: если не переподключится за RECONNECT_GRACE_MS — завершаем игру
        const timeout = setTimeout(() => {
          this.logger.log(`Reconnect timeout expired for player ${playerId} in game ${gameId}`);
          const eng = this.gameRoomManager.getRoom(gameId);
          if (eng && !eng.isFinished()) {
            eng.forceStop();
            this.server.to(`mp_${gameId}`).emit("game-over", {
              ...eng.getState(),
              winnerId: null,
              reason: "opponent-disconnected",
            });

            this.saveGameResults(gameId).catch((err) => {
              this.logger.error(`Error saving results after disconnect timeout ${gameId}:`, err);
            });
            this.gameRoomManager.removeRoom(gameId);
          }
          this.disconnectTimers.delete(gameId);
        }, this.RECONNECT_GRACE_MS);

        this.disconnectTimers.set(gameId, { playerId, timeout });
      }

      // Очищаем ready-статус
      this.readyPlayers.get(gameId)?.delete(playerId);
    }

    this.socketToGame.delete(client.id);
    this.socketToPlayer.delete(client.id);
    this.logger.log(`Multiplayer client disconnected: ${client.id}`);
  }

  /**
   * Игрок присоединяется к Socket.io комнате.
   * Если игра уже идёт (reconnect), отправляем текущее состояние.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join-room")
  async handleJoinRoom(
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

      // Проверяем, что комната существует в БД
      const room = await this.multiplayerService.getRoomById(gameId);

      const p1Id = (room.player1Id as any)._id.toString();
      const p2Id = room.player2Id ? (room.player2Id as any)._id.toString() : null;

      // Проверяем, что пользователь — один из двух игроков
      const isPlayer1 = p1Id === user._id;
      const isPlayer2 = p2Id === user._id;
      if (!isPlayer1 && !isPlayer2) {
        return client.emit("server-error", {
          message: "Вы не участник этой игры",
          status: 403,
        });
      }

      // Присоединяем сокет к комнате
      client.join(`mp_${gameId}`);
      this.socketToGame.set(client.id, gameId);
      this.socketToPlayer.set(client.id, user._id);

      // Отменяем таймер дисконнекта, если это реконнект
      const pendingDisconnect = this.disconnectTimers.get(gameId);
      if (pendingDisconnect && pendingDisconnect.playerId === user._id) {
        clearTimeout(pendingDisconnect.timeout);
        this.disconnectTimers.delete(gameId);
        this.logger.log(`Player ${user._id} reconnected to game ${gameId}, cancel disconnect timer`);
      }

      // Проверяем, идёт ли уже игра (reconnect scenario)
      const engine = this.gameRoomManager.getRoom(gameId);
      if (engine && !engine.isFinished()) {
        // Игра уже идёт — отправляем текущее состояние, клиент пропустит лобби
        client.emit("room-joined", {
          message: "Вы вернулись в игру",
          gameId,
          roomCode: room.roomCode,
          timeMode: room.timeMode,
          playersInRoom: 2,
          player1Login: (room.player1Id as any).login,
          player2Login: room.player2Id ? (room.player2Id as any).login : undefined,
          player1Avatar: (room.player1Id as any).avatarUrl,
          player2Avatar: room.player2Id ? (room.player2Id as any).avatarUrl : undefined,
        });
        client.emit("game-started", engine.getState());

        // Уведомляем соперника что игрок вернулся
        client.to(`mp_${gameId}`).emit("player-reconnected", {
          playerId: user._id,
        });
        return;
      }

      // Подсчитываем кол-во уже подключённых сокетов в комнате
      const socketsInRoom = await this.server.in(`mp_${gameId}`).fetchSockets();
      const playersInRoom = socketsInRoom.length;

      client.emit("room-joined", {
        message: "Вы вошли в комнату",
        gameId,
        roomCode: room.roomCode,
        timeMode: room.timeMode,
        playersInRoom,
        player1Login: (room.player1Id as any).login,
        player2Login: room.player2Id ? (room.player2Id as any).login : undefined,
        player1Avatar: (room.player1Id as any).avatarUrl,
        player2Avatar: room.player2Id ? (room.player2Id as any).avatarUrl : undefined,
      });

      // Уведомляем других в комнате
      client.to(`mp_${gameId}`).emit("player-joined", {
        playerId: user._id,
        login: user.login,
        avatarUrl: (room.player1Id as any)._id.toString() === user._id 
          ? (room.player1Id as any).avatarUrl 
          : room.player2Id ? (room.player2Id as any).avatarUrl : undefined,
      });

      // Отправляем текущий статус готовности (если кто-то уже нажал "Готов")
      const readySet = this.readyPlayers.get(gameId);
      if (readySet && readySet.size > 0) {
        client.emit("player-ready-status", {
          playerId: user._id,
          readyCount: readySet.size,
        });
      }
    } catch (error) {
      client.emit("server-error", {
        message: error instanceof Error ? error.message : "Ошибка при подключении к комнате",
        status: 500,
      });
    }
  }

  /**
   * Игрок сообщает, что готов. Когда оба ready — запускаем игру.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("player-ready")
  async handlePlayerReady(
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

      if (!this.readyPlayers.has(gameId)) {
        this.readyPlayers.set(gameId, new Set());
      }

      this.readyPlayers.get(gameId)!.add(user._id);

      // Проверяем, оба ли игрока ready
      const room = await this.multiplayerService.getRoomById(gameId);
      const readySet = this.readyPlayers.get(gameId)!;

      const bothReady =
        room.player2Id &&
        readySet.has((room.player1Id as any)._id.toString()) &&
        readySet.has((room.player2Id as any)._id.toString());

      if (bothReady) {
        // Создаем in-memory движок
        const engine = this.gameRoomManager.createRoom(
          gameId,
          room.timeMode,
          "multiplayer",
        );
        engine.initGame([
          (room.player1Id as any)._id.toString(),
          (room.player2Id as any)._id.toString(),
        ]);

        // Обновляем статус в БД
        await this.multiplayerService.startGame(gameId);

        // Запускаем таймеры
        engine.startTimers(async () => {
          await this.handleGameOverInternal(gameId);
        });

        // Отправляем начальное состояние обоим игрокам
        this.server.to(`mp_${gameId}`).emit("game-started", engine.getState());

        // Очищаем ready map
        this.readyPlayers.delete(gameId);
      } else {
        // Уведомляем комнату, что этот игрок готов
        this.server.to(`mp_${gameId}`).emit("player-ready-status", {
          playerId: user._id,
          readyCount: readySet.size,
        });
      }
    } catch (error) {
      client.emit("server-error", {
        message: error instanceof Error ? error.message : "Ошибка",
        status: 500,
      });
    }
  }

  /**
   * Создатель отменяет игру
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("cancel-game")
  async handleCancelGame(
    @MessageBody() { gameId }: { gameId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        return client.emit("server-error", { message: "Не авторизован", status: 401 });
      }

      await this.multiplayerService.cancelGame(user._id, gameId);

      // Уведомляем всех в комнате об отмене
      this.server.to(`mp_${gameId}`).emit("game-cancelled", {
        message: "Игра отменена",
      });

      // Очищаем локальные данные комнаты
      this.readyPlayers.delete(gameId);
      
    } catch (error) {
      client.emit("server-error", {
        message: error instanceof Error ? error.message : "Ошибка при отмене игры",
        status: 500,
      });
    }
  }

  /**
   * Игрок пытается переместить коня.
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

      // Рассылаем обновленный стейт ОБОИМ игрокам
      this.server.to(`mp_${gameId}`).emit("state-updated", result.state);
    } catch (error) {
      client.emit("server-error", {
        message: error instanceof Error ? error.message : "Ошибка при выполнении хода",
        status: 500,
      });
    }
  }

  /**
   * Внутренний метод: вызывается при истечении таймера.
   */
  private async handleGameOverInternal(gameId: string): Promise<void> {
    try {
      await this.saveGameResults(gameId);

      const engine = this.gameRoomManager.getRoom(gameId);
      if (!engine) return;

      const state = engine.getState();
      const players = state.players;

      let winnerId: string | null = null;
      if (players.length === 2) {
        if (players[0].score > players[1].score) {
          winnerId = players[0].id;
        } else if (players[1].score > players[0].score) {
          winnerId = players[1].id;
        }
        // Если равны — ничья, winnerId = null
      }

      this.server.to(`mp_${gameId}`).emit("game-over", {
        ...state,
        winnerId,
      });

      // Удаляем комнату из памяти
      this.gameRoomManager.removeRoom(gameId);
    } catch (error) {
      this.logger.error(`Error ending multiplayer game ${gameId}:`, error);
    }
  }

  /**
   * Сохраняет результаты игры в MongoDB.
   */
  private async saveGameResults(gameId: string): Promise<void> {
    const engine = this.gameRoomManager.getRoom(gameId);
    if (!engine) return;

    const state = engine.getState();
    const players = state.players;

    if (players.length < 2) return;

    let winnerId: string | null = null;
    if (players[0].score > players[1].score) {
      winnerId = players[0].id;
    } else if (players[1].score > players[0].score) {
      winnerId = players[1].id;
    }

    await this.multiplayerService.finishGame(
      gameId,
      players[0].score,
      players[1].score,
      winnerId,
    );
  }
}
