"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const tables_1 = require("./data/tables");
const seniorKnowledge_1 = require("./data/seniorKnowledge");
const codeActions_1 = require("./features/codeActions");
const completion_1 = require("./features/completion");
const hover_1 = require("./features/hover");
const signatureHelp_1 = require("./features/signatureHelp");
const diagnostics_1 = require("./features/diagnostics");
const formatter_1 = require("./features/formatter");
function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection("senior");
    const tableCatalog = (0, tables_1.loadTableCatalog)(context.extensionPath);
    const seniorKnowledge = (0, seniorKnowledge_1.loadSeniorKnowledge)(context.extensionPath);
    const refreshDiagnostics = (document) => {
        if (document.languageId !== "senior") {
            return;
        }
        diagnosticCollection.set(document.uri, (0, diagnostics_1.analyzeDocument)(document));
    };
    vscode.workspace.textDocuments.forEach(refreshDiagnostics);
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(refreshDiagnostics), vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)), vscode.workspace.onDidCloseTextDocument((document) => diagnosticCollection.delete(document.uri)));
    context.subscriptions.push(vscode.commands.registerCommand("senior.createVariable", codeActions_1.createVariableCommand), vscode.commands.registerCommand("senior.fixBackslashes", codeActions_1.fixBackslashesCommand));
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider("senior", new codeActions_1.SeniorCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }), vscode.languages.registerCompletionItemProvider("senior", new completion_1.SeniorCompletionProvider(tableCatalog, seniorKnowledge), ".", " ", "\""), vscode.languages.registerHoverProvider("senior", new hover_1.SeniorHoverProvider(tableCatalog, seniorKnowledge)), vscode.languages.registerSignatureHelpProvider("senior", new signatureHelp_1.SeniorSignatureHelpProvider(seniorKnowledge), { triggerCharacters: ["(", ","], retriggerCharacters: [","] }), vscode.languages.registerDocumentFormattingEditProvider("senior", new formatter_1.SeniorDocumentFormattingProvider()));
}
function deactivate() {
    // No-op: the extension keeps only disposables registered in the context.
}
//# sourceMappingURL=extension.js.map