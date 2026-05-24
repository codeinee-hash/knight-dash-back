import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { ValidationPipe } from "src/pipes/validation.pipe";
import { CreatePlayerDto, LoginPlayerDto } from "src/players/dto/player.dto";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("api/v1")
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: "Login" })
  @Post("/auth/sign-in")
  async login(
    @Body() playerDto: LoginPlayerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(playerDto, res);
  }

  @ApiOperation({ summary: "Register" })
  @UsePipes(ValidationPipe)
  @ApiResponse({ status: 200, description: "Player created" })
  @Post("/auth/sign-up")
  async registration(
    @Body() playerDto: CreatePlayerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.registration(playerDto, res);
  }

  @ApiOperation({ summary: "Refresh token" })
  @UseGuards(JwtAuthGuard)
  @Post("/auth/refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refreshToken(req, res);
  }

  @ApiOperation({ summary: "Logout" })
  @Post("/auth/logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }
}
