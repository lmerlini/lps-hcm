import * as vscode from "vscode";

// Palavras-chave que ABREM um bloco (aumentam indentação na próxima linha)
const blockOpenPatterns: RegExp[] = [
    /\binicio\b/i,
    /\{/,
];

// Palavras-chave que FECHAM um bloco (diminuem indentação na linha atual)
const blockClosePatterns: RegExp[] = [
    /^\s*fim\b/i,
    /^\s*fimse\b/i,
    /^\s*fimpara\b/i,
    /^\s*fimenquanto\b/i,
    /^\s*\}/,
];

// Senao: fecha o bloco do Se e abre outro (dedent + indent = mesmo nível do Se)
const blockReopenPatterns: RegExp[] = [
    /^\s*senao\b/i,
];

function stripComments(line: string): string {
    const lineCommentIndex = line.indexOf("@");
    let cleaned = lineCommentIndex >= 0 ? line.slice(0, lineCommentIndex) : line;

    // Remover conteúdo de strings para não confundir com keywords
    cleaned = cleaned.replace(/"[^"]*"/g, '""');
    return cleaned;
}

function isInsideBlockComment(lines: string[], upToLine: number): boolean {
    let inBlock = false;
    for (let i = 0; i <= upToLine; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length - 1; j++) {
            if (!inBlock && line[j] === "/" && line[j + 1] === "*") {
                inBlock = true;
                j++;
            } else if (inBlock && line[j] === "*" && line[j + 1] === "/") {
                inBlock = false;
                j++;
            }
        }
    }
    return inBlock;
}

function isLineOpening(codeLine: string): boolean {
    return blockOpenPatterns.some((pattern) => pattern.test(codeLine));
}

function isLineClosing(codeLine: string): boolean {
    return blockClosePatterns.some((pattern) => pattern.test(codeLine));
}

function isLineReopening(codeLine: string): boolean {
    return blockReopenPatterns.some((pattern) => pattern.test(codeLine));
}

function isBlankOrComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed === "" || trimmed.startsWith("@") || trimmed.startsWith("/*") || trimmed.startsWith("*");
}

export class SeniorDocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        const tabChar = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
        const lines: string[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }

        const result: string[] = [];
        let indentLevel = 0;
        let inBlockComment = false;

        for (let i = 0; i < lines.length; i++) {
            const originalLine = lines[i];
            const trimmed = originalLine.trim();

            // Tratar comentário de bloco /* ... */
            if (inBlockComment) {
                result.push(tabChar.repeat(indentLevel) + " " + trimmed);
                if (trimmed.includes("*/")) {
                    inBlockComment = false;
                }
                continue;
            }

            if (trimmed.startsWith("/*")) {
                result.push(tabChar.repeat(indentLevel) + trimmed);
                if (!trimmed.includes("*/")) {
                    inBlockComment = true;
                }
                continue;
            }

            // Linhas vazias preservadas
            if (trimmed === "") {
                result.push("");
                continue;
            }

            // Comentário de linha
            if (trimmed.startsWith("@")) {
                result.push(tabChar.repeat(indentLevel) + trimmed);
                continue;
            }

            const codeLine = stripComments(originalLine).trim();

            const closes = isLineClosing(codeLine);
            const opens = isLineOpening(codeLine);
            const reopens = isLineReopening(codeLine);

            // Senao: volta um nível, escreve, e abre de novo
            if (reopens) {
                indentLevel = Math.max(0, indentLevel - 1);
                result.push(tabChar.repeat(indentLevel) + trimmed);
                indentLevel++;
                continue;
            }

            // Se fecha bloco, reduz ANTES de indentar
            if (closes) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            result.push(tabChar.repeat(indentLevel) + trimmed);

            // Se abre bloco, aumenta DEPOIS de indentar
            if (opens) {
                indentLevel++;
            }
        }

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );

        return [vscode.TextEdit.replace(fullRange, result.join("\n"))];
    }
}
