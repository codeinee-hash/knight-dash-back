import { HttpException, HttpStatus } from "@nestjs/common";

export class ValidationExeption extends HttpException {
  constructor(public validationErrors: string[]) {
    super(
      {
        message: "Validation failed",
        errors: validationErrors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
