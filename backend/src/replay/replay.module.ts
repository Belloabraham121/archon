import { Module } from '@nestjs/common';
import { ReplaysController } from './replays.controller';
import { ReplaysService } from './replays.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReplaysController],
  providers: [ReplaysService],
  exports: [ReplaysService],
})
export class ReplayModule {}
