import { nanoid } from 'nanoid';
import type { StructuredImportTransaction } from '../pipeline/import.pipeline';
import { parseCsvText, sanitizeCounterparty } from './csv.utils';

export function parseNubankCsv(csvText: string, fileName?: string): StructuredImportTransaction[] {
  const { rows, errors } = parseCsvText(csvText);
  
  if (errors.length > 0) {
    console.error(`[Nubank Parser] CSV Errors in ${fileName}:`, errors);
  }

  // Nubank Schema: Data, Valor, Identificador, Descrição
  return rows
    .slice(1) // Pula o cabeçalho
    .filter(row => row.length >= 4 && row[0] && row[1]) // Filtro defensivo
    .map((row, index) => ({
      id:        nanoid(),
      date:      row[0].trim(),
      amount:    row[1].trim(),
      direction: (Number(row[1].trim()) < 0 ? 'out' : 'in') as 'in' | 'out',
      description:  row[3].trim(),
      // Extrai só o nome da pessoa/estabelecimento, descartando prefixo de tipo e CPF/banco
      counterparty: sanitizeCounterparty(row[3]),
      bankName: 'Nubank',
      raw: {
        linhaOriginal: row.join(','),
        indexNoArquivo: index + 1,
        arquivoFonte: fileName
      } as unknown as Record<string, string>
    }));
}