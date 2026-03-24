import * as vscode from "vscode";

const declarationTypes = ["numero", "alfa", "data", "cursor", "tabela", "grid"];
const reservedWordBase = [
    "se", "senao", "enquanto", "para", "inicio", "fim", "funcao", "retorne",
    "mensagem", "cancelar", "continue", "vapara", "regra", "inserir", "definir",
    "execsql", "execsqlex", "abrir", "fechar", "proximo", "achou", "naoachou",
    "iniciartransacao", "finalizartransacao", "desfazertransacao", "numero",
    "alfa", "data", "grid", "tabela", "cursor", "valstr", "valret", "erro",
    "refaz", "retorna", "e", "ou", "nao", "ler", "gravar"
];

const keywordCamelCaseMap: Record<string, string> = {
    execsql: "execSql",
    execsqlex: "execSqlEx",
    naoachou: "naoAchou",
    iniciartransacao: "iniciarTransacao",
    finalizartransacao: "finalizarTransacao",
    desfazertransacao: "desfazerTransacao"
};

const reservedWords = new Set(reservedWordBase.map((keyword) => keyword.toLowerCase()));

export const camelCaseKeyword = (keyword: string) => keywordCamelCaseMap[keyword.toLowerCase()] ?? keyword;

export const diagnosticCodes = {
    undeclaredVariable: "senior.undeclaredVariable",
    reservedVariable: "senior.reservedVariable",
    invalidStringEscape: "senior.invalidStringEscape"
} as const;

export interface SeniorDiagnosticData {
    varName?: string;
    lineNumber?: number;
}

type DiagnosticWithData = vscode.Diagnostic & { data?: SeniorDiagnosticData };

const declarationRegex = new RegExp(
    `^\\s*definir\\s+(?:${declarationTypes.join("|")})\\s+([A-Za-z_]\\w*)`,
    "i"
);

const assignmentRegex = /^\s*([A-Za-z_]\w*)\s*=\s*(.+?);?\s*$/i;
const stringLiteralRegex = /"([^"\\]|\\.)*"/g;
const invalidEscapeRegex = /(^|[^\\])\\([^\\/"nrt])/i;

export function analyzeDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const declaredVariables = new Set<string>();

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex).text;
        const codeLine = stripLineComment(line);
        const trimmed = codeLine.trim();

        if (!trimmed) {
            continue;
        }

        const declarationMatch = trimmed.match(declarationRegex);
        if (declarationMatch) {
            const variableName = declarationMatch[1];
            const normalized = variableName.toLowerCase();

            if (reservedWords.has(normalized)) {
                diagnostics.push(createDiagnostic(
                    document,
                    lineIndex,
                    variableName,
                    `A variavel "${variableName}" usa uma palavra reservada da linguagem.`,
                    vscode.DiagnosticSeverity.Error,
                    diagnosticCodes.reservedVariable,
                    { varName: variableName }
                ));
            } else {
                declaredVariables.add(normalized);
            }
        }

        const assignmentMatch = trimmed.match(assignmentRegex);
        if (assignmentMatch) {
            const variableName = assignmentMatch[1];
            const expression = assignmentMatch[2];
            const normalized = variableName.toLowerCase();

            if (!declaredVariables.has(normalized) && !reservedWords.has(normalized) && !expression.includes(".")) {
                diagnostics.push(createDiagnostic(
                    document,
                    lineIndex,
                    variableName,
                    `A variavel "${variableName}" nao foi definida com 'Definir'.`,
                    vscode.DiagnosticSeverity.Warning,
                    diagnosticCodes.undeclaredVariable,
                    { varName: variableName }
                ));
            }
        }

        const stringRegex = new RegExp(stringLiteralRegex.source, "g");
        let match: RegExpExecArray | null;
        while ((match = stringRegex.exec(codeLine)) !== null) {
            const rawString = match[0];
            const content = rawString.slice(1, -1);

            if (invalidEscapeRegex.test(content)) {
                diagnostics.push(createRangeDiagnostic(
                    new vscode.Range(
                        lineIndex,
                        match.index ?? 0,
                        lineIndex,
                        (match.index ?? 0) + rawString.length
                    ),
                    "A string contem barras nao escapadas corretamente.",
                    vscode.DiagnosticSeverity.Warning,
                    diagnosticCodes.invalidStringEscape,
                    { lineNumber: lineIndex }
                ));
            }
        }
    }

    return diagnostics;
}

function stripLineComment(line: string): string {
    const commentIndex = line.indexOf("@");
    return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
}

function createDiagnostic(
    document: vscode.TextDocument,
    lineIndex: number,
    token: string,
    message: string,
    severity: vscode.DiagnosticSeverity,
    code: string,
    data: SeniorDiagnosticData
): vscode.Diagnostic {
    const lineText = document.lineAt(lineIndex).text;
    const startChar = Math.max(lineText.toLowerCase().indexOf(token.toLowerCase()), 0);
    return createRangeDiagnostic(
        new vscode.Range(lineIndex, startChar, lineIndex, startChar + token.length),
        message,
        severity,
        code,
        data
    );
}

function createRangeDiagnostic(
    range: vscode.Range,
    message: string,
    severity: vscode.DiagnosticSeverity,
    code: string,
    data: SeniorDiagnosticData
): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, message, severity) as DiagnosticWithData;
    diagnostic.code = code;
    diagnostic.source = "lps-hcm";
    diagnostic.data = data;
    return diagnostic;
}
