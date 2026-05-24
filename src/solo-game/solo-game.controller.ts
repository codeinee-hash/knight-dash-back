import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { CreateSoloGameDto, RequestWithUser } from "./dto/solo-game.dto";
import { SoloGameService } from "./solo-game.service";

@ApiTags("Solo Game")
@Controller("api/v1/solo-game")
export class SoloGameController {
  constructor(private gameService: SoloGameService) {}

  @UseGuards(JwtAuthGuard)
  @Post("create")
  async create(@Req() req: RequestWithUser, @Body() dto: CreateSoloGameDto) {
    const playerId = req.user._id;

    return this.gameService.createGameSession({
      timeMode: dto.timeMode,
      playerId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(":gameId/status")
  async getStatus(@Param("gameId") gameId: string) {
    return this.gameService.getGameStatus(gameId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":gameId/info")
  async getGameInfo(@Param("gameId") gameId: string) {
    return this.gameService.getGameInfo(gameId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":gameId/end")
  async endGame(@Param("gameId") gameId: string) {
    return this.gameService.endGameSession(gameId);
  }

  // @UseGuards(JwtAuthGuard)
  // @Post(':gameId/submit-score')
  // async submitScore(
  // 	@Param('gameId') gameId: string,
  // 	@Body() body: { score: number }
  // ) {
  // 	return this.gameService.submitScore({
  // 		score: body.score,
  // 		gameId,
  // 	})
  // }

  @UseGuards(JwtAuthGuard)
  @Delete(":gameId")
  async deleteGame(
    @Param("gameId") gameId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.gameService.deleteGame(gameId, req.user._id);
  }
}
