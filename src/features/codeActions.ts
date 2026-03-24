import * as vscode from "vscode";
import { diagnosticCodes, SeniorDiagnosticData } from "./diagnostics";

type DiagnosticWithData = vscode.Diagnostic & { data?: SeniorDiagnosticData };

export async function createVariableCommand(document: vscode.TextDocument, varName: string) {
    const edit = buildCreateVariableEdit(document, varName);
    await vscode.workspace.applyEdit(edit);
}

export async function fixBackslashesCommand(document: vscode.TextDocument, lineNumber: number) {
    const edit = buildFixBackslashesEdit(document, lineNumber);
    await vscode.workspace.applyEdit(edit);
}

export class SeniorCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.code === diagnosticCodes.undeclaredVariable) {
                const data = (diagnostic as DiagnosticWithData).data;
                if (!data?.varName) {
                    continue;
                }

                const action = new vscode.CodeAction(
                    `Criar variavel "${data.varName}"`,
                    vscode.CodeActionKind.QuickFix
                );
                action.edit = buildCreateVariableEdit(document, data.varName);
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            }

            if (diagnostic.code === diagnosticCodes.invalidStringEscape) {
                const data = (diagnostic as DiagnosticWithData).data;
                if (typeof data?.lineNumber !== "number") {
                    continue;
                }

                const action = new vscode.CodeAction(
                    "Escapar barras da string",
                    vscode.CodeActionKind.QuickFix
                );
                action.edit = buildFixBackslashesEdit(document, data.lineNumber);
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            }
        }

        return actions;
    }
}

function buildCreateVariableEdit(document: vscode.TextDocument, varName: string): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const insertLine = findDefinitionInsertLine(document);
    const insertText = `Definir Alfa ${varName};\n`;
    edit.insert(document.uri, new vscode.Position(insertLine, 0), insertText);
    return edit;
}

function buildFixBackslashesEdit(document: vscode.TextDocument, lineNumber: number): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(lineNumber).text;
    const correctedLine = line.replace(/"([^"\\]|\\.)*"/g, (match) => {
        const raw = match.slice(1, -1);
        const escaped = raw.replace(/\\/g, "\\\\");
        return `"${escaped}"`;
    });

    edit.replace(document.uri, document.lineAt(lineNumber).range, correctedLine);
    return edit;
}

function findDefinitionInsertLine(document: vscode.TextDocument): number {
    let firstCodeLine = 0;
    let lastDefinitionLine = -1;

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const text = document.lineAt(lineIndex).text.trim();

        if (!text) {
            if (lastDefinitionLine >= 0) {
                return lastDefinitionLine + 1;
            }
            continue;
        }

        if (text.startsWith("@") || text.startsWith("/*")) {
            firstCodeLine = lineIndex + 1;
            continue;
        }

        if (/^definir\b/i.test(text)) {
            lastDefinitionLine = lineIndex;
            continue;
        }

        return lastDefinitionLine >= 0 ? lastDefinitionLine + 1 : firstCodeLine;
    }

    return lastDefinitionLine >= 0 ? lastDefinitionLine + 1 : firstCodeLine;
}
