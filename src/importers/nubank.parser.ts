import { nanoid } from 'nanoid';
import type { StructuredImportTransaction } from '../pipeline/import.pipeline';
import { parseCsvText } from './csv.utils';

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
      id: nanoid(),
      date: row[0].trim(),
      amount: row[1].trim(),
      description: row[3].trim(),
      bankName: 'Nubank',
      raw: {
        linhaOriginal: row.join(','),
        indexNoArquivo: index + 1, // +1 porque pulamos o header
        arquivoFonte: fileName
      }
    }));
}