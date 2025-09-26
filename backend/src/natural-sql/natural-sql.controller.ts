import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NaturalSQLService } from './natural-sql.service';
import { SchemaService } from '../database/schema.service';
import {IsOptional} from "class-validator";

class NaturalQueryRequest {
    @IsOptional()
    pregunta: string;
}

@Controller('natural-sql')
@UseGuards(AuthGuard(['jwt', 'api-key']))
export class NaturalSQLController {
    constructor(
        private readonly naturalSQLService: NaturalSQLService,
        private readonly schemaService: SchemaService,
    ) {}

    @Post('query')
    async processNaturalQuery(@Body() request: NaturalQueryRequest) {
        const startTime = Date.now();

        const result = await this.naturalSQLService.processNaturalQuery(request.pregunta);

        const executionTime = Date.now() - startTime;

        return {
            pregunta: request.pregunta,
            sqlGenerada: result.sqlQuery,
            explicacion: result.explanation,
            resultados: result.results,
            cantidadResultados: result.results.length,
            tiempoEjecucion: `${executionTime}ms`,
            error: result.error,
            timestamp: new Date().toISOString(),
        };
    }

    @Get('schema-summary')
    async getSchemaSummary() {
        const summary = await this.naturalSQLService.getSchemaSummary();
        return { summary };
    }

    @Get('tables')
    async getAvailableTables() {
        const schema = await this.schemaService.getDatabaseSchema();
        return schema.map(table => ({
            nombre: table.tableName,
            columnas: table.columns.map(col => ({
                nombre: col.columnName,
                tipo: col.dataType,
                esPrimaria: col.isPrimary,
                esForanea: !!col.foreignKey,
            })),
            totalColumnas: table.columns.length,
        }));
    }
}