import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('qa_embeddings')
export class Pregunta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column('text')
  pregunta: string;

  @Column('text')
  respuesta: string;

  @Column('text', { nullable: true })
  contexto: string;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @Column('real', { array: true, nullable: true })
  embedding: number[];

  @Column('real', { default: 0.8 })
  similitudMinima: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}