import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "src/auth/auth.module";
import { SoloGame, SoloGameSchema } from "./schemas/solo-game.schema";
import { SoloGameSocketService } from "./socket/socket.service";
import { SoloGameController } from "./solo-game.controller";
import { SoloGameService } from "./solo-game.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SoloGame.name, schema: SoloGameSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [SoloGameController],
  providers: [SoloGameService, SoloGameSocketService],
  exports: [SoloGameService, SoloGameSocketService],
})
export class SoloGameModule {}
