import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { GetTopPlayersSuccessResponseDto } from "./dto/player.dto";
import { PlayerService } from "./player.service";

@ApiTags("Players")
@Controller("api/v1")
export class PlayerController {
  constructor(private playerService: PlayerService) {}

  @ApiOperation({ summary: "Get all players" })
  @ApiResponse({ status: 200, description: "All players" })
  @UseGuards(JwtAuthGuard)
  @Get("/players")
  getAll() {
    return this.playerService.getAllPlayers();
  }

  @ApiOperation({ summary: "Get top players" })
  @ApiResponse({
    status: 200,
    description: "Топ игроков успешно получен",
    type: GetTopPlayersSuccessResponseDto,
  })
  @Get("/top-players")
  async getTopPlayers() {
    return this.playerService.getTopPlayers();
  }

  @ApiOperation({ summary: "Get top multiplayer players" })
  @ApiResponse({
    status: 200,
    description: "Топ игроков мультиплеера успешно получен",
  })
  @Get("/top-multiplayer-players")
  async getTopMultiplayerPlayers() {
    return this.playerService.getTopMultiplayerPlayers();
  }
}
