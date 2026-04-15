# CLAUDE.md — Organizador de Finanças

Guia de sobrevivência para Claude Code neste repositório.
Aplicação **local-first** focada em privacidade e integridade de dados financeiros.

---

## Status da Fase

| Fase | Status | Descrição |
|---|---|---|
| **0.1 — Engine** | ✅ Concluída | Pipeline de importação, Money Pattern, fingerprinting, 172 testes verdes |
| **0.2 — UI** | 🔄 Em andamento | Interface React + Tailwind v4 + Framer Motion, hooks de dados, analytics |
| **0.3 — Insights** | ⬜ Pendente | Agrupamento de gastos, relatórios, exportação |

**Próximo foco:** Fase 0.2 — construir a interface de usuário consumindo a engine já blindada.
Stack da UI: React 18 + TypeScript + Tailwind CSS v4 + Framer Motion. Componentes de UI base: Shadcn/ui (quando necessário). Dados via hooks com `useLiveQuery` (Dexie React Hooks).

---

## Fronteiras de Escrita (LEIA ANTES DE QUALQUER EDIÇÃO)

### Diretórios READ-ONLY
```
src/domain/        ← tipos, constantes, fingerprint
src/db/            ← schema Dexie, repositórios
src/normalization/ ← amount, date, description, counterparty
src/pipeline/      ← import.pipeline.ts (o maestro)
src/importers/     ← parsers por banco (inter, nubank, generic)
```
**Regra:** NUNCA altere lógica de cálculo, schema do DB ou o pipeline de importação sem ordem explícita do usuário. Qualquer mudança aqui pode corromper dados históricos silenciosamente.

### Diretórios WRITE-PERMITTED
```
src/components/    ← componentes React
src/pages/         ← páginas / rotas
src/hooks/         ← React hooks para consumir dados
src/analytics/     ← funções puras de análise (summary, insights)
src/utils/         ← utilitários de display (money.ts, formatters)
```
**Regra:** Seu papel principal é construir a UI, os hooks de dados e as funções de analytics. Nunca acesse o Dexie diretamente de um componente — use hooks.

---

## Comandos

```bash
pnpm dev          # inicia o servidor de desenvolvimento (Vite)
pnpm build        # tsc + vite build (verifica tipos + gera bundle)
pnpm test         # executa a suíte completa uma vez (vitest run)
pnpm test:watch   # modo watch para desenvolvimento de testes
```

### Regra de Ouro sobre testes

**Antes de qualquer commit que toque em `src/pipeline/`, `src/domain/`, `src/db/` ou `src/normalization/`:**

```bash
pnpm test   # todos os 172 testes DEVEM continuar verdes
```

Se algum teste quebrar, **não faça o commit**. Investigue e corrija a raiz do problema. Os testes de stress (`stress.test.ts`) cobrem atomicidade, race conditions e precisão de centavos — uma falha ali indica corrupção potencial de dados reais.

---

## Fluxo de Dados

```
Arquivo CSV
  → csv.utils.ts           (parse raw via PapaParse — stripBom, skipEmptyLines)
  → parser por banco        (inter/nubank/generic → StructuredImportTransaction[])
  → import.pipeline.ts      (normalize → deduplicate → persist atômico)
  → IndexedDB (Dexie)
  → hooks (useTransactions, useFiles, useTransactionRepository, ...)
  → React UI
```

**Camadas-chave:**

