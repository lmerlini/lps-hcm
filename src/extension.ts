import * as vscode from "vscode";
import { loadTableCatalog } from "./data/tables";
import { SeniorCodeActionProvider, createVariableCommand, fixBackslashesCommand } from "./features/codeActions";
import { SeniorCompletionProvider } from "./features/completion";
import { analyzeDocument } from "./features/diagnostics";

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection("senior");
    const tableCatalog = loadTableCatalog(context.extensionPath);

    const refreshDiagnostics = (document: vscode.TextDocument) => {
        if (document.languageId !== "senior") {
            return;
        }

        diagnosticCollection.set(document.uri, analyzeDocument(document));
    };

    vscode.workspace.textDocuments.forEach(refreshDiagnostics);

    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
        vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
        vscode.workspace.onDidCloseTextDocument((document) => diagnosticCollection.delete(document.uri))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("senior.createVariable", createVariableCommand),
        vscode.commands.registerCommand("senior.fixBackslashes", fixBackslashesCommand)
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "senior",
            new SeniorCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        ),
        vscode.languages.registerCompletionItemProvider(
            "senior",
            new SeniorCompletionProvider(tableCatalog),
            ".", " ", "\""
        )
    );
}

export function deactivate() {
    // No-op: the extension keeps only disposables registered in the context.
}
