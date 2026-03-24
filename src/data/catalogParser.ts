import { FieldDefinition, TableDefinition, TableRelationship } from "../types";

const tableSeparatorRegex = /^\s*-{10,}\s*$/m;
const tableHeaderRegex = /^Tabela:\s*([A-Z0-9_]+)\s*-\s*(.+)$/im;
const totalFieldsRegex = /^Total de campos:\s*(\d+)/im;
const primaryKeyRegex = /^Chave prim[aá]ria:\s*.+?\[([^\]]+)\]/im;
const relationshipCountRegex = /^Total de relacionamentos:\s*(\d+)/im;

export function parseTablesText(contents: string): TableDefinition[] {
    const sections = contents
        .split(tableSeparatorRegex)
        .map((section) => section.trim())
        .filter((section) => section.startsWith("Tabela:"));

    const tables: TableDefinition[] = [];

    for (const section of sections) {
        const headerMatch = section.match(tableHeaderRegex);
        if (!headerMatch) {
            continue;
        }

        const [, rawName, description] = headerMatch;
        const name = rawName.toUpperCase();
        const totalFields = Number(section.match(totalFieldsRegex)?.[1] ?? "0");
        const primaryKey = splitFields(section.match(primaryKeyRegex)?.[1]);
        const fields = parseFieldsBlock(section, primaryKey);
        const relationships = parseRelationshipsBlock(section);

        tables.push({
            name,
            description: description.trim(),
            aliases: [],
            totalFields,
            primaryKey,
            relationships,
            fields
        });
    }

    return tables;
}

export function parseRelationshipsText(contents: string): Map<string, TableRelationship[]> {
    const relationshipMap = new Map<string, TableRelationship[]>();
    const blocks = contents.split(/\r?\n\s*\r?\n/g).map((block) => block.trim()).filter(Boolean);

    for (const block of blocks) {
        const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length < 3) {
            continue;
        }

        const tableMatch = lines[0].match(/^Tabela:\s*([A-Z0-9_]+)\s*-\s*Campo:\s*([A-Za-z0-9_]+)\s*-\s*Tabela destino:\s*([A-Z0-9_]+)/i);
        const sourceMatch = lines[1].match(/^Campos origem:\s*(.+?)\s*-\s*Campos:\s*destino:\s*(.+)$/i);
        const resultMatch = lines[2].match(/^Campo Resultante:\s*(.+)$/i);

        if (!tableMatch || !sourceMatch) {
            continue;
        }

        const [, rawTableName, rawFieldName, rawTargetTable] = tableMatch;
        const tableName = rawTableName.toUpperCase();
        const fieldName = rawFieldName.toUpperCase();
        const targetTable = rawTargetTable.toUpperCase();
        const sourceFields = splitFields(sourceMatch[1]);
        const targetFields = splitFields(sourceMatch[2]);
        const resultField = resultMatch?.[1]?.trim();

        const relationship: TableRelationship = {
            targetTable,
            sourceFields,
            targetFields,
            resultField: resultField && resultField !== "-" ? resultField : undefined
        };

        const current = relationshipMap.get(tableName) ?? [];
        current.push({
            ...relationship,
            name: fieldName
        });
        relationshipMap.set(tableName, current);
    }

    return relationshipMap;
}

export function mergeRelationshipMetadata(
    tables: TableDefinition[],
    externalRelationships: Map<string, TableRelationship[]>
): TableDefinition[] {
    return tables.map((table) => {
        const mergedRelationships = mergeRelationships(
            table.relationships ?? [],
            externalRelationships.get(table.name) ?? []
        );

        const fields: Record<string, FieldDefinition> = { ...table.fields };
        for (const relationship of mergedRelationships) {
            const directFieldName = relationship.name;
            if (directFieldName && fields[directFieldName]) {
                fields[directFieldName] = {
                    ...fields[directFieldName],
                    relationship: {
                        targetTable: relationship.targetTable,
                        sourceFields: relationship.sourceFields,
                        targetFields: relationship.targetFields,
                        resultField: relationship.resultField
                    }
                };
            }
        }

        return {
            ...table,
            relationships: mergedRelationships,
            fields
        };
    });
}

function parseFieldsBlock(section: string, primaryKey: string[]): Record<string, FieldDefinition> {
    const fields: Record<string, FieldDefinition> = {};
    const lines = section.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => /^Coluna\s+Obrigat[oó]rio\s+Tipo/i.test(line.trim()));

    if (headerIndex === -1) {
        return fields;
    }

    for (let index = headerIndex + 1; index < lines.length; index++) {
        const rawLine = lines[index].trim();
        if (!rawLine || /^(Chave prim[aá]ria|Indice|Total de relacionamentos|Relacionamento)\b/i.test(rawLine)) {
            break;
        }

        const columns = rawLine.split(/\t+/).map((part) => part.trim()).filter(Boolean);
        if (columns.length < 4) {
            continue;
        }

        const [name, requiredLabel, rawType, ...descriptionParts] = columns;
        const normalizedName = name.toUpperCase();
        fields[normalizedName] = {
            tipo: normalizeType(rawType),
            tipoOriginal: rawType,
            obrigatorio: /^sim$/i.test(requiredLabel),
            chave: primaryKey.includes(normalizedName),
            descricao: descriptionParts.join(" ").trim()
        };
    }

    return fields;
}

function parseRelationshipsBlock(section: string): TableRelationship[] {
    const relationshipCount = Number(section.match(relationshipCountRegex)?.[1] ?? "0");
    if (!relationshipCount) {
        return [];
    }

    const lines = section.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => /^Relacionamento\s+Tabela Referenciada/i.test(line.trim()));
    if (headerIndex === -1) {
        return [];
    }

    const relationships: TableRelationship[] = [];
    for (let index = headerIndex + 1; index < lines.length; index++) {
        const rawLine = lines[index].trim();
        if (!rawLine) {
            break;
        }

        const columns = rawLine.split(/\t+/).map((part) => part.trim()).filter(Boolean);
        if (columns.length < 4) {
            continue;
        }

        const [name, rawTargetTable, sourceFieldsRaw, targetFieldsRaw] = columns;
        relationships.push({
            name,
            targetTable: rawTargetTable.toUpperCase(),
            sourceFields: splitFields(sourceFieldsRaw),
            targetFields: splitFields(targetFieldsRaw)
        });
    }

    return relationships;
}

function mergeRelationships(
    fromTables: TableRelationship[],
    fromExternal: TableRelationship[]
): TableRelationship[] {
    const merged = new Map<string, TableRelationship>();

    for (const relationship of [...fromTables, ...fromExternal]) {
        const key = [
            relationship.name ?? "",
            relationship.targetTable,
            relationship.sourceFields.join(";"),
            relationship.targetFields.join(";")
        ].join("|");

        const previous = merged.get(key);
        merged.set(key, {
            ...previous,
            ...relationship,
            resultField: relationship.resultField ?? previous?.resultField
        });
    }

    return Array.from(merged.values());
}

function splitFields(value?: string): string[] {
    if (!value) {
        return [];
    }

    return value
        .split(";")
        .map((field) => field.trim().toUpperCase())
        .filter(Boolean);
}

function normalizeType(rawType: string): string {
    const normalized = rawType.toLowerCase();
    if (normalized.startsWith("number")) {
        return "numero";
    }
    if (normalized.startsWith("string")) {
        return "alfa";
    }
    if (normalized.startsWith("date")) {
        return "data";
    }
    return rawType.trim();
}
