import { HttpModule } from "@nestjs/axios";
import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PlayerModule } from "src/players/player.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokensService } from "./token.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokensService],
  imports: [
    forwardRef(() => PlayerModule),
    JwtModule.register({
      secret: process.env.PRIVATE_KEY || "SECRET",
      signOptions: { expiresIn: "7d" },
    }),
    HttpModule,
  ],
  exports: [AuthService, JwtModule, TokensService],
})
export class AuthModule {}
