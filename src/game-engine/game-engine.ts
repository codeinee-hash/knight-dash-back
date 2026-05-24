/**
 * GameEngine — In-Memory игровой движок (Authoritative Server)
 *
 * Управляет состоянием одной игровой сессии:
 * - Доска 8x8
 * - Позиции игроков (коней)
 * - Монетки (координаты и номиналы)
 * - Валидация ходов коня
 * - Coin Level (повышение вероятности дорогих монет со временем)
 * - Подсчет очков
 */

export enum CoinNominal {
  COIN150 = 150,
  COIN200 = 200,
  COIN250 = 250,
  COIN300 = 300,
  COIN350 = 350,
}

export interface CoinState {
  x: number;
  y: number;
  nominal: CoinNominal;
}

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  score: number;
  /** Подсчет собранных монеток по номиналам */
  coinCounts: Record<CoinNominal, number>;
}

export interface GameState {
  players: PlayerState[];
  coins: CoinState[];
  finished: boolean;
  remainingTime: number;
  timeMode: number;
}

export type GameMode = "solo" | "multiplayer";

export class GameEngine {
  readonly boardWidth = 8;
  readonly boardHeight = 8;

  private players: PlayerState[] = [];
  private coins: CoinState[] = [];
  private coinLevel = 1;
  private coinLevelInterval: ReturnType<typeof setInterval> | null = null;
  private gameTimerTimeout: ReturnType<typeof setTimeout> | null = null;
  private startedAt: Date | null = null;
  private finished = false;
  private readonly timeMode: number;
  private readonly mode: GameMode;
  private onGameOver: (() => void) | null = null;

  constructor(timeMode: number, mode: GameMode) {
    this.timeMode = timeMode;
    this.mode = mode;
  }

  /**
   * Инициализирует игру: расставляет коней и генерирует монетки.
   */
  initGame(playerIds: string[]): void {
    this.finished = false;
    this.coinLevel = 1;
    this.coins = [];
    this.players = [];

    if (this.mode === "solo") {
      // Конь в левом нижнем углу (0, 7) — как на фронтенде
      this.players.push({
        id: playerIds[0],
        x: 0,
        y: 7,
        score: 0,
        coinCounts: {
          [CoinNominal.COIN150]: 0,
          [CoinNominal.COIN200]: 0,
          [CoinNominal.COIN250]: 0,
          [CoinNominal.COIN300]: 0,
          [CoinNominal.COIN350]: 0,
        },
      });
    } else {
      // Multiplayer: два коня в противоположных углах
      this.players.push({
        id: playerIds[0],
        x: 0,
        y: 7,
        score: 0,
        coinCounts: {
          [CoinNominal.COIN150]: 0,
          [CoinNominal.COIN200]: 0,
          [CoinNominal.COIN250]: 0,
          [CoinNominal.COIN300]: 0,
          [CoinNominal.COIN350]: 0,
        },
      });

      if (playerIds[1]) {
        this.players.push({
          id: playerIds[1],
          x: 7,
          y: 0,
          score: 0,
          coinCounts: {
            [CoinNominal.COIN150]: 0,
            [CoinNominal.COIN200]: 0,
            [CoinNominal.COIN250]: 0,
            [CoinNominal.COIN300]: 0,
            [CoinNominal.COIN350]: 0,
          },
        });
      }
    }

    // Генерируем начальные монетки (5 штук, как на фронте в use-board.ts)
    this.spawnCoins(5);
  }

  /**
   * Запускает таймеры игры:
   * - Повышение coinLevel каждые 10 секунд
   * - Завершение игры по истечении timeMode
   */
  startTimers(onGameOver: () => void): void {
    this.startedAt = new Date();
    this.onGameOver = onGameOver;

    // Повышение уровня монеток каждые 10 секунд (как на фронте)
    this.coinLevelInterval = setInterval(() => {
      this.coinLevel = Math.min(this.coinLevel + 1, 5);
    }, 10_000);

    // Автоматическое завершение игры
    this.gameTimerTimeout = setTimeout(() => {
      this.endGame();
    }, this.timeMode * 1000);
  }

  /**
   * Попытка хода игрока. Возвращает обновленный стейт если ход валиден.
   * Возвращает null если ход невалиден.
   */
  movePlayer(
    playerId: string,
    toX: number,
    toY: number,
  ): { state: GameState; coinCollected: CoinState | null } | null {
    if (this.finished) return null;

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return null;

    // Проверяем что ход валиден для коня
    if (!this.isValidKnightMove(player.x, player.y, toX, toY)) return null;

    // Проверяем что на целевой клетке нет другого игрока
    const otherPlayer = this.players.find(
      (p) => p.id !== playerId && p.x === toX && p.y === toY,
    );
    if (otherPlayer) return null;

    // Передвигаем коня
    player.x = toX;
    player.y = toY;

    // Проверяем, есть ли монетка на этой клетке
    const coinIndex = this.coins.findIndex((c) => c.x === toX && c.y === toY);
    let coinCollected: CoinState | null = null;

    if (coinIndex !== -1) {
      const coin = this.coins[coinIndex];
      coinCollected = { ...coin };

      // Начисляем очки
      player.score += coin.nominal;
      player.coinCounts[coin.nominal] += 1;

      // Удаляем собранную монетку
      this.coins.splice(coinIndex, 1);

      // Спавним новую монетку на замену
      this.spawnCoins(1);
    }

    return {
      state: this.getState(),
      coinCollected,
    };
  }

