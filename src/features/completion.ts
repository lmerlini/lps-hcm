import * as vscode from "vscode";
import { findTableByReference } from "../data/tables";
import { TableDefinition, TablesCatalog } from "../types";

const keywordBaseItems = [
    "se", "senao", "enquanto", "para", "inicio", "fim", "funcao", "retorne",
    "mensagem", "cancelar", "continue", "vapara", "regra", "execsql", "execsqlex",
    "abrir", "fechar", "achou", "naoachou", "iniciartransacao", "finalizartransacao", "desfazertransacao"
];

const keywordCamelCaseMap: Record<string, string> = {
    execsql: "execSql",
    execsqlex: "execSqlEx",
    naoachou: "naoAchou",
    iniciartransacao: "iniciarTransacao",
    finalizartransacao: "finalizarTransacao",
    desfazertransacao: "desfazerTransacao"
};

const keywordItems = keywordBaseItems.map((keyword) => keywordCamelCaseMap[keyword] ?? keyword);
const typeItems = ["numero", "alfa", "data", "cursor", "tabela", "grid"];
const tableContextRegex = /\b(from|join|update|into)\s+([\w]*)$/i;
const aliasReferenceRegex = /([A-Za-z_]\w*)\.$/;

export interface CompletionContext {
    kind: "types" | "tables" | "fields" | "keywords";
    table?: TableDefinition;
}

export class SeniorCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private readonly catalog: TablesCatalog) {}

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const context = inferCompletionContext(document, position, this.catalog);

        switch (context.kind) {
            case "types":
                return typeItems.map((typeName) => createCompletionItem(typeName, vscode.CompletionItemKind.TypeParameter, "Tipo de declaracao"));
            case "tables":
                return this.catalog.tables.map((table) => {
                    const item = createCompletionItem(table.name, vscode.CompletionItemKind.Struct, table.description ?? "Tabela Senior");
                    item.detail = buildTableDetail(table);
                    item.documentation = buildTableDocumentation(table);
                    return item;
                });
            case "fields":
                return Object.entries(context.table?.fields ?? {}).map(([fieldName, field]) => {
                    const label = field.obrigatorio ? `* ${fieldName}` : fieldName;
                    const item = createCompletionItem(label, vscode.CompletionItemKind.Field, field.descricao ?? "Campo da tabela");
                    item.insertText = fieldName;
                    item.filterText = fieldName;
                    item.sortText = `${field.obrigatorio ? "0" : "1"}_${fieldName}`;
                    item.detail = buildFieldDetail(context.table, fieldName);
                    item.documentation = buildFieldDocumentation(context.table, fieldName);
                    return item;
                });
            case "keywords":
            default:
                return keywordItems.map((keyword) => createCompletionItem(keyword, vscode.CompletionItemKind.Keyword, "Palavra-chave Senior"));
        }
    }
}

export function inferCompletionContext(
    document: Pick<vscode.TextDocument, "getText" | "lineAt">,
    position: vscode.Position,
    catalog: TablesCatalog
): CompletionContext {
    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);

    if (/\bdefinir\s+[\w]*$/i.test(linePrefix)) {
        return { kind: "types" };
    }

    if (tableContextRegex.test(linePrefix)) {
        return { kind: "tables" };
    }

    const aliasReference = linePrefix.match(aliasReferenceRegex)?.[1];
    if (aliasReference) {
        let table = findTableFromDocument(document.getText(), catalog, aliasReference);
        if (!table) {
            table = findTableFromCursorSqlAssignment(document.getText(), aliasReference, catalog);
        }
        if (table) {
            return { kind: "fields", table };
        }
    }

    if (isSqlContext(linePrefix)) {
        const table = inferPrimaryTable(document.getText(), catalog);
        if (table) {
            return { kind: "fields", table };
        }
    }

    return { kind: "keywords" };
}

