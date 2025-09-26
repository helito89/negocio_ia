import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreguntasController } from './preguntas.controller';
import { PreguntasService } from './preguntas.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { LlmModule } from '../llm/llm.module';
import {Pregunta} from "./preguntas.entity";

@Module({
    imports: [
        TypeOrmModule.forFeature([Pregunta]),
        EmbeddingsModule,
        LlmModule,
    ],
    controllers: [PreguntasController],
    providers: [PreguntasService],
    exports: [PreguntasService],
})
export class PreguntasModule {}