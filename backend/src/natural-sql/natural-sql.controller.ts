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
        let correctTime= '';

        if (executionTime < 1000) {
            correctTime = `${executionTime} executionTime`;
        } else if (executionTime < 60 * 1000) {
            correctTime = `${(executionTime / 1000).toFixed(2)} s`;
        } else if (executionTime < 60 * 60 * 1000) {
            correctTime = `${(executionTime / (1000 * 60)).toFixed(2)} min`;
        } else {
            correctTime = `${(executionTime / (1000 * 60 * 60)).toFixed(2)} h`;
        }

        return {
            pregunta: request.pregunta,
            sqlGenerada: result.sqlQuery,
            explicacion: result.explanation,
            resultados: result.results,
            cantidadResultados: result.results.length,
            tiempoEjecucion: correctTime,
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