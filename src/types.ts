export interface FieldDefinition {
    tipo: string;
    chave?: boolean;
    obrigatorio?: boolean;
    tipoOriginal?: string;
    descricao?: string;
    relationship?: FieldRelationship;
}

export interface TableRelationship {
    name?: string;
    targetTable: string;
    sourceFields: string[];
    targetFields: string[];
    resultField?: string;
}

export interface FieldRelationship {
    targetTable: string;
    sourceFields: string[];
    targetFields: string[];
    resultField?: string;
}

export interface TableDefinition {
    name: string;
    description?: string;
    aliases?: string[];
    totalFields?: number;
    primaryKey?: string[];
    relationships?: TableRelationship[];
    fields: Record<string, FieldDefinition>;
}

export interface TablesCatalog {
    tables: TableDefinition[];
    byName: Map<string, TableDefinition>;
    byAlias: Map<string, TableDefinition>;
}
