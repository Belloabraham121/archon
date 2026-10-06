import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('api/auth')
export class AuthController {
  @All('*')
  async passthrough(@Req() req: Request, @Res() res: Response) {
    const handler = toNodeHandler(auth);
    return handler(req, res);
  }
}
