import { Injectable } from "@nestjs/common";
import { GameEngine, GameMode, GameState } from "./game-engine";

/**
 * GameRoomManager — Управляет всеми активными игровыми сессиями.
 *
 * Хранит Map<gameId, GameEngine> в оперативной памяти.
 * Когда игра завершается, она удаляется из памяти (результаты уже сохранены в MongoDB).
 */
@Injectable()
export class GameRoomManager {
  private readonly rooms = new Map<string, GameEngine>();

  /**
   * Создает новую игровую комнату.
   */
  createRoom(gameId: string, timeMode: number, mode: GameMode): GameEngine {
    const engine = new GameEngine(timeMode, mode);
    this.rooms.set(gameId, engine);
    return engine;
  }

  /**
   * Получает движок по gameId.
   */
  getRoom(gameId: string): GameEngine | undefined {
    return this.rooms.get(gameId);
  }

  /**
   * Проверяет, существует ли комната.
   */
  hasRoom(gameId: string): boolean {
    return this.rooms.has(gameId);
  }

  /**
   * Удаляет комнату из памяти (после завершения игры).
   */
  removeRoom(gameId: string): void {
    const engine = this.rooms.get(gameId);
    if (engine) {
      engine.forceStop();
      this.rooms.delete(gameId);
    }
  }

  /**
   * Общее количество активных комнат.
   */
  getRoomCount(): number {
    return this.rooms.size;
  }
}
