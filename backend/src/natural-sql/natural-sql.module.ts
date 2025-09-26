import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NaturalSQLController } from './natural-sql.controller';
import { NaturalSQLService } from './natural-sql.service';
import { SchemaService } from '../database/schema.service';
import { LlmModule } from '../llm/llm.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([]),
        LlmModule,
    ],
    controllers: [NaturalSQLController],
    providers: [NaturalSQLService, SchemaService],
    exports: [NaturalSQLService],
})
export class NaturalSQLModule {}