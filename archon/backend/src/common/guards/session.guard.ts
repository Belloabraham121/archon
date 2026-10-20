import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../auth/auth';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { TenancyService } from '../../tenancy/tenancy.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global deny-by-default guard.
 * Accepts a Better Auth session cookie OR an `x-api-key` header.
 * When `x-organization-id` is present, the caller must belong to that org
 * (session users) or the key must be scoped to it (API keys).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
    private readonly tenancy: TenancyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const rawKey: string | undefined = req.headers['x-api-key'];
    const orgId: string | undefined = req.headers['x-organization-id'];
    const requestedEnvironment = req.headers['x-environment'] === 'live' ? 'live' : 'test';

    if (rawKey) {
      const record = await this.apiKeys.validate(rawKey);
      if (!record) throw new UnauthorizedException('Invalid or revoked API key');
      if (orgId && record.organizationId && record.organizationId !== orgId) {
        throw new ForbiddenException('API key is not scoped to this organization');
      }
      if (record.environment !== requestedEnvironment) {
        throw new ForbiddenException('API key is not scoped to this environment');
      }
      req.apiKey = { id: record.id, organizationId: record.organizationId };
      req.tenantId = record.organizationId ?? orgId ?? null;
      req.user = { id: record.userId };
      req.environment = record.environment;
      return true;
    }

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) throw new UnauthorizedException('Missing or expired session');
    if (orgId) {
      const member = await this.tenancy.isMember(session.user.id, orgId);
      if (!member) throw new ForbiddenException('Not a member of this organization');
    }
    req.session = session.session;
    req.user = session.user;
    req.tenantId = orgId ?? null;
    req.environment = requestedEnvironment;
    return true;
  }
}
