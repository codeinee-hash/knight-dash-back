import { HttpService } from "@nestjs/axios";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { CreatePlayerDto, LoginPlayerDto } from "src/players/dto/player.dto";
import { PlayerService } from "src/players/player.service";
import { TokensService, TokenType } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    private playerService: PlayerService,
    private tokensService: TokensService,
    private readonly httpService: HttpService,
  ) {}

  async login(playerDto: LoginPlayerDto, res: Response) {
    const player = await this.validatePlayer(playerDto);
    const { accessToken, refreshToken } = this.tokensService.generateTokens({
      _id: player?._id?.toString(),
      login: player.login,
      email: player.email,
      avatarUrl: player.avatarUrl,
    });

    this.tokensService.setRefreshTokenCookie(
      res,
      TokenType.REFRESH,
      refreshToken,
    );
    this.tokensService.setRefreshTokenCookie(
      res,
      TokenType.ACCESS,
      accessToken,
    );

    return {
      status: "success",
      message: "Успешный вход",
    };
  }

  async registration(playerDto: CreatePlayerDto, res: Response) {
    const candidateByLogin = await this.playerService.getPlayerByLogin(
      playerDto.login,
    );
    if (candidateByLogin) {
      throw new HttpException("Логин уже занят", HttpStatus.BAD_REQUEST);
    }

    const candidateByEmail = await this.playerService.getPlayerByEmail(
      playerDto.email,
    );
    if (candidateByEmail) {
      throw new HttpException("Email уже занят", HttpStatus.BAD_REQUEST);
    }

    const hashPassword = await bcrypt.hash(playerDto.password, 10);

    const player = await this.playerService.createPlayer({
      ...playerDto,
      password: hashPassword,
    });

    const { accessToken, refreshToken } = this.tokensService.generateTokens({
      _id: String(player.player?._id),
      login: player.player.login,
      email: player.player.email,
      avatarUrl: player.player.avatarUrl,
    });

    this.tokensService.setRefreshTokenCookie(
      res,
      TokenType.REFRESH,
      refreshToken,
    );
    this.tokensService.setRefreshTokenCookie(
      res,
      TokenType.ACCESS,
      accessToken,
    );

    try {
      // const bitrixRes$ = this.httpService.post(
      // 	`${process.env.BITRIX_URL}/rest/1/${process.env.BITRIX_API_KEY}/crm.lead.add.json`,
      // 	new URLSearchParams({
      // 		'fields[SOURCE_ID]': '127',
      // 		'fields[NAME]': playerDto.login,
      // 		'fields[TITLE]': 'GEEKS GAME: Хакатон 2025',
      // 		'fields[PHONE][0][VALUE]': playerDto.telephone,
      // 		'fields[PHONE][0][VALUE_TYPE]': 'WORK',
      // 	}),
      // 	{
      // 		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // 		timeout: 10000,
      // 	}
      // )

      // const bitrixResponse = await firstValueFrom(bitrixRes$)
      // const bitrixData = bitrixResponse.data

      return {
        status: "success",
        message: "Пользователь успешно зарегистрирован",
        // bitrixData,
      };
    } catch (error) {
      return {
        status: "success",
        message: "Пользователь успешно зарегистрирован (Bitrix API error)",
      };
    }
  }

  async logout(res: Response) {
    this.tokensService.removeTokens(res);

    return {
      status: "success",
      message: "Logout successful",
    };
  }

  async refreshToken(req: Request, res: Response) {
    const refreshTokenCookie = req.cookies?.refresh_token;
    if (!refreshTokenCookie) {
      throw new HttpException("Нет токена", HttpStatus.UNAUTHORIZED);
    }

    const payload = this.tokensService.validateRefreshToken(refreshTokenCookie);
    const player = await this.playerService.getPlayerByEmail(payload.email);

    if (!player) {
      throw new HttpException("Игрок не найден", HttpStatus.UNAUTHORIZED);
    }

    const { accessToken, refreshToken } = this.tokensService.generateTokens({
      _id: player?.id?.toString(),
      login: player.login,
      email: player.email,
      avatarUrl: player.avatarUrl,
    });

    this.tokensService.setRefreshTokenCookie(
      res,
      TokenType.REFRESH,
      refreshToken,
    );
    this.tokensService.setRefreshTokenCookie(
      res,
      TokenType.ACCESS,
      accessToken,
    );

    return {
      status: "success",
      message: "Токен обновлен",
    };
  }

  private async validatePlayer(playerDto: LoginPlayerDto) {
    const player = await this.playerService.getPlayerByLoginOrEmail(
      playerDto.loginOrEmail,
    );

    if (!player) {
      throw new HttpException(
        "Неверный логин или email",
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordEquals = await bcrypt.compare(
      playerDto.password,
      player.password,
    );

    if (!passwordEquals) {
      throw new HttpException("Неверный пароль", HttpStatus.BAD_REQUEST);
    }

    return player;
  }
}
