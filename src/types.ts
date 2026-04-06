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

// --- Funções e variáveis Senior (dados do MCP lume-LSP) ---

export interface SeniorParametro {
    nome: string;
    tipo: string;
    descricao: string;
}

export interface SeniorFuncao {
    nome: string;
    slug: string;
    familia: string;
    descricao: string;
    modulos_disponiveis: string[];
    assinaturas: string[];
    parametros: SeniorParametro[];
    retorno: string;
    exemplos: string[];
    observacoes: string[];
    url: string;
}

export interface SeniorVariavel {
    nome: string;
    slug: string;
    descricao: string;
    url: string;
    categoria: string;
}

export interface SeniorKnowledgeBase {
    funcoes: SeniorFuncao[];
    variaveis: SeniorVariavel[];
    funcByName: Map<string, SeniorFuncao>;
    varByName: Map<string, SeniorVariavel>;
}