| Camada | Arquivo(s) | Responsabilidade |
|---|---|---|
| Tipos do domínio | `src/domain/types.ts` | Todos os tipos compartilhados |
| Constantes | `src/domain/constants.ts` | Stop terms, own-transfer terms |
| Fingerprinting | `src/domain/fingerprint.ts` | Chaves de dedup determinísticas |
| Normalização | `src/normalization/` | amount, date, description, counterparty |
| CSV utils | `src/importers/csv.utils.ts` | Parse raw, stripBom, headers |
| Parsers | `src/importers/` | Um arquivo por banco → `StructuredImportTransaction[]` |
| Pipeline | `src/pipeline/import.pipeline.ts` | Orquestra normalize + dedup + write |
| Repositórios | `src/db/repositories/` | Acesso tipado ao Dexie — nunca use `db` diretamente na UI |
| Hooks | `src/hooks/` | `useLiveQuery` + lógica de estado para a UI |
| Analytics | `src/analytics/` | Funções puras: `summary.ts`, `counterparties.ts`, `insights.ts` |

---

## Regras de Ouro do Domínio

### 1. Como adicionar novas transações (SEMPRE via pipeline)

**Nunca insira transações diretamente no Dexie de fora do pipeline.**
A única forma correta de persistir transações é via `runImportPipeline`:

```ts
// ✅ CORRETO — atomicidade, deduplicação, hash guard, fingerprint garantidos
const result = await runImportPipeline({ file, transactions })

// ❌ ERRADO — bypassa dedup, hash guard, possibilita duplicatas e IDs inválidos
await db.transactions.add({ id: 'meu-id', ... })
```

`runImportPipeline` garante:
- Hash guard dentro da transação (proteção contra race condition)
- Deduplicação por fingerprint
- `id === fingerprint` (content-addressed primary key)
- Rollback automático se qualquer etapa falhar

### 2. Money Pattern — Precisão de Centavos (CRÍTICO)

**NUNCA armazene valores monetários como float.**

```ts
// ❌ PROIBIDO — 0.1 + 0.2 = 0.30000000000000004 em JS
transaction.amount = 19.99

// ✅ CORRETO — inteiro exato em centavos, sem drift binário
transaction.amountInUnits = Math.round(19.99 * 100)  // → 1999
```

| Campo | Tipo | Regra |
|---|---|---|
| `amountInUnits` | `number` (inteiro positivo) | Sempre em centavos. `Math.round(float * 10^precision)` |
| `currency` | `string` ISO 4217 | `'BRL'` para Inter/Nubank. NUNCA some moedas diferentes |
| `precision` | `number` | `2` para BRL/USD, `0` para JPY, `3` para KWD |

**Helpers em `src/utils/money.ts`:**
```ts
toUnits(float, precision)       // CSV float → inteiro centavos (use nos parsers)
formatMoney(units, currency)    // Intl.NumberFormat para display na UI
toDisplay(units, precision)     // String decimal para logs/export
add(m1, m2)                     // Soma segura que valida moeda e precisão
```

Provas de precisão: `amount.test.ts` e `stress.test.ts` (seção 10) cobrem R$0,01, R$19,99, R$1,11, R$2,22 e R$1 bilhão.

### 3. Fingerprint e ID de Transação

```
fingerprint = FNV-1a( utcDayTimestamp | amountInUnits | direction | description | sourceRowId )
id          = fingerprint   ← SEMPRE. Nunca outro valor.
```

- `Transaction.id` **deve** ser igual a `Transaction.fingerprint`. É o primary key content-addressed do IndexedDB.
- `sourceRowId` é obrigatório no fingerprint: dois cafés de R$5,00 no mesmo dia têm `sourceRowId` diferentes → fingerprints diferentes → dois registros legítimos.
- Sem `sourceRowId`, o segundo café seria silenciosamente descartado como duplicata.

### 4. Exclusão em Cascata

```ts
// ✅ ÚNICO caminho correto — atômico, sem resíduos
await deleteFile(fileId)  // de src/db/repositories/files.repo.ts

// ❌ PROIBIDO — deixa transações órfãs se uma das operações falhar
await db.files.delete(fileId)
await db.transactions.where('fileId').equals(fileId).delete()
```

`deleteFile` executa ambos os deletes dentro de `db.transaction('rw', [db.files, db.transactions], ...)`.

### 5. Dois campos de descrição com propósitos distintos

