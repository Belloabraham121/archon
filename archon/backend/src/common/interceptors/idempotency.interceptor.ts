import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, from, mergeMap, of } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method ?? 'GET').toUpperCase();
    const requestPath = String(req.originalUrl ?? req.url).split('?')[0];
    if (['GET', 'HEAD', 'OPTIONS'].includes(method) || requestPath.startsWith('/api/auth/') || (method === 'POST' && requestPath === '/v1/intents')) {
      return next.handle();
    }
    const organizationId = req.tenantId as string | null;
    if (!organizationId) return next.handle();
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !key.trim()) throw new BadRequestException('Idempotency-Key is required');
    const environment = req.environment ?? 'test';
    const path = requestPath;
    const where = { organizationId_environment_method_path_key: { organizationId, environment, method, path, key } };
    const existing = await this.prisma.idempotencyRecord.findUnique({ where });
    if (existing) return of(existing.response);

    return next.handle().pipe(mergeMap((response) => from((async () => {
      try {
        await this.prisma.idempotencyRecord.create({
          data: { organizationId, environment, method, path, key, response: response as Prisma.InputJsonValue },
        });
        return response;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const replay = await this.prisma.idempotencyRecord.findUnique({ where });
          if (replay) return replay.response;
        }
        throw error;
      }
    })())));
  }
}
