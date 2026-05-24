import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { ProfileService } from "./profile.service";
import { RequestWithUser, UpdateLoginDto } from "./dto/profile.dto";

const uploadsDir = join(process.cwd(), "uploads", "avatars");
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

@ApiTags("Profile")
@Controller("api/v1/profile")
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(@Req() req: RequestWithUser) {
    return this.profileService.getProfile(req.user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  async updateLogin(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.profileService.updateLogin(req.user._id, dto.login, res);
  }

  @UseGuards(JwtAuthGuard)
  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new Error("Разрешены только изображения (jpg, png, gif, webp)"), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.profileService.updateAvatar(req.user._id, file, res);
  }
}
