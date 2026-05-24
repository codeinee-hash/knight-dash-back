import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "src/auth/auth.module";
import { PlayerModule } from "src/players/player.module";
import {
  MultiplayerGame,
  MultiplayerGameSchema,
} from "src/multiplayer-game/schemas/multiplayer-game.schema";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MultiplayerGame.name, schema: MultiplayerGameSchema },
    ]),
    PlayerModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
