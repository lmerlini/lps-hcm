import * as vscode from "vscode";
import { findTableByReference } from "../data/tables";
import { SeniorKnowledgeBase, SeniorFuncao, SeniorVariavel, TablesCatalog, TableDefinition } from "../types";

export class SeniorHoverProvider implements vscode.HoverProvider {
    constructor(
        private readonly catalog: TablesCatalog,
        private readonly knowledge: SeniorKnowledgeBase
    ) {}

    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const wordLower = word.toLowerCase();

        // Verificar se é alias.campo (ex: fun.nomfun)
        const dotHover = this.tryDotFieldHover(document, position, wordRange);
        if (dotHover) {
            return dotHover;
        }

        // Função Senior
        const fn = this.knowledge.funcByName.get(wordLower);
        if (fn) {
            return new vscode.Hover(buildFuncaoHover(fn), wordRange);
        }

        // Variável interna Senior
        const v = this.knowledge.varByName.get(wordLower);
        if (v) {
            return new vscode.Hover(buildVariavelHover(v), wordRange);
        }

        // Tabela Senior
        const table = findTableByReference(this.catalog, word);
        if (table) {
            return new vscode.Hover(buildTableHover(table), wordRange);
        }

        return undefined;
    }

    private tryDotFieldHover(document: vscode.TextDocument, position: vscode.Position, wordRange: vscode.Range): vscode.Hover | undefined {
        const line = document.lineAt(position.line).text;
        const wordStart = wordRange.start.character;

        if (wordStart < 2 || line[wordStart - 1] !== ".") {
            return undefined;
        }

        const beforeDot = line.slice(0, wordStart - 1);
        const aliasMatch = beforeDot.match(/([A-Za-z_]\w*)$/);
        if (!aliasMatch) {
            return undefined;
        }

        const alias = aliasMatch[1];
        const table = findTableByReference(this.catalog, alias);
        if (!table) {
            return undefined;
        }

        const fieldName = document.getText(wordRange).toLowerCase();
        const field = table.fields[fieldName];
        if (!field) {
            return undefined;
        }

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### ${table.name}.${fieldName}\n\n`);
        md.appendMarkdown(`**Tipo:** \`${field.tipo}\`${field.tipoOriginal ? ` (${field.tipoOriginal})` : ""}\n\n`);
        if (field.descricao) {
            md.appendMarkdown(`**Descricao:** ${field.descricao}\n\n`);
        }
        if (field.obrigatorio) {
            md.appendMarkdown(`**Obrigatorio** | `);
        }
        if (field.chave) {
            md.appendMarkdown(`**Chave primaria**\n\n`);
        }
        if (field.relationship) {
            md.appendMarkdown(`**Relaciona com:** ${field.relationship.targetTable}\n\n`);
        }

        return new vscode.Hover(md, wordRange);
    }
}

function buildFuncaoHover(fn: SeniorFuncao): vscode.MarkdownString {
    const md = new vscode.MarkdownString();

    md.appendMarkdown(`### ${fn.nome}\n\n`);

    if (fn.assinaturas?.length) {
        md.appendCodeblock(fn.assinaturas.join("\n"), "senior");
    }

    if (fn.familia) {
        md.appendMarkdown(`**Familia:** ${fn.familia}\n\n`);
    }

    if (fn.modulos_disponiveis?.length) {
        md.appendMarkdown(`**Modulos:** ${fn.modulos_disponiveis.join(", ")}\n\n`);
    }

    if (fn.descricao && fn.descricao !== fn.nome) {
        md.appendMarkdown(`${fn.descricao}\n\n`);
    }

    if (fn.parametros?.length) {
        md.appendMarkdown("**Parametros:**\n\n");
        for (const p of fn.parametros) {
            const desc = p.descricao ? ` — ${p.descricao}` : "";
            md.appendMarkdown(`- \`${p.nome}\` (*${p.tipo}*)${desc}\n`);
        }
        md.appendMarkdown("\n");
    }

    if (fn.retorno && fn.retorno !== "Retorno:") {
        md.appendMarkdown(`**Retorno:** ${fn.retorno}\n\n`);
    }

    if (fn.exemplos?.length) {
        md.appendMarkdown("**Exemplos:**\n\n");
        md.appendCodeblock(fn.exemplos.join("\n"), "senior");
    }

    if (fn.url) {
        md.appendMarkdown(`[Ver documentacao Senior](${fn.url})\n`);
    }

    return md;
}

function buildVariavelHover(v: SeniorVariavel): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${v.nome} *(variavel interna)*\n\n`);
    md.appendMarkdown(`**Descricao:** ${v.descricao}\n\n`);
    md.appendMarkdown(`**Categoria:** ${v.categoria}\n\n`);
    if (v.url) {
        md.appendMarkdown(`[Ver documentacao Senior](${v.url})\n`);
    }
    return md;
}

function buildTableHover(table: TableDefinition): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${table.name} *(tabela)*\n\n`);

    if (table.description) {
        md.appendMarkdown(`${table.description}\n\n`);
    }

    if (table.totalFields) {
        md.appendMarkdown(`**Campos:** ${table.totalFields}`);
    }

    if (table.primaryKey?.length) {
        md.appendMarkdown(` | **Chave:** ${table.primaryKey.join(", ")}\n\n`);
    } else {
        md.appendMarkdown("\n\n");
    }

    if (table.aliases?.length) {
        md.appendMarkdown(`**Aliases:** ${table.aliases.join(", ")}\n\n`);
    }

    const fieldEntries = Object.entries(table.fields);
    if (fieldEntries.length) {
        const preview = fieldEntries.slice(0, 10);
        md.appendMarkdown("**Campos:**\n\n");
        for (const [name, field] of preview) {
            const markers = [field.chave ? "PK" : "", field.obrigatorio ? "req" : ""].filter(Boolean).join(",");
            const suffix = markers ? ` [${markers}]` : "";
            md.appendMarkdown(`- \`${name}\` *${field.tipo}*${suffix} — ${field.descricao ?? ""}\n`);
        }
        if (fieldEntries.length > 10) {
            md.appendMarkdown(`\n*...e mais ${fieldEntries.length - 10} campos*\n`);
        }
    }

    return md;
}
