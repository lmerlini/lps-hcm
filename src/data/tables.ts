import { TableDefinition, TablesCatalog } from "../types";
import { mergeRelationshipMetadata, parseRelationshipsText, parseTablesText } from "./catalogParser";

declare function require(moduleName: string): any;

const fs = require("fs");
const path = require("path");

const tablesFileName = "src/data/tabelas.txt";
const relationshipsFileName = "src/data/relacionamentos.txt";

const fallbackTables: TableDefinition[] = [
    {
        name: "r034fun",
        description: "Cadastro de colaboradores",
        aliases: ["fun"],
        totalFields: 5,
        primaryKey: ["numemp", "tipcol", "numcad"],
        relationships: [],
        fields: {
            numemp: { tipo: "numero", obrigatorio: true, chave: true, descricao: "Numero da empresa" },
            tipcol: { tipo: "numero", obrigatorio: true, chave: true, descricao: "Tipo de colaborador" },
            numcad: { tipo: "numero", obrigatorio: true, chave: true, descricao: "Numero do cadastro" },
            nomfun: { tipo: "alfa", descricao: "Nome do colaborador" },
            datadm: { tipo: "data", descricao: "Data de admissao" }
        }
    },
    {
        name: "r034usu",
        description: "Usuarios do sistema",
        aliases: ["usu"],
        totalFields: 6,
        primaryKey: ["codusu"],
        relationships: [],
        fields: {
            codusu: { tipo: "numero", obrigatorio: true, chave: true, descricao: "Codigo do usuario" },
            crtusu: { tipo: "alfa", descricao: "Crachá ou criterio do usuario" },
            numcad: { tipo: "numero", obrigatorio: true, descricao: "Numero do cadastro do colaborador" },
            numdoc: { tipo: "alfa", descricao: "Numero do documento" },
            numemp: { tipo: "numero", obrigatorio: true, descricao: "Numero da empresa" },
            tipcol: { tipo: "numero", obrigatorio: true, descricao: "Tipo de colaborador" }
        }
    },
    {
        name: "r000adp",
        description: "Admissao Digital Pop-up",
        aliases: ["adp"],
        totalFields: 14,
        primaryKey: ["codusu"],
        relationships: [
            {
                name: "codusu",
                targetTable: "r999usu",
                sourceFields: ["codusu"],
                targetFields: ["codusu"],
                resultField: "nomusu"
            }
        ],
        fields: {
            codusu: {
                tipo: "numero",
                obrigatorio: true,
                chave: true,
                descricao: "Codigo do usuario",
                relationship: {
                    targetTable: "r999usu",
                    sourceFields: ["codusu"],
                    targetFields: ["codusu"],
                    resultField: "nomusu"
                }
            },
            nomusu: { tipo: "alfa", descricao: "Nome do usuario" },
            nomcom: { tipo: "alfa", descricao: "Nome completo" },
            numtel: { tipo: "alfa", descricao: "Numero do telefone" },
            emacom: { tipo: "alfa", descricao: "Endereco do correio eletronico" },
            nomemp: { tipo: "alfa", descricao: "Empresa" },
            codcli: { tipo: "numero", descricao: "Codigo cliente" },
            dathor: { tipo: "numero", obrigatorio: true, descricao: "Data e hora do registro" },
            datmos: { tipo: "data", descricao: "Data para mostrar novamente" },
            naomot: { tipo: "alfa", descricao: "Nao mostrar novamente" },
            cmpau1: { tipo: "data", descricao: "Campo auxiliar 1" },
            cmpau2: { tipo: "data", descricao: "Campo auxiliar 2" },
            cmpau3: { tipo: "alfa", descricao: "Campo auxiliar 3" },
            cmpau4: { tipo: "alfa", descricao: "Campo auxiliar 4" }
        }
    }
];

export function loadTableCatalog(basePath?: string): TablesCatalog {
    const tables = loadPreferredCatalog(basePath) ?? fallbackTables;
    const byName = new Map<string, TableDefinition>();
    const byAlias = new Map<string, TableDefinition>();

    for (const table of tables) {
        byName.set(table.name.toLowerCase(), table);

        for (const alias of table.aliases ?? []) {
            byAlias.set(alias.toLowerCase(), table);
        }
    }

    return { tables, byName, byAlias };
}

export function findTableByReference(catalog: TablesCatalog, reference: string): TableDefinition | undefined {
    const normalized = reference.trim().toLowerCase();
    return catalog.byAlias.get(normalized) ?? catalog.byName.get(normalized);
}

function loadPreferredCatalog(basePath?: string): TableDefinition[] | undefined {
    if (!basePath) {
        return undefined;
    }

    const tablesPath = path.join(basePath, tablesFileName);
    if (!fs.existsSync(tablesPath)) {
        return undefined;
    }

    const tablesText = fs.readFileSync(tablesPath, "utf8");
    const parsedTables = parseTablesText(tablesText);
    if (!parsedTables.length) {
        return undefined;
    }

    const relationshipsPath = path.join(basePath, relationshipsFileName);
    if (!fs.existsSync(relationshipsPath)) {
        return parsedTables;
    }

    const relationshipsText = fs.readFileSync(relationshipsPath, "utf8");
    return mergeRelationshipMetadata(parsedTables, parseRelationshipsText(relationshipsText));
}
