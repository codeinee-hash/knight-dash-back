import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Delete,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import {
  CreateMultiplayerGameDto,
  JoinMultiplayerGameDto,
  RequestWithUser,
} from "./dto/multiplayer-game.dto";
import { MultiplayerGameService } from "./multiplayer-game.service";

@ApiTags("Multiplayer Game")
@Controller("api/v1/multiplayer-game")
export class MultiplayerGameController {
  constructor(private gameService: MultiplayerGameService) {}

  /**
   * Создает новую мультиплеерную комнату.
   * Возвращает roomCode, который нужно передать второму игроку.
   */
  @UseGuards(JwtAuthGuard)
  @Post("create")
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateMultiplayerGameDto,
  ) {
    return this.gameService.createRoom(req.user._id, dto.timeMode);
  }

  /**
   * Присоединяет второго игрока к комнате по roomCode.
   */
  @UseGuards(JwtAuthGuard)
  @Post("join")
  async join(@Req() req: RequestWithUser, @Body() dto: JoinMultiplayerGameDto) {
    return this.gameService.joinRoom(req.user._id, dto.roomCode);
  }

  /**
   * Получает информацию о комнате по roomCode.
   */
  @UseGuards(JwtAuthGuard)
  @Get("room/:roomCode")
  async getRoomByCode(@Param("roomCode") roomCode: string) {
    return this.gameService.getRoomByCode(roomCode);
  }

  /**
   * Получает информацию о комнате по ID.
   */
  @UseGuards(JwtAuthGuard)
  @Get(":gameId")
  async getRoomById(@Param("gameId") gameId: string) {
    return this.gameService.getRoomById(gameId);
  }

  /**
   * Отменяет (удаляет) игру, если она еще не начата
   */
  @UseGuards(JwtAuthGuard)
  @Delete("cancel/:gameId")
  async cancelGame(@Req() req: RequestWithUser, @Param("gameId") gameId: string) {
    return this.gameService.cancelGame(req.user._id, gameId);
  }
}
