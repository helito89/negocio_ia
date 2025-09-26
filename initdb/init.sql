-- Agregar extensión de vector y pg_trgm
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabla de tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(63) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de usuarios (común para todos los tenants)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar embeddings y preguntas/respuestas
-- Tabla para almacenar preguntas y respuestas (ya existe en tu init.sql original)
-- Solo asegurarnos de que tenga todas las columnas necesarias

CREATE TABLE IF NOT EXISTS qa_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    contexto TEXT,
    metadata JSONB,
    embedding vector(1536),
    similitud_minima FLOAT DEFAULT 0.8,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsqueda por similitud
CREATE INDEX IF NOT EXISTS idx_qa_embeddings_embedding ON qa_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Índice para búsqueda por tenant
CREATE INDEX IF NOT EXISTS idx_qa_embeddings_tenant ON qa_embeddings(tenant_id);

-- Índice para fechas
CREATE INDEX IF NOT EXISTS idx_qa_embeddings_created ON qa_embeddings(created_at);

-- Insertar algunos tenants de ejemplo
INSERT INTO tenants (id, name, schema_name) VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Tenant A', 'tenant_a'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Tenant B', 'tenant_b')
ON CONFLICT (schema_name) DO NOTHING;

-- Insertar usuario de ejemplo para Tenant A
INSERT INTO users (id, tenant_id, username, email, password_hash) VALUES 
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 
     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
     'usuario_a', 
     'usuario_a@example.com', 
     '$2a$10$ExampleHash')
ON CONFLICT (username) DO NOTHING;