| Campo | Gerado por | Remove | Mantém | Uso |
|---|---|---|---|---|
| `description` | Parser (raw) | Nada | Tudo, incluindo emoji e códigos | Fingerprint, armazenamento, display |
| `descriptionNormalized` | `normalizeDescription()` | Emoji, 3+ dígitos, `[^a-z0-9\s]` | Palavras-chave do estabelecimento | Clustering, insights, busca |

```
"PADARIA ALFA 123456"  →  descriptionNormalized: "padaria alfa"
"Padaria Alfa 789012"  →  descriptionNormalized: "padaria alfa"  ← mesmo cluster
                       →  fingerprints DIFERENTES (sourceRowId e código distintos)
```

### 6. Segurança por Construção

- **XSS:** `description` vai para IndexedDB como string inerte. Na UI, é renderizada como JSX text node (React escapa automaticamente). `descriptionNormalized` remove `<>()` via `[^a-z0-9\s]`.
- **Race Condition:** hash guard e deduplicação ficam DENTRO da `db.transaction('rw', ...)`. Uma verificação fora da transação não é um guard.
- **Float drift:** `Math.round` no pipeline garante que mesmo `1.11 × 100 = 111.00000000000001` vira `111`.

---

## Invariantes do Domínio (NÃO QUEBRE)

1. `Transaction.amountInUnits` — inteiro positivo. Direction `'in' | 'out'` carrega o sinal financeiro.
2. `Transaction.id === Transaction.fingerprint` — sempre. Nunca use row-id do parser como id.
3. Todo write em `runImportPipeline` DEVE estar dentro de `db.transaction('rw', [db.files, db.transactions], ...)`.
4. `runImportPipeline` DEVE retornar `{ fileId, totalCount, newCount, duplicateCount }` — nunca simplifique.
5. `deleteFile(fileId)` é o ÚNICO caminho correto para remover um arquivo e suas transações.
6. Datas armazenadas como timestamp UTC-meia-noite (`dateTs`) e string ISO (`date: 'yyyy-MM-dd'`).
7. `ownTransfer` segue heurística conservadora: prefira `undefined` a `false` quando a confiança for baixa.
8. `descriptionNormalized` gerado por `normalizeDescription()` — nunca hardcode, nunca omita.
9. `sourceRowId` obrigatório em todo novo `Transaction` — campo mandatório desde v0.2.

---

## Diretrizes de UI/UX e Código (Fase 0.2)

- **Tailwind CSS v4** — design tokens em `@theme` no `index.css` (não em `tailwind.config.js`)
- **Framer Motion** — `AnimatePresence` para toasts, `spring` para cards, `layout` para listas
- **`@tanstack/react-virtual`** — virtualizar listas com mais de 100 transações (`ROW_HEIGHT = 44px`)
- **React.memo** — componentes de linha de tabela (`TransactionRow`, `SummaryCard`)
- **TypeScript estrito** — sem `any`. Todos os tipos de domínio em `src/domain/types.ts`
- **Componentes funcionais com hooks** — nunca classes
- **Loading states e empty states** — obrigatórios em todo componente que lê dados assíncronos
- **Nunca acesse `db` diretamente em componentes** — use os hooks de repositório

### Hook pattern correto

```ts
// ✅ Componente consome apenas o hook
const { transactions, summary, deleteByFile } = useTransactionRepository()

// ❌ Componente acessa Dexie diretamente
const txs = await db.transactions.toArray()
```

---

## Documentação Técnica

- `docs/testes.md` — Arquitetura dos 172 testes: Money Pattern, Unicode/XSS, Race Conditions, Atomicidade, Cascade Delete. **Leia antes de adicionar testes.**
- `docs/arquitetura-consolidada-v0.1.md` — Decisões de arquitetura da Fase 0.1 com justificativas.
- `docs/requisitos_finais_v0.1.md` — Requisitos funcionais e não-funcionais definidos.
