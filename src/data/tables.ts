import rawTables from "../../data/tabelas.json";
import { TableDefinition, TablesCatalog } from "../types";
import { mergeRelationshipMetadata, parseRelationshipsText, parseTablesText } from "./catalogParser";

declare function require(moduleName: string): any;

const fs = require("fs");
const path = require("path");

type LegacyFieldShape = { tipo: string; chave?: boolean; descricao?: string };
type LegacyTableShape = Record<string, Record<string, LegacyFieldShape>>;
type RawCatalog = { tables?: TableDefinition[] } | LegacyTableShape;

const tablesFileName = "TABLES.Txt";
const relationshipsFileName = "relacionamentos.Txt";

function isModernCatalog(value: RawCatalog): value is { tables: TableDefinition[] } {
    return Array.isArray((value as { tables?: TableDefinition[] }).tables);
}

function normalizeTables(value: RawCatalog): TableDefinition[] {
    if (isModernCatalog(value)) {
        return value.tables.map((table) => ({
            ...table,
            aliases: table.aliases ?? [],
            primaryKey: table.primaryKey ?? [],
            relationships: table.relationships ?? [],
            fields: table.fields ?? {}
        }));
    }

    return Object.entries(value).map(([name, fields]) => ({
        name,
        aliases: [name.slice(1)],
        primaryKey: [],
        relationships: [],
        fields
    }));
}

export function loadTableCatalog(basePath?: string): TablesCatalog {
    const tables = loadPreferredCatalog(basePath) ?? normalizeTables(rawTables as unknown as RawCatalog);
    const byName = new Map<string, TableDefinition>();
    const byAlias = new Map<string, TableDefinition>();

    for (const table of tables) {
        byName.set(table.name.toUpperCase(), table);

        for (const alias of table.aliases ?? []) {
            byAlias.set(alias.toUpperCase(), table);
        }
    }

    return { tables, byName, byAlias };
}

export function findTableByReference(catalog: TablesCatalog, reference: string): TableDefinition | undefined {
    const normalized = reference.trim().toUpperCase();
    return catalog.byAlias.get(normalized) ?? catalog.byName.get(normalized);
}

function loadPreferredCatalog(basePath?: string): TableDefinition[] | undefined {
    if (!basePath) {
        return undefined;
    }

    const tablesPath = path.join(basePath, tablesFileName);
    if (!fs.existsSync(tablesPath)) {
        return undefined;
    }

    const tablesText = fs.readFileSync(tablesPath, "utf8");
    const parsedTables = parseTablesText(tablesText);
    if (!parsedTables.length) {
        return undefined;
    }

    const relationshipsPath = path.join(basePath, relationshipsFileName);
    if (!fs.existsSync(relationshipsPath)) {
        return parsedTables;
    }

    const relationshipsText = fs.readFileSync(relationshipsPath, "utf8");
    return mergeRelationshipMetadata(parsedTables, parseRelationshipsText(relationshipsText));
}