function findTableFromDocument(documentText: string, catalog: TablesCatalog, reference: string): TableDefinition | undefined {
    const normalizedText = documentText.toUpperCase();
    const normalizedReference = reference.toUpperCase();
    const aliasPattern = new RegExp(`\\b(?:FROM|JOIN|UPDATE|INTO)\\s+([A-Z0-9_]+)(?:\\s+(?:AS\\s+)?${normalizedReference})\\b`, "i");
    const aliasMatch = normalizedText.match(aliasPattern);

    if (aliasMatch) {
        return findTableByReference(catalog, aliasMatch[1]);
    }

    return findTableByReference(catalog, normalizedReference);
}

function findTableFromCursorSqlAssignment(documentText: string, cursor: string, catalog: TablesCatalog): TableDefinition | undefined {
    const normalizedCursor = cursor.toUpperCase();
    const cursorSqlPattern = new RegExp(`\\b${normalizedCursor}\\.sql\\s*=\\s*"[^"]*\\bFROM\\s+([A-Z0-9_]+)`, "i");
    const cursorSqlMatch = documentText.match(cursorSqlPattern);

    if (cursorSqlMatch) {
        return findTableByReference(catalog, cursorSqlMatch[1]);
    }

    return undefined;
}

function isSqlContext(linePrefix: string): boolean {
    const normalized = linePrefix.replace(/["'`\s;]+$/g, "");
    return /\b(select|where|and|or|order\s+by)\b/i.test(normalized);
}

function inferPrimaryTable(documentText: string, catalog: TablesCatalog): TableDefinition | undefined {
    const match = documentText.match(/\b(?:FROM|UPDATE|INTO)\s+([A-Za-z_]\w*)/i);
    return match ? findTableByReference(catalog, match[1]) : undefined;
}

function createCompletionItem(label: string, kind: vscode.CompletionItemKind, detail: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(label, kind);
    item.detail = detail;
    return item;
}

function buildTableDetail(table: TableDefinition): string {
    const parts = [table.description ?? "Tabela Senior"];

    if (table.totalFields) {
        parts.push(`${table.totalFields} campos`);
    }

    if (table.relationships?.length) {
        parts.push(`${table.relationships.length} relacionamentos`);
    }

    return parts.join(" - ");
}

function buildTableDocumentation(table: TableDefinition): string {
    const lines = [`Tabela ${table.name}`];

    if (table.description) {
        lines.push(table.description);
    }

    if (table.primaryKey?.length) {
        lines.push(`Chave primaria: ${table.primaryKey.join("; ")}`);
    }

    if (table.aliases?.length) {
        lines.push(`Aliases: ${table.aliases.join(", ")}`);
    }

    if (table.relationships?.length) {
        const firstRelations = table.relationships
            .slice(0, 5)
            .map((relationship) => `${relationship.targetTable} (${relationship.sourceFields.join("; ")} -> ${relationship.targetFields.join("; ")})`);
        lines.push(`Relacionamentos: ${firstRelations.join(" | ")}`);
    }

    return lines.join("\n");
}

function buildFieldDetail(table: TableDefinition | undefined, fieldName: string): string {
    const field = table?.fields[fieldName];
    if (!table || !field) {
        return "Campo da tabela";
    }

    const parts = [table.name, field.tipo];
    if (field.obrigatorio) {
        parts.push("obrigatorio");
    }
    if (field.chave) {
        parts.push("chave");
    }
    if (field.relationship) {
        parts.push(`-> ${field.relationship.targetTable}`);
    }

    return parts.join(" - ");
}

function buildFieldDocumentation(table: TableDefinition | undefined, fieldName: string): string {
    const field = table?.fields[fieldName];
    if (!table || !field) {
        return "Campo da tabela";
    }

    const lines = [`${table.name}.${fieldName}`];
    lines.push(`Tipo: ${field.tipo}${field.tipoOriginal ? ` (${field.tipoOriginal})` : ""}`);

    if (field.descricao) {
        lines.push(`Descricao: ${field.descricao}`);
    }

    if (field.relationship) {
        lines.push(`Relaciona com: ${field.relationship.targetTable}`);
        lines.push(`Origem -> destino: ${field.relationship.sourceFields.join("; ")} -> ${field.relationship.targetFields.join("; ")}`);
        if (field.relationship.resultField) {
            lines.push(`Campo resultante: ${field.relationship.resultField}`);
        }
    }

    return lines.join("\n");
}
