import {Injectable} from '@nestjs/common';
import {LlmService} from '../llm/llm.service';
import {SchemaService} from '../database/schema.service';
import {InjectConnection} from '@nestjs/typeorm';
import {Connection} from 'typeorm';

@Injectable()
export class NaturalSQLService {
    constructor(
        private readonly llmService: LlmService,
        private readonly schemaService: SchemaService,
        @InjectConnection()
        private readonly connection: Connection,
    ) {
    }

    async processNaturalQuery(naturalQuestion: string): Promise<{
        sqlQuery: string;
        explanation: string;
        results: any[];
        error?: string;
    }> {
        try {
            // 1. Obtener esquema de la base de datos
            const schema = await this.schemaService.getDatabaseSchema();

            // 2. Generar SQL a partir de la pregunta natural
            const sqlQueryRelation = await this.obtainRelationFromQuestion(naturalQuestion, schema);

            console.log(sqlQueryRelation);

            // 3. Generar SQL a partir de la pregunta natural
            const sqlQuery = await this.generateSQLFromQuestion(naturalQuestion, schema, sqlQueryRelation);

            // 4. Ejecutar la consulta
            const results = await this.executeSafeQuery(sqlQuery);

            // 5. Generar explicación en lenguaje natural
            const explanation = await this.generateExplanation(naturalQuestion, sqlQuery, results);

            return {
                sqlQuery,
                explanation,
                results: results.slice(0, 50), // Limitar resultados
            };
        } catch (error) {
            return {
                sqlQuery: '',
                explanation: '',
                results: [],
                error: error.message,
            };
        }
    }

    private async generateSQLFromQuestion(question: string, schema: any[], sqlQueryRelation: string): Promise<string> {
        const prompt = this.buildSQLGenerationPrompt(question, schema, sqlQueryRelation);

        const response = await this.llmService.generateResponse(prompt);

        // Extraer solo el SQL de la respuesta
        const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/) ||
            response.match(/SELECT[\s\S]*?(?=;|$)/i);

        if (!sqlMatch) {
            throw new Error('No se pudo generar una consulta SQL válida');
        }

        let sqlQuery = sqlMatch[1] || sqlMatch[0];

