import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

interface ColumnInfo {
    columnName: string;
    dataType: string;
    isNullable: boolean;
    isPrimary: boolean;
    foreignKey?: {
        referencedTable: string;
        referencedColumn: string;
    };
}

interface TableInfo {
    tableName: string;
    columns: ColumnInfo[];
}

@Injectable()
export class SchemaService {
    constructor(
        @InjectConnection()
        private readonly connection: Connection,
    ) {}

    async getDatabaseSchema(): Promise<TableInfo[]> {
        const tables = await this.getTableNames();
        const tableInfos: TableInfo[] = [];

        for (const table of tables) {
            const columns = await this.getTableColumns(table);
            tableInfos.push({
                tableName: table,
                columns: columns,
            });
        }

        return tableInfos;
    }

    async getTableNames(): Promise<string[]> {
        const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

        const result = await this.connection.query(query);
        return result.map(row => row.table_name);
    }

    async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
        // Obtener información básica de columnas
        const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      ORDER BY ordinal_position
    `;

        const columns = await this.connection.query(columnsQuery, [tableName]);

        // Obtener claves primarias
        const primaryKeysQuery = `
      SELECT 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.table_name = $1 
        AND tc.constraint_type = 'PRIMARY KEY'
    `;

        const primaryKeys = await this.connection.query(primaryKeysQuery, [tableName]);
        const primaryKeySet = new Set(primaryKeys.map(pk => pk.column_name));

        // Obtener claves foráneas
        const foreignKeysQuery = `
      SELECT
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.table_name = $1 
        AND tc.constraint_type = 'FOREIGN KEY'
    `;

        const foreignKeys = await this.connection.query(foreignKeysQuery, [tableName]);
        const foreignKeyMap = new Map();
        foreignKeys.forEach(fk => {
            foreignKeyMap.set(fk.column_name, {
                referencedTable: fk.referenced_table,
                referencedColumn: fk.referenced_column,
            });
        });

        // Construir resultado final
        return columns.map(column => ({
            columnName: column.column_name,
            dataType: column.data_type,
            isNullable: column.is_nullable === 'YES',
            isPrimary: primaryKeySet.has(column.column_name),
            foreignKey: foreignKeyMap.get(column.column_name),
        }));
    }

    async getSampleData(tableName: string, limit: number = 3): Promise<any[]> {
        const query = `SELECT * FROM "${tableName}" LIMIT $1`;
        return await this.connection.query(query, [limit]);
    }
}