  /**
   * Завершает игру: останавливает таймеры, отмечает finished.
   */
  endGame(): void {
    if (this.finished) return;

    this.finished = true;
    this.clearTimers();

    if (this.onGameOver) {
      this.onGameOver();
    }
  }

  /**
   * Принудительная остановка игры (disconnect, abort).
   */
  forceStop(): void {
    this.finished = true;
    this.clearTimers();
  }

  /**
   * Возвращает текущий снимок состояния игры.
   */
  getState(): GameState {
    const remaining = this.getRemainingTime();

    return {
      players: this.players.map((p) => ({
        ...p,
        coinCounts: { ...p.coinCounts },
      })),
      coins: this.coins.map((c) => ({ ...c })),
      finished: this.finished,
      remainingTime: remaining,
      timeMode: this.timeMode,
    };
  }

  getPlayers(): PlayerState[] {
    return this.players;
  }

  getPlayer(playerId: string): PlayerState | undefined {
    return this.players.find((p) => p.id === playerId);
  }

  isFinished(): boolean {
    return this.finished;
  }

  getTimeMode(): number {
    return this.timeMode;
  }

  // ─── Private ────────────────────────────────────────────

  private getRemainingTime(): number {
    if (!this.startedAt) return this.timeMode;
    const elapsed = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
    return Math.max(0, this.timeMode - elapsed);
  }

  private clearTimers(): void {
    if (this.coinLevelInterval) {
      clearInterval(this.coinLevelInterval);
      this.coinLevelInterval = null;
    }
    if (this.gameTimerTimeout) {
      clearTimeout(this.gameTimerTimeout);
      this.gameTimerTimeout = null;
    }
  }

  /**
   * Проверяет, является ли ход валидным ходом коня.
   * Конь ходит буквой "Г": (dx=1, dy=2) или (dx=2, dy=1).
   */
  private isValidKnightMove(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): boolean {
    // Проверяем границы доски
    if (toX < 0 || toX >= this.boardWidth) return false;
    if (toY < 0 || toY >= this.boardHeight) return false;

    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);

    return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  }

  /**
   * Генерирует случайные монетки на свободных клетках.
   * Логика вероятностей полностью совпадает с фронтендом (board.ts).
   */
  private spawnCoins(count: number): void {
    for (let i = 0; i < count; i++) {
      const cell = this.getRandomEmptyCell();
      if (!cell) break;

      const nominal = this.getRandomNominal();
      this.coins.push({ x: cell.x, y: cell.y, nominal });
    }
  }

  /**
   * Находит случайную свободную клетку (без фигуры и без монетки).
   */
  private getRandomEmptyCell(): { x: number; y: number } | null {
    const occupied = new Set<string>();

    // Клетки с игроками
    for (const p of this.players) {
      occupied.add(`${p.x},${p.y}`);
    }

    // Клетки с монетками
    for (const c of this.coins) {
      occupied.add(`${c.x},${c.y}`);
    }

    const emptyCells: { x: number; y: number }[] = [];

    for (let y = 0; y < this.boardHeight; y++) {
      for (let x = 0; x < this.boardWidth; x++) {
        if (!occupied.has(`${x},${y}`)) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randomIndex];
  }

  /**
   * Определяет номинал монетки в зависимости от текущего coinLevel.
   * Логика 1:1 совпадает с фронтендом (board.ts, getRandomNominal).
   */
  private getRandomNominal(): CoinNominal {
    const random = Math.random() * 100;

    if (this.coinLevel >= 5) {
      if (random < 40) return CoinNominal.COIN250;
      if (random < 75) return CoinNominal.COIN300;
      return CoinNominal.COIN350;
    }

    if (this.coinLevel >= 4) {
      if (random < 15) return CoinNominal.COIN150;
      if (random < 35) return CoinNominal.COIN200;
      if (random < 60) return CoinNominal.COIN250;
      if (random < 85) return CoinNominal.COIN300;
      return CoinNominal.COIN350;
    }

    if (this.coinLevel >= 3) {
      if (random < 25) return CoinNominal.COIN150;
      if (random < 45) return CoinNominal.COIN200;
      if (random < 70) return CoinNominal.COIN250;
      if (random < 90) return CoinNominal.COIN300;
      return CoinNominal.COIN350;
    }

    if (this.coinLevel >= 2) {
      if (random < 40) return CoinNominal.COIN150;
      if (random < 65) return CoinNominal.COIN200;
      if (random < 85) return CoinNominal.COIN250;
      return CoinNominal.COIN300;
    }

    // coinLevel 1
    if (random < 60) return CoinNominal.COIN150;
    if (random < 85) return CoinNominal.COIN200;
    return CoinNominal.COIN250;
  }
}
