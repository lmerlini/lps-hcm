import * as vscode from "vscode";
import { loadSeniorKnowledge } from "../data/seniorKnowledge";
import { loadTableCatalog } from "../data/tables";
import { SeniorFuncao, SeniorVariavel, TableDefinition } from "../types";

declare function require(moduleName: string): any;

const fs = require("fs");
const path = require("path");

export function createExportKnowledgeCommand(extensionPath: string) {
    return async () => {
        const knowledge = loadSeniorKnowledge(extensionPath);
        const catalog = loadTableCatalog(extensionPath);

        const targetUri = await pickTargetFile();
        if (!targetUri) {
            return;
        }

        const content = buildMarkdown(knowledge.funcoes, knowledge.variaveis, catalog.tables);
        fs.writeFileSync(targetUri.fsPath, content, "utf8");

        const open = await vscode.window.showInformationMessage(
            `Conhecimento Senior exportado (${knowledge.funcoes.length} funções, ${knowledge.variaveis.length} variáveis, ${catalog.tables.length} tabelas).`,
            "Abrir arquivo"
        );
        if (open === "Abrir arquivo") {
            const doc = await vscode.workspace.openTextDocument(targetUri);
            await vscode.window.showTextDocument(doc);
        }
    };
}

async function pickTargetFile(): Promise<vscode.Uri | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const defaultUri = workspaceFolder
        ? vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, "senior-context.md"))
        : undefined;

    return vscode.window.showSaveDialog({
        defaultUri,
        filters: { Markdown: ["md"], "Texto": ["txt"] },
        saveLabel: "Exportar conhecimento Senior"
    });
}

function buildMarkdown(
    funcoes: SeniorFuncao[],
    variaveis: SeniorVariavel[],
    tabelas: TableDefinition[]
): string {
    const lines: string[] = [];
    lines.push("# Contexto da Linguagem Senior (LSP)");
    lines.push("");
    lines.push("Resumo gerado automaticamente pela extensão `lsp-senior-highlight`.");
    lines.push("Use este arquivo como contexto para IAs (Claude, Copilot, etc.) entenderem");
    lines.push("quais funções, variáveis e tabelas estão disponíveis no ambiente Senior HCM.");
    lines.push("");
    lines.push(`- Funções: ${funcoes.length}`);
    lines.push(`- Variáveis: ${variaveis.length}`);
    lines.push(`- Tabelas: ${tabelas.length}`);
    lines.push("");

    lines.push("## Funções");
    lines.push("");
    const funcoesPorFamilia = groupBy(funcoes, (f) => f.familia || "Outras");
    for (const familia of Array.from(funcoesPorFamilia.keys()).sort()) {
        lines.push(`### ${familia}`);
        lines.push("");
        const itens = funcoesPorFamilia.get(familia)!.sort((a, b) => a.nome.localeCompare(b.nome));
        for (const fn of itens) {
            const assinatura = fn.assinaturas?.[0] ?? `${fn.nome}(...)`;
            const retorno = fn.retorno ? ` → ${fn.retorno}` : "";
            const desc = oneLine(fn.descricao);
            lines.push(`- \`${assinatura}\`${retorno}${desc ? ` — ${desc}` : ""}`);
        }
        lines.push("");
    }

    lines.push("## Variáveis");
    lines.push("");
    const varsPorCategoria = groupBy(variaveis, (v) => v.categoria || "Outras");
    for (const categoria of Array.from(varsPorCategoria.keys()).sort()) {
        lines.push(`### ${categoria}`);
        lines.push("");
        const itens = varsPorCategoria.get(categoria)!.sort((a, b) => a.nome.localeCompare(b.nome));
        for (const v of itens) {
            const desc = oneLine(v.descricao);
            lines.push(`- \`${v.nome}\`${desc ? ` — ${desc}` : ""}`);
        }
        lines.push("");
    }

    lines.push("## Tabelas");
    lines.push("");
    for (const tabela of [...tabelas].sort((a, b) => a.name.localeCompare(b.name))) {
        const aliases = tabela.aliases?.length ? ` (alias: ${tabela.aliases.join(", ")})` : "";
        const desc = tabela.description ? ` — ${oneLine(tabela.description)}` : "";
        lines.push(`### \`${tabela.name}\`${aliases}${desc}`);
        if (tabela.primaryKey?.length) {
            lines.push(`- Chave primária: ${tabela.primaryKey.join(", ")}`);
        }
        const totalCampos = tabela.totalFields ?? Object.keys(tabela.fields).length;
        lines.push(`- Campos: ${totalCampos}`);
        if (tabela.relationships?.length) {
            lines.push("- Relacionamentos:");
            for (const rel of tabela.relationships) {
                const nome = rel.name ? `\`${rel.name}\` ` : "";
                lines.push(
                    `  - ${nome}→ \`${rel.targetTable}\` (${rel.sourceFields.join(",")} = ${rel.targetFields.join(",")})`
                );
            }
        }
        const campos = Object.entries(tabela.fields);
        if (campos.length) {
            lines.push("- Campos detalhados:");
            for (const [nome, def] of campos) {
                const flags = [
                    def.chave ? "PK" : null,
                    def.obrigatorio ? "obrigatório" : null
                ].filter(Boolean).join(", ");
                const flagsStr = flags ? ` [${flags}]` : "";
                const descricao = def.descricao ? ` — ${oneLine(def.descricao)}` : "";
                lines.push(`  - \`${nome}\`: ${def.tipo}${flagsStr}${descricao}`);
            }
        }
        lines.push("");
    }

    return lines.join("\n");
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
        const k = key(item);
        const arr = map.get(k);
        if (arr) {
            arr.push(item);
        } else {
            map.set(k, [item]);
        }
    }
    return map;
}

function oneLine(text: string | undefined): string {
    if (!text) {
        return "";
    }
    return text.replace(/\s+/g, " ").trim();
}
