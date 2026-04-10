import { nanoid } from 'nanoid';
import type { StructuredImportTransaction } from '../pipeline/import.pipeline';
import { parseCsvText, sanitizeDescription } from './csv.utils';

/**
 * Parser específico para o Banco Inter.
 * Lida com delimitadores ';' e limpa metadados iniciais (linhas de saldo/conta).
 */
export function parseInterCsv(csvText: string, fileName?: string): StructuredImportTransaction[] {
  const { rows } = parseCsvText(csvText);

  // Localização dinâmica do cabeçalho para ignorar metadados do topo do arquivo (Robustez P-01)
  const headerIndex = rows.findIndex(r => 
    r.some(c => c?.toLowerCase().includes('data lançamento'))
  );

  if (headerIndex === -1) {
    throw new Error(`[Inter Parser] Cabeçalho não encontrado no arquivo: ${fileName}`);
  }

  // Mapeamento de índices para garantir resiliência caso o banco altere a ordem das colunas
  const headers = rows[headerIndex].map(h => h.toLowerCase().trim());
  const col = {
    date: headers.indexOf('data lançamento'),
    history: headers.indexOf('histórico'),
    description: headers.indexOf('descrição'),
    amount: headers.indexOf('valor')
  };

  return rows
    .slice(headerIndex + 1)
    .filter(row => row[col.date] && row[col.amount]) // Evita processar linhas de rodapé ou vazias
    .map((row, index) => ({
      id: nanoid(),
      date: row[col.date].trim(),
      amount: row[col.amount].trim(),
      // Concatena histórico e descrição removendo espaços duplicados para um fingerprint consistente
      description: sanitizeDescription(`${row[col.history] || ''} ${row[col.description] || ''}`),
      bankName: 'Inter',
      raw: {
        linhaOriginal: row.join(';'),
        indexNoArquivo: headerIndex + index + 1,
        arquivoFonte: fileName
      }
    }));
}