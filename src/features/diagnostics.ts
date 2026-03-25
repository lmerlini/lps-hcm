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

const noSemicolonKeywords = new Set([
    "se", "senao", "enquanto", "para", "inicio", "fim", "funcao", "retorne",
    "mensagem", "cancelar", "continue", "vapara", "regra", "inserir", "definir",
    "execsql", "execsqlex", "abrir", "fechar", "proximo", "achou", "naoachou",
    "iniciartransacao", "finalizartransacao", "desfazertransacao", "numero", "alfa",
    "data", "grid", "tabela", "cursor", "valstr", "valret", "erro", "refaz",
    "retorna", "e", "ou", "nao", "ler", "gravar"
]);

export const camelCaseKeyword = (keyword: string) => keywordCamelCaseMap[keyword.toLowerCase()] ?? keyword;

export const diagnosticCodes = {
    undeclaredVariable: "senior.undeclaredVariable",
    reservedVariable: "senior.reservedVariable",
    invalidStringEscape: "senior.invalidStringEscape",
    missingSemicolon: "senior.missingSemicolon",
    missingColonInSql: "senior.missingColonInSql"
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

        const firstToken = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/i)?.[1]?.toLowerCase() ?? "";

        if (!trimmed.endsWith(";") && !noSemicolonKeywords.has(firstToken)) {
            diagnostics.push(createRangeDiagnostic(
                new vscode.Range(lineIndex, Math.max(line.lastIndexOf(trimmed), 0), lineIndex, line.length),
                "Cada execução de comando deve terminar com ';'.",
                vscode.DiagnosticSeverity.Warning,
                diagnosticCodes.missingSemicolon,
                { lineNumber: lineIndex }
            ));
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

            // Em Senior, variáveis número podem ser atribuídas sem definir
            // Apenas registrar como variável válida para verificação em SQL
            if (!reservedWords.has(normalized)) {
                declaredVariables.add(normalized);
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

        // Verificar SQL sem prefixo : em atribuições de .sql
        const sqlAssignmentMatch = trimmed.match(/\.\s*sql\s*=\s*"([^"]*)"/i);
        if (sqlAssignmentMatch) {
            const sqlContent = sqlAssignmentMatch[1];
            checkMissingColonInSql(sqlContent, lineIndex, line, declaredVariables, diagnostics, document);
        }
    }

    return diagnostics;
}

function checkMissingColonInSql(
    sqlContent: string,
    lineIndex: number,
    fullLine: string,
    declaredVariables: Set<string>,
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument
): void {
    // Encontrar todas as variáveis declaradas que aparecem no SQL sem prefixo :
    for (const variable of declaredVariables) {
        // Padrão: procurar a variável não precedida por : e não dentro de uma string literal
        // Usar word boundary para evitar falsos positivos
        const pattern = new RegExp(`(?<!:)\\b${escapeRegex(variable)}\\b`, "gi");
        let match: RegExpExecArray | null;
        
        while ((match = pattern.exec(sqlContent)) !== null) {
            const matchIndex = match.index;
            // Verificar se há um : logo antes (case case o regex não funcionou perfeitamente)
            if (matchIndex > 0 && sqlContent[matchIndex - 1] === ':') {
                continue;
            }
            
            const linePosition = fullLine.indexOf(sqlContent);
            if (linePosition === -1) continue;
            
            const absoluteCharPos = linePosition + matchIndex;
            
            diagnostics.push(createRangeDiagnostic(
                new vscode.Range(
                    lineIndex,
                    absoluteCharPos,
                    lineIndex,
                    absoluteCharPos + variable.length
                ),
                `Variável "${variable}" usada em SQL sem prefixo ':'. Digite ":${variable}" ao invés de "${variable}".`,
                vscode.DiagnosticSeverity.Error,
                diagnosticCodes.missingColonInSql,
                { varName: variable, lineNumber: lineIndex }
            ));
        }
    }
}

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
