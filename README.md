# Organizador de Finanças

Aplicação **local-first** para importar extratos bancários em CSV, consolidar transações com precisão financeira e gerar insights do dia a dia — tudo rodando no navegador, sem servidor, sem nuvem.

---

## Status do Projeto

| Fase | Status | Descrição |
|---|---|---|
| **0.1 — Engine de Dados** | ✅ Concluída — 172 testes verdes | Pipeline de importação, Money Pattern, fingerprinting, suíte de stress |
| **0.2 — Interface** | 🔄 Em andamento | Dashboard, upload, tabela de transações, cards de resumo |
| **0.3 — Insights** | ⬜ Pendente | Agrupamento de gastos, relatórios, exportação |

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS v4 + Framer Motion |
| Persistência | IndexedDB via Dexie (local-first, sem backend) |
| Parse de CSV | PapaParse |
| Testes | Vitest + fake-indexeddb |

---

## Capacidades da Engine (Fase 0.1)

### Importação Atômica

Cada importação de arquivo é executada dentro de uma única transação Dexie (`db.transaction('rw', [db.files, db.transactions], ...)`). **Ou tudo persiste, ou nada persiste.** Não existe estado parcialmente importado.

O pipeline completo em ordem:
1. **Parse** — PapaParse lê o CSV com detecção automática de delimitador (`,` `;` `\t`) e remove BOM UTF-8
2. **Normalização** — datas, valores monetários, contrapartes e descrições são padronizados
3. **Hash guard** — dentro da transação, verifica se o arquivo já foi importado (proteção contra race condition)
4. **Deduplicação** — fingerprints das transações do lote são comparados contra o banco; apenas registros novos passam
5. **Persistência** — `addFile` + `bulkAddTransactions` em uma única operação atômica

### Deduplicação Inteligente por Fingerprint

Cada transação recebe um `fingerprint` FNV-1a determinístico:

```
fingerprint = FNV-1a( utcDayTimestamp | amountInUnits | direction | description | sourceRowId )
```

- O `fingerprint` é o **primary key** da transação (`Transaction.id === Transaction.fingerprint`). Nunca é um ID autoincremental ou UUID aleatório.
- O `sourceRowId` (índice da linha no arquivo original) resolve o caso de dois cafés idênticos no mesmo dia: linhas diferentes → fingerprints diferentes → dois registros legítimos. Sem ele, o segundo café seria silenciosamente descartado.
- A deduplicação funciona **entre arquivos**: re-exportar o mesmo extrato com hash diferente não cria duplicatas.

### Precisão Decimal Crítica (Money Pattern)

JavaScript representa números em ponto flutuante IEEE 754, o que causa erros de representação:

```
19.99 × 100 = 1998.9999999999998  (não é 1999!)
 1.11 × 100 = 111.00000000000001  (não é 111!)
```

Para eliminar esse drift, **nenhum valor monetário é armazenado como float**. O sistema usa o Money Pattern:

```ts
amountInUnits = Math.round(floatValue * 10^precision)
// R$19,99 → 1999 centavos (inteiro exato)
// R$0,01  →    1 centavo  (inteiro exato)
```

Acumulado em 10.000 transações, o drift de float pode divergir em vários reais. Com `amountInUnits` inteiro, 1.000 somas de R$0,10 sempre resultam em exatamente R$100,00.

### Resiliência a Condições de Corrida

O guard de hash e a deduplicação por fingerprint são executados **dentro da mesma transação de escrita do IndexedDB**. O protocolo IDB serializa transações `readwrite`, tornando impossível que duas importações simultâneas do mesmo arquivo corrompam o banco:

- Uma importação vence e persiste normalmente
- A outra recebe o erro: `"O arquivo com hash X já foi importado."`
- O banco permanece com exatamente os dados da vencedora

Testado com `Promise.allSettled` em `stress.test.ts`.

### Segurança contra XSS por Construção

- `description` é armazenada como texto puro no IndexedDB — não é executável
- Na UI, é renderizada como JSX text node (React escapa HTML automaticamente, sem `dangerouslySetInnerHTML`)
- `descriptionNormalized` remove todos os caracteres não-alfanuméricos via `[^a-z0-9\s]`, eliminando `<`, `>`, `"`, `(`, `)` antes de armazenar — `<script>alert(1)</script>` vira `"script alert 1 script"`

### Exclusão em Cascata

Deletar um arquivo remove atomicamente o registro do arquivo **e todas as suas transações**:

```ts
await deleteFile(fileId)  // único caminho correto — ambas as operações em uma transação
```

Nunca se executa os dois deletes separadamente — a falha entre eles deixaria transações órfãs.

---

## Suíte de Testes (172 cenários)

```
src/normalization/amount.test.ts           → Money Pattern, drift IEEE 754, roundtrip float→centavos
src/normalization/date.test.ts             → Formatos, anos bissextos, UTC-midnight, fuso horário
src/normalization/counterparty.test.ts     → Normalização, stop terms, XSS, emoji, strings longas
src/domain/fingerprint.test.ts             → Determinismo, sensibilidade, formato fp_XXXXXXXX
src/importers/csv.utils.test.ts            → BOM, CRLF, tab, aspas, encoding, arquivos vazios
src/importers/inter.parser.test.ts         → Cabeçalho dinâmico, unicode, emoji, bankName, raw field
src/importers/nubank.parser.test.ts        → Schema, linhas curtas, BOM, unicode
src/db/repositories/files.repo.test.ts    → CRUD, cascade delete, vi.setSystemTime, isolamento
src/db/repositories/transactions.repo.test.ts → Bulk ops, dedup, findAll ordenado, clearAll
src/pipeline/import.pipeline.test.ts       → Pipeline end-to-end, XSS guard, atomicidade, idempotência,
                                             race condition, valores extremos (zero e R$1 bilhão)
src/pipeline/stress.test.ts               → 5.000 transações, 10 rodadas de dedup determinística,
                                             race conditions, unicode/emoji, float IEEE 754,
                                             delete+import simultâneos, 5 imports paralelos
```

Para rodar:

```bash
pnpm test         # executa a suíte completa (deve terminar com 172 passed)
pnpm test:watch   # modo watch para desenvolvimento
```

---

## Bancos Suportados

| Banco | Parser | Delimitador | Formato de Data |
|---|---|---|---|
| Banco Inter | `inter.parser.ts` | `;` | `dd/MM/yyyy` |
| Nubank | `nubank.parser.ts` | `,` | `dd/MM/yyyy` |
| Genérico | `generic.parser.ts` | Auto | Configurável |

---

## Privacidade

Nenhum dado sai do dispositivo. Não há backend, não há API, não há analytics de uso. Todos os extratos são processados e armazenados exclusivamente no IndexedDB do navegador.
