import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { LlmModule } from './llm/llm.module';
import { PreguntasModule } from './preguntas/preguntas.module';
import {Pregunta} from "./preguntas/preguntas.entity";
import {NaturalSQLModule} from "./natural-sql/natural-sql.module";
import {DatabaseModule} from "./database/database.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: 'localhost',
                port: 5432,
                username: 'postgres',
                password: '',
                database: 'rubyledger_development',
                entities: [Pregunta],
                autoLoadEntities: true,
                synchronize: true,
                logging: true,
            }),
            inject: [ConfigService],
        }),
        AuthModule,
        EmbeddingsModule,
        LlmModule,
        PreguntasModule,
        NaturalSQLModule,
        DatabaseModule,
    ],
})
export class AppModule {}