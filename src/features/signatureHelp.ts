import * as vscode from "vscode";
import { SeniorKnowledgeBase } from "../types";

export class SeniorSignatureHelpProvider implements vscode.SignatureHelpProvider {
    constructor(private readonly knowledge: SeniorKnowledgeBase) {}

    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.SignatureHelp | undefined {
        const call = findCallContext(document, position);
        if (!call) {
            return undefined;
        }

        const fn = this.knowledge.funcByName.get(call.funcName.toLowerCase());
        if (!fn || !fn.assinaturas?.length) {
            return undefined;
        }

        const help = new vscode.SignatureHelp();
        help.activeParameter = call.paramIndex;

        for (const sig of fn.assinaturas) {
            const info = new vscode.SignatureInformation(sig);
            info.documentation = new vscode.MarkdownString(
                fn.descricao && fn.descricao !== fn.nome ? fn.descricao : ""
            );

            if (fn.parametros?.length) {
                for (const p of fn.parametros) {
                    const desc = p.descricao ? `${p.descricao}` : "";
                    info.parameters.push(
                        new vscode.ParameterInformation(p.nome, new vscode.MarkdownString(`\`${p.tipo}\` ${desc}`))
                    );
                }
            }

            help.signatures.push(info);
        }

        help.activeSignature = 0;
        return help;
    }
}

interface CallContext {
    funcName: string;
    paramIndex: number;
}

function findCallContext(document: vscode.TextDocument, position: vscode.Position): CallContext | undefined {
    const lineText = document.lineAt(position.line).text;
    const textUpToCursor = lineText.slice(0, position.character);

    let depth = 0;
    let commaCount = 0;
    let parenStart = -1;

    for (let i = textUpToCursor.length - 1; i >= 0; i--) {
        const ch = textUpToCursor[i];
        if (ch === ")") {
            depth++;
        } else if (ch === "(") {
            if (depth > 0) {
                depth--;
            } else {
                parenStart = i;
                break;
            }
        } else if (ch === "," && depth === 0) {
            commaCount++;
        }
    }

    if (parenStart < 0) {
        return undefined;
    }

    const before = textUpToCursor.slice(0, parenStart);
    const funcMatch = before.match(/([A-Za-z_]\w*)\s*$/);
    if (!funcMatch) {
        return undefined;
    }

    return {
        funcName: funcMatch[1],
        paramIndex: commaCount
    };
}
