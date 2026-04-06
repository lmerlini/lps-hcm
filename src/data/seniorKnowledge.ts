import { SeniorFuncao, SeniorVariavel, SeniorKnowledgeBase } from "../types";

declare function require(moduleName: string): any;

const fs = require("fs");
const path = require("path");

const funcoesFileName = "src/data/senior_funcoes.json";
const variaveisFileName = "src/data/senior_variaveis.json";

export function loadSeniorKnowledge(basePath: string): SeniorKnowledgeBase {
    const funcoes = loadJson<SeniorFuncao[]>(basePath, funcoesFileName) ?? [];
    const variaveis = loadJson<SeniorVariavel[]>(basePath, variaveisFileName) ?? [];

    const funcByName = new Map<string, SeniorFuncao>();
    for (const fn of funcoes) {
        if (fn.nome) {
            funcByName.set(fn.nome.toLowerCase(), fn);
        }
    }

    const varByName = new Map<string, SeniorVariavel>();
    for (const v of variaveis) {
        if (v.nome) {
            varByName.set(v.nome.toLowerCase(), v);
        }
    }

    return { funcoes, variaveis, funcByName, varByName };
}

function loadJson<T>(basePath: string, relativePath: string): T | undefined {
    const fullPath = path.join(basePath, relativePath);
    if (!fs.existsSync(fullPath)) {
        return undefined;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(content);
}
