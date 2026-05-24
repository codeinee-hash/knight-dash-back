import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsMongoId,
  IsNumber,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class CreatePlayerDto {
  @ApiProperty({ example: "RenamedUser", description: "Nick name" })
  @IsString({ message: "Должно быть строкой" })
  readonly login!: string;

  @ApiProperty({ example: "example@mail.ru", description: "Email" })
  @IsEmail({}, { message: "Некорректный email" })
  readonly email!: string;

  @ApiProperty({ example: "******", description: "Password" })
  @IsString({ message: "Должно быть строкой" })
  @MinLength(6, { message: "Минимальная длина пароля 6 символов" })
  readonly password!: string;
}

export class LoginPlayerDto {
  @ApiProperty({
    example: "RenamedUser | example@mail.ru",
    description: "Login or Email",
  })
  @IsString({ message: "Должно быть строкой" })
  readonly loginOrEmail!: string;

  @ApiProperty({ example: "******", description: "Password" })
  @IsString({ message: "Должно быть строкой" })
  @MinLength(6, { message: "Минимальная длина пароля 6 символов" })
  readonly password!: string;
}

export class UpdateScoreDto {
  @ApiProperty({ example: "6650b0c8123abc...", description: "ID игрока" })
  @IsMongoId()
  readonly id!: string;

  @ApiProperty({ example: 2200, description: "Очки игрока" })
  @IsNumber()
  readonly score!: number;
}

export class TopPlayerDto {
  @ApiProperty({
    example: "682a5b0c5498de8f2335788c",
    description: "Уникальный идентификатор игрока",
  })
  _id!: string;

  @ApiProperty({
    example: "Grizzzly",
    description: "Логин игрока",
  })
  login!: string;

  @ApiProperty({
    example: "+996220001120",
    description: "Телефон игрока",
  })
  @ApiProperty({
    example: 1000,
    description: "Максимальный счёт игрока в данном режиме",
  })
  totalScore!: number;

  @ApiProperty({
    example: 15,
    description: "Режим игры (15, 30 или 60 секунд)",
  })
  timeMode!: number;
}

export class TopPlayersByModeDto {
  @ApiProperty({
    example: 15,
    description: "Режим игры (15, 30 или 60 секунд)",
  })
  timeMode!: number;

  @ApiProperty({
    type: () => [TopPlayerDto],
    description: "Список топ-10 игроков для данного режима",
  })
  players!: TopPlayerDto[];
}

export class GetTopPlayersSuccessResponseDto {
  @ApiProperty({
    example: "success",
    description: "Статус ответа",
  })
  status!: "success";

  @ApiProperty({
    type: () => [TopPlayersByModeDto],
    description: "Список топов игроков по режимам",
  })
  data!: TopPlayersByModeDto[];
}
