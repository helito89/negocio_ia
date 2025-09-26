import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchemaService } from './schema.service';

@Module({
    imports: [TypeOrmModule.forFeature([])],
    providers: [SchemaService],
    exports: [SchemaService],
})
export class DatabaseModule {}