import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import {Pregunta} from "./preguntas.entity";

@Injectable()
export class PreguntasService {
  constructor(
    @InjectRepository(Pregunta)
    private readonly preguntaRepository: Repository<Pregunta>,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async guardarPreguntaRespuesta(
    tenantId: string,
    pregunta: string,
    respuesta: string,
    contexto?: string,
    metadata?: any,
  ): Promise<Pregunta> {
    // Generar embedding para la pregunta
    const embedding = await this.embeddingsService.generateEmbedding(pregunta);

    const nuevaPregunta = this.preguntaRepository.create({
      tenantId,
      pregunta,
      respuesta,
      contexto,
      metadata,
      embedding,
      similitudMinima: 0.8,
    });

    return await this.preguntaRepository.save(nuevaPregunta);
  }

  async buscarSimilares(
    tenantId: string,
    pregunta: string,
    limite: number = 5,
    similitudMinima: number = 0.7,
  ): Promise<Pregunta[]> {
    const embedding = await this.embeddingsService.generateEmbedding(pregunta);

    // Buscar preguntas similares usando cosine similarity
    const preguntas = await this.preguntaRepository
      .createQueryBuilder('pregunta')
      .where('pregunta.tenantId = :tenantId', { tenantId })
      .andWhere('pregunta.embedding IS NOT NULL')
      .orderBy(
        `SIMILARITY(pregunta.embedding::text, :embedding)`,
        'DESC'
      )
      .setParameter('embedding', embedding)
      .limit(limite)
      .getMany();

    // Filtrar por similitud mínima
    return preguntas.filter(p => {
      if (!p.embedding) return false;
      const similitud = this.embeddingsService.cosineSimilarity(embedding, p.embedding);
      return similitud >= similitudMinima;
    });
  }

  async obtenerHistorialPorTenant(
    tenantId: string,
    pagina: number = 1,
    limite: number = 10,
  ): Promise<{ data: Pregunta[]; total: number }> {
    const [data, total] = await this.preguntaRepository.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return { data, total };
  }

  async obtenerPreguntaPorId(id: string): Promise<Pregunta> {
    return await this.preguntaRepository.findOne({ where: { id } });
  }

  async actualizarPregunta(
    id: string,
    updates: Partial<Pregunta>,
  ): Promise<Pregunta> {
    await this.preguntaRepository.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
    return await this.obtenerPreguntaPorId(id);
  }

  async eliminarPregunta(id: string): Promise<void> {
    await this.preguntaRepository.delete(id);
  }

  async obtenerEstadisticasPorTenant(tenantId: string): Promise<any> {
    const total = await this.preguntaRepository.count({ where: { tenantId } });
    
    const ultimoMes = new Date();
    ultimoMes.setMonth(ultimoMes.getMonth() - 1);
    
    const ultimoMesCount = await this.preguntaRepository
      .createQueryBuilder('pregunta')
      .where('pregunta.tenantId = :tenantId', { tenantId })
      .andWhere('pregunta.createdAt >= :ultimoMes', { ultimoMes })
      .getCount();

    return {
      totalPreguntas: total,
      ultimoMes: ultimoMesCount,
      promedioDiario: total / 30, // Aproximado
    };
  }
}