        // Validar y limpiar la consulta
        return this.validateAndCleanSQL(sqlQuery);
    }

    private async obtainRelationFromQuestion(question: string, schema: any[]): Promise<string> {
        const prompt = this.obtainRelationFromQuestionPrompt(question, schema);

        const response = await this.llmService.generateResponse(prompt);

        // Extraer solo el SQL de la respuesta
        const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/) ||
            response.match(/SELECT[\s\S]*?(?=;|$)/i);

        if (!sqlMatch) {
            throw new Error('No se pudo generar una consulta SQL válida');
        }

        let sqlQuery = sqlMatch[1] || sqlMatch[0];

        // Validar y limpiar la consulta
        return this.validateAndCleanSQL(sqlQuery);
    }

    private buildSQLGenerationPrompt(question: string, schema: any[], sqlQueryRelation: string): string {
        const schemaDescription = this.formatSchemaForPrompt(schema);

        console.log(sqlQueryRelation);

        return `
Eres un experto en PostgreSQL. Convierte la siguiente pregunta en una consulta SQL válida.

=== RELACIONES ENCONTRADAS ===
${sqlQueryRelation}

=== REGLAS IMPORTANTES ===
1. Usa únicamente consultas SELECT — nunca INSERT, UPDATE, DELETE, DROP u otras modificaciones.
2. Si la consulta puede devolver muchos resultados, incluye LIMIT 100 al final.
3. Usa los nombres de tablas y columnas exactamente como aparecen en el esquema.
4. Para trabajar con fechas, usa funciones nativas de PostgreSQL como NOW(), DATE_PART(), EXTRACT(), etc.
5. Para montos o cantidades utiliza funciones agregadas como SUM(), MAX(), MIN(), AVG(), COUNT().  
   - Si se solicita agrupación, usa GROUP BY correctamente.
6. Usa JOINs solo cuando sea necesario, basados en relaciones entre tablas.
7. Considera la nulabilidad de las columnas:
   - Si una columna es NULLABLE → agrega WHERE columna IS NOT NULL.
   - Si es NOT NULL → úsala directamente.
8. Si la pregunta pide agrupar resultados (ejemplo: por cliente, por mes, por categoría), DEBES usar GROUP BY en esa columna.
   - Incluye únicamente en el SELECT:  
     - La columna usada para agrupar.  
     - Funciones agregadas sobre otras columnas.  
   - Nunca mezcles columnas no agrupadas.
9. Todos los resultados deben mostrarse como **tabla en formato Markdown**:
   - Primera fila: encabezados de columnas.  
   - Una fila por cada registro.  
   - Números alineados a la derecha.  
   - Strings o fechas alineados a la izquierda.
10. Nunca devuelvas resultados en JSON si representan una tabla.
11. No inventes tablas ni columnas que no existan en el esquema.
12. Redondea todos los valores numéricos calculados con ROUND(valor, 2) por defecto.  
    - Si el usuario pide explícitamente otra precisión, usa ROUND(valor, N).
13. Usa nombre de alias camel_snake y SOLO en minuscula.
14. Esto usa REGR_SLOPE y REGR_INTERCEPT (regresión lineal en SQL) para proyectar.
15. Puedes usar cursores, with o cualquier otra manera de consolidar o computar la información para obtener la generación
más exacta o aproximada.
16. Evita usar comentario al generar las consultas ó si es necesario los comentarios se realizan usando

=== RESTRICCIONES CRÍTICAS ===
- Usa únicamente las columnas definidas en el esquema.  
- No inventes tablas ni columnas.  
- No uses la tabla transaccions a menos que el usuario lo pida explícitamente.  
- Aplica WHERE columna IS NOT NULL en columnas que acepten nulos.  
- Por defecto, redondea cálculos a 2 decimales con ROUND.  

=== INSTRUCCIONES DE SALIDA ===
- Devuelve SOLO la consulta SQL, formateada con saltos de línea y sangría para máxima legibilidad.  
- No expliques la consulta, solo entrégala lista para ejecutar en PostgreSQL.  

PREGUNTA EN ESPAÑOL: "${question}"
`;
    }

    private obtainRelationFromQuestionPrompt(question: string, schema: any[]): string {
        const schemaDescription = this.formatSchemaForPrompt(schema);
        let prompt = '';

        prompt = `
1. Recibe una pregunta en lenguaje natural.
2. Analiza el esquema completo de la base de datos.
3. Filtra las tablas y columnas que parecen relevantes basándote en las palabras clave de la pregunta.
4. Ignora tablas que no tengan relación directa con la intención o términos de la pregunta.
5. Genera la respuesta texto basándote solo en las tablas seleccionadas.
6. Responde solo con la estructura de la o las tablas que tenga lógica según la pregunta.

NO INCLUYAS:
- Relaciones innecesarias.

### Esquema de tablas:
Tabla: factura_de_vents
  - fv_id (integer) [PRIMARY KEY]
  - fv_anular (boolean)
  - fv_cancelada (boolean)
  - fv_expira (date)
  - fv_fecha (date)
  - fv_impresa (boolean)
  - fv_impuesto (numeric)
  - fv_numero_factura (integer)
  - fv_ticket (boolean)
  - fv_tipo_cambio (numeric)
  - cliente_id (integer)
  - centro_de_costo_id (integer)
  - tipo_factura_id (integer)
  - tipo_moneda_id (integer)
  - fv_porcentaje_descuento (numeric)
  - fv_porcentaje_impuesto (numeric)
  - fv_subtotal_factura (numeric)
  - fv_exonerada (boolean)
  - fv_numero_exoneracion (character varying)
  - fv_monto_descuento (numeric)
  - num_reimpresion (integer)
  - empleado_id (integer)
  - autogenerada (boolean)
  - mora (numeric)
  - mora_exonerada (boolean)
  - fv_exportacion (boolean)
  - consecutivo_de_serie_id (integer)
  - factura_masiva_id (integer)
  - fv_concepto (character varying)
  - sucursal_sede_id (integer)
  - fecha_de_anulacion (date)
  - cotizacion_id (integer)
  - created_at (timestamp without time zone)
  - updated_at (timestamp without time zone)
  - fecha_de_cancelacion (date)
  - mora_congelada (numeric)
  - monto_grabable (numeric)
  - permitir_ventas_por_debajo_del_costo (boolean)
  - factura_rapida_id (integer)
  - codigo (character varying)
  - nombre (character varying)
  - nc_id (integer)
  - asignado (character varying)
  - facturacion_recurrente_id (integer)
  - estado_id (integer)
  - punto_de_venta (boolean)
  - catalogo_proyecto_id (integer)
  - financiamiento_activo (boolean)
  - financiamiento_id (bigint)
  - financiamiento_periodo_id (bigint)
  - financiamiento_tasa_id (bigint)
  - fv_prima_minima (numeric)
  - fv_prima_abonada (numeric)
  - fv_monto_financiamiento (numeric)
  - preventa_id (integer) [FK → preventas.id]

### Pregunta:
"${question}"
`;
        return prompt;
    }

    private formatSchemaForPrompt(schema: any[]): string {
        return schema.map(table => {
            const columns = table.columns.map(col => {
                let colDesc = `  - ${col.columnName} (${col.dataType})`;
                if (col.isPrimary) colDesc += ' [PRIMARY KEY]';
                if (col.foreignKey) colDesc += ` [FK → ${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}]`;
                return colDesc;
            }).join('\n');

            return `Tabla: ${table.tableName}\n${columns}`;
        }).join('\n\n');
    }

    private async executeSafeQuery(sqlQuery: string): Promise<any[]> {
        // Validar que sea una consulta SELECT segura
        if (!this.isSafeSelectQuery(sqlQuery)) {
            throw new Error('Consulta no permitida: solo se permiten consultas SELECT');
        }

        // Ejecutar la consulta
        return await this.connection.query(sqlQuery);
    }

    private isSafeSelectQuery(query: string): boolean {
        const upperQuery = query.toUpperCase().trim();

        // Permitir solo SELECT y WITH (para CTEs)
        const allowedStarts = ['SELECT', 'WITH'];
        const startsWithAllowed = allowedStarts.some(start =>
            upperQuery.startsWith(start)
        );

        if (!startsWithAllowed) return false;

        // Bloquear operaciones peligrosas
        const dangerousKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'TRUNCATE', 'CREATE', 'ALTER', 'EXEC'];
        const hasDangerous = dangerousKeywords.some(keyword =>
            upperQuery.includes(keyword)
        );

        return !hasDangerous;
    }

    private validateAndCleanSQL(sqlQuery: string): string {
        // Asegurar que termine correctamente
        let cleanSQL = sqlQuery.trim();
        if (cleanSQL.endsWith(';')) {
            cleanSQL = cleanSQL.slice(0, -1);
        }

        // Agregar LIMIT si no tiene y parece que podría devolver muchos resultados
        const upperSQL = cleanSQL.toUpperCase();
        if (!upperSQL.includes('LIMIT') &&
            (upperSQL.includes('SELECT *') || upperSQL.includes('SELECT COUNT'))) {
            cleanSQL += ' LIMIT 100';
        }

        return cleanSQL;
    }

    public getExecutionTime(startTime) {
        const ms = Date.now() - startTime;

        if (ms < 1000) {
            return `${ms} ms`;
        } else if (ms < 60 * 1000) {
            return `${(ms / 1000).toFixed(2)} s`;
        } else if (ms < 60 * 60 * 1000) {
            return `${(ms / (1000 * 60)).toFixed(2)} min`;
        } else {
            return `${(ms / (1000 * 60 * 60)).toFixed(2)} h`;
        }
    }

    private async generateExplanation(question: string, sqlQuery: string, results: any[]): Promise<string> {
        const prompt = `
Pregunta original: "${question}"
Consulta SQL generada: ${sqlQuery}
Número de resultados: ${results.length}

Por favor, explica en español qué hace esta consulta y resume los resultados principales de manera clara y concisa.

Ejemplo de explicación:
"Esta consulta busca la factura con el monto más alto en la base de datos. Encontró X resultados, siendo la factura más alta la del cliente Y con un monto de Z."

Explicación:
`;

        return await this.llmService.generateResponse(prompt);
    }

    async getSchemaSummary(): Promise<string> {
        const schema = await this.schemaService.getDatabaseSchema();

        const prompt = `
Aquí está el esquema de la base de datos:

${this.formatSchemaForPrompt(schema)}

Por favor, proporciona un resumen en español de:
1. Qué tablas existen y qué datos contienen
2. Las relaciones principales entre tablas
3. Los tipos de consultas que se pueden hacer
4. Ejemplos de preguntas útiles que se podrían hacer

Responde en español de manera clara.
`;

        return await this.llmService.generateResponse(prompt);
    }
}