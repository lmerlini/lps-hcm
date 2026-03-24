const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

Module._load = function mockVscode(request, parent, isMain) {
    if (request === "vscode") {
        return {
            Range: class Range {
                constructor(startLine, startCharacter, endLine, endCharacter) {
                    this.start = { line: startLine, character: startCharacter };
                    this.end = { line: endLine, character: endCharacter };
                }
            },
            Diagnostic: class Diagnostic {
                constructor(range, message, severity) {
                    this.range = range;
                    this.message = message;
                    this.severity = severity;
                }
            },
            DiagnosticSeverity: {
                Error: 0,
                Warning: 1
            },
            CompletionItem: class CompletionItem {
                constructor(label, kind) {
                    this.label = label;
                    this.kind = kind;
                }
            },
            CompletionItemKind: {
                Keyword: 14,
                Struct: 22,
                Field: 5,
                TypeParameter: 25
            }
        };
    }

    return originalLoad(request, parent, isMain);
};

const { loadTableCatalog } = require("../dist/data/tables");
const { mergeRelationshipMetadata, parseRelationshipsText, parseTablesText } = require("../dist/data/catalogParser");
const { inferCompletionContext } = require("../dist/features/completion");
const { analyzeDocument } = require("../dist/features/diagnostics");

function createDocument(lines) {
    return {
        languageId: "senior",
        lineCount: lines.length,
        lineAt(index) {
            return {
                text: lines[index],
                range: {
                    start: { line: index, character: 0 },
                    end: { line: index, character: lines[index].length }
                }
            };
        },
        getText() {
            return lines.join("\n");
        }
    };
}

function runTest(name, fn) {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}

runTest("loadTableCatalog normalizes tables and aliases", () => {
    const catalog = loadTableCatalog();

    assert.ok(catalog.byName.has("R034FUN"));
    assert.equal(catalog.byAlias.get("FUN")?.name, "R034FUN");
});

runTest("parseTablesText reads metadata from TABLES format", () => {
    const sample = [
        "---------------------",
        "Tabela: R000ADP - Admissao Digital Pop-up",
        "",
        "Total de campos: 2 ",
        "Coluna\tObrigatorio\tTipo\t\tDescricao",
        "CodUsu\tSim\t\tNumber(009,0)\tCodigo do Usuario",
        "NomUsu\tNao\t\tString(080)\tNome do Usuario",
        "",
        "Chave primária: CP_R000ADP [CodUsu]"
    ].join("\n");

    const tables = parseTablesText(sample);

    assert.equal(tables.length, 1);
    assert.equal(tables[0].name, "R000ADP");
    assert.equal(tables[0].primaryKey?.[0], "CODUSU");
    assert.equal(tables[0].fields.CODUSU.tipo, "numero");
    assert.equal(tables[0].fields.CODUSU.obrigatorio, true);
});

runTest("mergeRelationshipMetadata enriches fields with relationships", () => {
    const tables = parseTablesText([
        "---------------------",
        "Tabela: R000ADP - Admissao Digital Pop-up",
        "",
        "Total de campos: 2 ",
        "Coluna\tObrigatorio\tTipo\t\tDescricao",
        "CodUsu\tSim\t\tNumber(009,0)\tCodigo do Usuario",
        "NomUsu\tNao\t\tString(080)\tNome do Usuario",
        "",
        "Chave primária: CP_R000ADP [CodUsu]"
    ].join("\n"));

    const relationships = parseRelationshipsText([
        "Tabela: R000ADP - Campo: CodUsu  -  Tabela destino: R999USU",
        "Campos origem: CodUsu  -  Campos: destino: CodUsu",
        "Campo Resultante: NomUsu"
    ].join("\n"));

    const merged = mergeRelationshipMetadata(tables, relationships);

    assert.equal(merged[0].fields.CODUSU.relationship?.targetTable, "R999USU");
    assert.equal(merged[0].fields.CODUSU.relationship?.resultField, "NomUsu");
});

runTest("inferCompletionContext suggests types after definir", () => {
    const catalog = loadTableCatalog();
    const document = createDocument(["Definir "]);
    const context = inferCompletionContext(document, { line: 0, character: 8 }, catalog);

    assert.equal(context.kind, "types");
});

runTest("inferCompletionContext resolves fields from alias", () => {
    const catalog = loadTableCatalog();
    const document = createDocument([
        "cur.sql = \"SELECT FUN.",
        "FROM R034FUN FUN\";"
    ]);
    const context = inferCompletionContext(document, { line: 0, character: 22 }, catalog);

    assert.equal(context.kind, "fields");
    assert.equal(context.table?.name, "R034FUN");
});

runTest("provideCompletionItems returns camelCase keyword items", () => {
    const catalog = loadTableCatalog();
    const Completion = require("../dist/features/completion").SeniorCompletionProvider;
    const provider = new Completion(catalog);
    const document = createDocument([""]);

    const completions = provider.provideCompletionItems(document, { line: 0, character: 0 });
    const labels = completions.map((item) => item.label);

    assert.ok(labels.includes("naoAchou"));
    assert.ok(labels.includes("iniciarTransacao"));
    assert.ok(labels.includes("execSql"));
});

runTest("analyzeDocument flags undeclared variables and ignores declared ones", () => {
    const document = createDocument([
        "Definir Alfa nome;",
        "nome = \"ok\";",
        "codigo = \"novo\";"
    ]);

    const diagnostics = analyzeDocument(document);
    const messages = diagnostics.map((diagnostic) => diagnostic.message);

    assert.equal(messages.some((message) => message.includes("\"nome\"")), false);
    assert.equal(messages.some((message) => message.includes("\"codigo\"")), true);
});
