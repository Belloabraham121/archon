import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Organizations the user belongs to (for the org switcher). */
  async organizationsForUser(userId: string) {
    const memberships = await this.prisma.member.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }));
  }

  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const member = await this.prisma.member.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    return member !== null;
  }
}
