# LSP Senior Highlight — guia para IAs

Extensão VS Code que provê realce, completion, hover, signature help, diagnósticos
e formatação para a **Linguagem Senior de Programação (LSP)** usada no Senior HCM.

## Estrutura

- `src/extension.ts` — ativação da extensão e registro dos providers/comandos.
- `src/features/` — providers do VS Code:
  - `completion.ts`, `hover.ts`, `signatureHelp.ts` — usam o catálogo de funções/variáveis/tabelas.
  - `diagnostics.ts` — análise estática (consistências sintáticas).
  - `codeActions.ts` — quick fixes (criar variável, corrigir barras).
  - `formatter.ts` — formatador de documento.
  - `exportKnowledge.ts` — comando que exporta o catálogo como Markdown para uso por IAs.
- `src/data/` — base de conhecimento da linguagem Senior:
  - `senior_funcoes.json` — funções nativas (nome, família, assinaturas, parâmetros, retorno, exemplos).
  - `senior_variaveis.json` — variáveis globais por categoria.
  - `tabelas.txt` — definições das tabelas do banco Senior HCM.
  - `relacionamentos.txt` — relacionamentos entre tabelas.
  - `seniorKnowledge.ts` / `tables.ts` / `catalogParser.ts` — loaders e parsers.
- `src/types.ts` — tipos compartilhados (`SeniorFuncao`, `SeniorVariavel`, `TableDefinition`, etc.).
- `syntaxes/senior.tmLanguage.json` — gramática TextMate.
- `snippets/senior.json` — snippets do editor.

## Como obter o conhecimento da linguagem

Os arquivos em `src/data/` são grandes (~80k linhas só de funções). Para alimentar
uma IA com esse contexto:

1. Rodar o comando **"Senior: Exportar conhecimento (funções, variáveis, tabelas) para IA"**
   no VS Code. Ele gera um `senior-context.md` resumido (1 linha por função/variável,
   tabelas com campos e relacionamentos) que pode ser anexado a uma conversa.
2. Alternativamente, ler diretamente os JSONs em `src/data/` — o esquema está em `src/types.ts`.

## Convenções

- Linguagem da UI/comentários: **PT-BR**.
- Identificadores de código permanecem no original.
- Build: `npm run compile` (TypeScript → `dist/`).
- Testes: `npm test`.
