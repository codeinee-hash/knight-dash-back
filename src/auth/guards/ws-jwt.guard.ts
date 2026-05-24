import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new WsException("Токен не передан");
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;

      return true;
    } catch (error) {
      throw new WsException("Не авторизован");
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return authToken;
    }

    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader) {
      const [bearer, token] = authHeader.split(" ");
      if (bearer === "Bearer" && token) {
        return token;
      }
    }

    return null;
  }
}
