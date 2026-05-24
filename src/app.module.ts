import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module";
import { GameEngineModule } from "./game-engine/game-engine.module";
import { MultiplayerGameModule } from "./multiplayer-game/multiplayer-game.module";
import { PlayerModule } from "./players/player.module";
import { SoloGameModule } from "./solo-game/solo-game.module";
import { ProfileModule } from "./profile/profile.module";

@Module({
  controllers: [],
  providers: [],
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".env",
    }),
    MongooseModule.forRoot(process.env.DATABASE_URL || ""),
    GameEngineModule,
    PlayerModule,
    AuthModule,
    SoloGameModule,
    MultiplayerGameModule,
    ProfileModule,
  ],
})
export class AppModule {}
