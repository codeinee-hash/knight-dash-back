import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "src/auth/auth.module";
import {
  SoloGame,
  SoloGameSchema,
} from "src/solo-game/schemas/solo-game.schema";
import {
  MultiplayerGame,
  MultiplayerGameSchema,
} from "src/multiplayer-game/schemas/multiplayer-game.schema";
import { PlayerController } from "./player.controller";
import { PlayerService } from "./player.service";
import { Player, PlayerSchema } from "./schemas/player.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Player.name, schema: PlayerSchema }]),
    MongooseModule.forFeature([
      { name: SoloGame.name, schema: SoloGameSchema },
      { name: MultiplayerGame.name, schema: MultiplayerGameSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
