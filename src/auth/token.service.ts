import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CookieOptions, Response } from "express";

export enum TokenType {
  ACCESS = "access_token",
  REFRESH = "refresh_token",
}

@Injectable()
export class TokensService {
  constructor(private jwtService: JwtService) {}

  generateTokens(payload: { _id: string; login: string; email: string; avatarUrl?: string | null }) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: "2h",
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: "1d",
    });

    return { accessToken, refreshToken };
  }

  setRefreshTokenCookie(res: Response, tokenType: TokenType, token: string) {
    const maxAge = tokenType === TokenType.ACCESS 
		? 2 * 60 * 60 * 1000 
		: 1 * 24 * 60 * 60 * 1000;

    res.cookie(tokenType, token, {
      httpOnly: tokenType === TokenType.REFRESH,
      secure: true,
      sameSite: "none",
      maxAge,
    });
  }

  validateRefreshToken(token: string): any {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (e) {
      throw new UnauthorizedException("Invalid token");
    }
  }

  removeTokens(res: Response) {
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    res.clearCookie(TokenType.REFRESH, cookieOptions);
    res.clearCookie(TokenType.ACCESS, cookieOptions);
  }
}
