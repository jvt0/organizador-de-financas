import { nanoid } from 'nanoid';
import type { StructuredImportTransaction } from '../pipeline/import.pipeline';
import { parseCsvText, sanitizeCounterparty, sanitizeDescription } from './csv.utils';

/**
 * Parser específico para o Banco Inter.
 *
 * Estratégia de pré-processamento:
 *   1. Fatia a string bruta para encontrar o cabeçalho real antes de passar ao PapaParse —
 *      evita que metadados do topo (Extrato, Conta, Saldo…) confundam o mapeamento de colunas.
 *   2. Sanitiza valores PT-BR (ex: "1.900,00" → "1900.00") antes de entregar ao pipeline.
 *   3. Descarta silenciosamente qualquer linha com valor não-numérico (gatekeeper NaN).
 */
export function parseInterCsv(csvText: string, fileName?: string): StructuredImportTransaction[] {
  // Etapa 1: isola o cabeçalho real na string bruta
  const lines = csvText.split('\n');
  const headerIdx = lines.findIndex(l => l.toLowerCase().includes('data lan'));

  if (headerIdx === -1) {
    throw new Error(`[Inter Parser] Cabeçalho não encontrado no arquivo: ${fileName}`);
  }

  // Fatia para que o PapaParse receba apenas header + dados, sem metadados
  const cleanCsvString = lines.slice(headerIdx).join('\n');
  const { rows } = parseCsvText(cleanCsvString);

  // rows[0] é o cabeçalho; mapeamento de índices para resiliência a reordenação de colunas
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const col = {
    date:        headers.indexOf('data lançamento'),
    history:     headers.indexOf('histórico'),
    description: headers.indexOf('descrição'),
    amount:      headers.indexOf('valor'),
  };

  return rows
    .slice(1)
    .flatMap((row, index) => {
      // Etapa 2: sanitização monetária PT-BR → float string JS-padrão
      const rawAmount = row[col.amount]?.trim() ?? '';
      const cleanVal  = String(rawAmount).replace(/\./g, '').replace(',', '.');
      const amount    = Number(cleanVal);

      // Etapa 3: gatekeeper — descarta silenciosamente registros inválidos
      if (Number.isNaN(amount) || cleanVal === '' || !row[col.date]?.trim()) return [];

      return [{
        id:        nanoid(),
        date:      row[col.date].trim(),
        amount:    cleanVal,
        direction: amount < 0 ? 'out' : 'in',
        // Concatena histórico + descrição removendo espaços duplicados (fingerprint consistente)
        description:  sanitizeDescription(`${row[col.history] || ''} ${row[col.description] || ''}`),
        // Descrição já contém só o nome da pessoa/estabelecimento no Inter
        counterparty: sanitizeCounterparty(row[col.description]),
        bankName: 'Inter',
        raw: {
          linhaOriginal:   row.join(';'),
          indexNoArquivo:  headerIdx + index + 1,
          arquivoFonte:    fileName,
        } as unknown as Record<string, string>,
      }];
    });
}
