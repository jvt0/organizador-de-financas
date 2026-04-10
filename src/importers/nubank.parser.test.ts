import { describe, it, expect } from 'vitest';
import { parseNubankCsv } from './nubank.parser';

describe('Nubank Parser', () => {
  it('deve extrair transações de um CSV padrão do Nubank', () => {
    const csvNubank = `Data,Valor,Identificador,Descrição
01/08/2025,240.00,id-123,Transferência Recebida - Thiago
01/08/2025,-40.00,id-456,Transferência enviada pelo Pix - Cayo`;

    const result = parseNubankCsv(csvNubank, 'nu_teste.csv');

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe('240.00');
    expect(result[1].amount).toBe('-40.00');
    expect(result[1].description).toContain('Pix - Cayo');
  });

  it('deve ser resiliente a linhas vazias ou incompletas', () => {
    const csvComBuracos = `Data,Valor,Identificador,Descrição
01/08/2025,10.00,id-1,Ok
, , ,
02/08/2025,20.00,id-2,Ok`;

    const result = parseNubankCsv(csvComBuracos);
    expect(result).toHaveLength(2);
  });
});