import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { LlmService } from '../llm/llm.service';
import { PreguntasService } from './preguntas.service';
import { Tenant } from '../common/decorators/tenant.decorator';
import {IsOptional} from "class-validator";

class PreguntaDto {
    @IsOptional()
    pregunta: string;
    @IsOptional()
    contexto?: string;
    @IsOptional()
    historial?: Array<{role: string, content: string}>;
    @IsOptional()
    metadata?: any;
    @IsOptional()
    guardarEnHistorial?: boolean;
}

class ActualizarPreguntaDto {
    respuesta?: string;
    contexto?: string;
    metadata?: any;
}

@Controller('preguntas')
// @UseGuards(AuthGuard(['jwt', 'api-key']))
export class PreguntasController {
    constructor(
        private readonly embeddingsService: EmbeddingsService,
        private readonly llmService: LlmService,
        private readonly preguntasService: PreguntasService,
    ) {}

    @Post()
    async procesarPregunta(
        @Body() preguntaDto: PreguntaDto,
        // @Tenant() tenantId: string,
        // @Request() req,
    ) {
        const tenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        const username = 'usuario_a'
        console.log(`Procesando pregunta para tenant: ${tenantId}`);
        // console.log(`Usuario: ${req.user.username}`);

        // Buscar preguntas similares en el historial
        const preguntasSimilares = await this.preguntasService.buscarSimilares(
            tenantId,
            preguntaDto.pregunta
        );

        // Construir contexto enriquecido
        const contextoEnriquecido = this.construirContexto(
            preguntaDto.contexto,
            preguntasSimilares
        );

        // Generar respuesta
        let respuesta: string;
        if (preguntaDto.historial) {
            respuesta = await this.llmService.generateResponseWithHistory(
                preguntaDto.pregunta,
                preguntaDto.historial
            );
        } else {
            respuesta = await this.llmService.generateResponse(
                preguntaDto.pregunta,
                contextoEnriquecido
            );
        }

        // Guardar en base de datos si se solicita
        let preguntaGuardada = null;
        if (preguntaDto.guardarEnHistorial !== false) {
            preguntaGuardada = await this.preguntasService.guardarPreguntaRespuesta(
                tenantId,
                preguntaDto.pregunta,
                respuesta,
                preguntaDto.contexto,
                {
                    usuario: username,
                    preguntasSimilaresEncontradas: preguntasSimilares.length,
                    metadata: preguntaDto.metadata,
                }
            );
        }

        return {
            tenantId,
            pregunta: preguntaDto.pregunta,
            respuesta,
            contextoUtilizado: contextoEnriquecido,
            preguntasSimilaresEncontradas: preguntasSimilares.length,
            id: preguntaGuardada?.id,
            timestamp: new Date().toISOString(),
        };
    }

    @Get()
    async obtenerHistorial(
        @Tenant() tenantId: string,
        @Query('pagina') pagina: number = 1,
        @Query('limite') limite: number = 10,
    ) {
        return await this.preguntasService.obtenerHistorialPorTenant(
            tenantId,
            pagina,
            limite
        );
    }

    @Get('estadisticas')
    async obtenerEstadisticas(@Tenant() tenantId: string) {
        return await this.preguntasService.obtenerEstadisticasPorTenant(tenantId);
    }

    @Get('similares')
    async buscarPreguntasSimilares(
        @Tenant() tenantId: string,
        @Query('pregunta') pregunta: string,
        @Query('limite') limite: number = 5,
    ) {
        return await this.preguntasService.buscarSimilares(
            tenantId,
            pregunta,
            limite
        );
    }

    @Get(':id')
    async obtenerPregunta(@Param('id') id: string) {
        return await this.preguntasService.obtenerPreguntaPorId(id);
    }

    @Put(':id')
    async actualizarPregunta(
        @Param('id') id: string,
        @Body() actualizarDto: ActualizarPreguntaDto,
    ) {
        return await this.preguntasService.actualizarPregunta(id, actualizarDto);
    }

    @Delete(':id')
    async eliminarPregunta(@Param('id') id: string) {
        await this.preguntasService.eliminarPregunta(id);
        return { message: 'Pregunta eliminada correctamente' };
    }

    private construirContexto(contextoUsuario: string, preguntasSimilares: any[]): string {
        let contexto = contextoUsuario || '';

        if (preguntasSimilares.length > 0) {
            contexto += '\n\nPreguntas y respuestas similares del historial:\n';
            preguntasSimilares.forEach((p, index) => {
                contexto += `${index + 1}. P: ${p.pregunta}\nR: ${p.respuesta}\n\n`;
            });
        }

        return contexto.trim();
    }
}