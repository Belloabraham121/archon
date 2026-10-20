import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';

@Module({ imports: [PrismaModule], controllers: [DecisionsController], providers: [DecisionsService] })
export class DecisionsModule {}
