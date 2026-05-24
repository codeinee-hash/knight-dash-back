import { Global, Module } from "@nestjs/common";
import { GameRoomManager } from "./game-room-manager";

@Global()
@Module({
  providers: [GameRoomManager],
  exports: [GameRoomManager],
})
export class GameEngineModule {}
