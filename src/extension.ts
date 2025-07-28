import * as vscode from "vscode";

const reservedWords = new Set([
    "se", "senao", "enquanto", "para", "inicio", "fim", "funcao", "retorne",
    "mensagem", "cancelar", "continue", "vapara", "regra", "inserir",
    "execsql", "execsqlex", "abrir", "fechar", "proximo", "achou", "naoachou",
    "iniciartransacao", "finalizartransacao", "desfazertransacao",
    "numero", "alfa", "data", "grid", "tabela", "cursor",
    "valstr", "valret", "erro", "refaz", "retorna", "e", "ou"
]);

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection("senior");

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId !== "senior") return;

            const diagnostics = analyzeDocument(event.document);
            diagnosticCollection.set(event.document.uri, diagnostics);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("senior.createVariable", createVariableCommand)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("senior.fixBackslashes", fixBackslashesCommand)
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "senior",
            { provideCodeActions },
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );
}

// Analisa o documento para variáveis e strings inválidas
function analyzeDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);
    const declaredVariables = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Variáveis definidas
        const matchDef = line.match(/^definir\s+(?:alfa|data)\s+(\w+)/i);
        if (matchDef) {
            const varName = matchDef[1].toLowerCase();
            if (reservedWords.has(varName)) {
                diagnostics.push(createDiagnostic(i, line, `A variável "${varName}" usa uma palavra reservada da linguagem.`));
            } else {
                declaredVariables.add(varName);
            }
        }

        // Variáveis usadas sem definir
        const matchAssign = line.match(/^(\w+)\s*=\s*".*";?$/);
        if (matchAssign) {
            const varName = matchAssign[1].toLowerCase();
            if (!declaredVariables.has(varName)) {
                diagnostics.push(createDiagnostic(i, line, `A variável "${varName}" não foi definida com 'Definir'.`));
            }
        }

        // Strings com barras não escapadas
        const stringMatch = line.match(/"([^"]*\\[^"]*)"/g);
        if (stringMatch) {
            for (const rawString of stringMatch) {
                const content = rawString.slice(1, -1); // remove aspas
                const badEscape = /(^|[^\\])(\\)([^\\\/"])/g;
                if (badEscape.test(content)) {
                    diagnostics.push(createDiagnostic(i, line, `A string contém barras não escapadas corretamente.`));
                }
            }
        }
    }

    return diagnostics;
}

// Cria um objeto de diagnóstico
function createDiagnostic(lineIndex: number, lineText: string, message: string): vscode.Diagnostic {
    const range = new vscode.Range(lineIndex, 0, lineIndex, lineText.length);
    return new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
}

// Comando para criar variável no topo do arquivo
function createVariableCommand(document: vscode.TextDocument, varName: string) {
    const edit = new vscode.WorkspaceEdit();
    const insertText = `Definir Alfa ${varName};\n`;
    const position = new vscode.Position(0, 0);
    edit.insert(document.uri, position, insertText);
    vscode.workspace.applyEdit(edit);
}

// Comando para corrigir as barras invertidas
function fixBackslashesCommand(document: vscode.TextDocument, lineNumber: number) {
    const line = document.lineAt(lineNumber).text;
    const correctedLine = line.replace(/"([^"]*)"/g, (match) => {
        const raw = match.slice(1, -1); // remove aspas
        const escaped = raw.replace(/\\/g, "\\\\"); // duplica todas as barras
        return `"${escaped}"`;
    });

    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
    edit.replace(document.uri, range, correctedLine);
    vscode.workspace.applyEdit(edit);
}

// Sugestões de correção para os erros
function provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
): vscode.CodeAction[] | undefined {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
        const msg = diag.message;
        const lineNumber = range.start.line;

        if (msg.includes("não foi definida com 'Definir'")) {
            const varName = msg.match(/"(.+?)"/)?.[1];
            if (!varName) continue;

            const fix = new vscode.CodeAction(
                `Criar variável "${varName}"`,
                vscode.CodeActionKind.QuickFix
            );

            fix.command = {
                title: "Inserir declaração da variável",
                command: "senior.createVariable",
                arguments: [document, varName]
            };

            fix.diagnostics = [diag];
            fix.isPreferred = true;
            actions.push(fix);
        }

        if (msg.includes("barras não escapadas")) {
            const fix = new vscode.CodeAction(
                `Escapar barras da string`,
                vscode.CodeActionKind.QuickFix
            );

            fix.command = {
                title: "Corrigir barras",
                command: "senior.fixBackslashes",
                arguments: [document, lineNumber]
            };

            fix.diagnostics = [diag];
            fix.isPreferred = true;
            actions.push(fix);
        }
    }

    return actions;
}
