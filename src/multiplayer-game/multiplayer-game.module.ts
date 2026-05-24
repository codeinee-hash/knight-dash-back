import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "src/auth/auth.module";
import {
  MultiplayerGame,
  MultiplayerGameSchema,
} from "./schemas/multiplayer-game.schema";
import { MultiplayerGameController } from "./multiplayer-game.controller";
import { MultiplayerGameService } from "./multiplayer-game.service";
import { MultiplayerSocketService } from "./socket/socket.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MultiplayerGame.name, schema: MultiplayerGameSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [MultiplayerGameController],
  providers: [MultiplayerGameService, MultiplayerSocketService],
  exports: [MultiplayerGameService, MultiplayerSocketService],
})
export class MultiplayerGameModule {}
