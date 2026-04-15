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

  it('retorna array vazio quando CSV contém apenas o cabeçalho sem linhas de dados', () => {
    const csvSoHeader = `Data,Valor,Identificador,Descrição`;
    expect(parseNubankCsv(csvSoHeader, 'vazio.csv')).toHaveLength(0);
  });

  it('filtra linha com menos de 4 colunas sem quebrar o parse das demais', () => {
    const csv = `Data,Valor,Identificador,Descrição
01/08/2025,100.00,id-1,Pagamento Completo
01/08/2025,50.00`;
    // Segunda linha tem apenas 2 colunas — deve ser filtrada pelo filtro defensivo
    const result = parseNubankCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe('100.00');
  });

  it('preserva unicode e emoji na descrição raw', () => {
    const csv = `Data,Valor,Identificador,Descrição
01/08/2025,10.00,id-1,☕ Café da Manhã — Yûko 高木`;
    const result = parseNubankCsv(csv);

    expect(result[0].description).toContain('☕');
    expect(result[0].description).toContain('Café');
    expect(result[0].description).toContain('高木');
  });

  it('define bankName como Nubank em todas as transações', () => {
    const csv = `Data,Valor,Identificador,Descrição
01/08/2025,10.00,id-1,Pagamento A
02/08/2025,20.00,id-2,Pagamento B`;
    const result = parseNubankCsv(csv);

    expect(result.every(r => r.bankName === 'Nubank')).toBe(true);
  });

  it('lida com BOM UTF-8 no início do arquivo (export do Mac/Excel)', () => {
    // \uFEFF é o BOM — stripBom em parseCsvText deve removê-lo antes do parse
    const csv = `\uFEFFData,Valor,Identificador,Descrição
01/08/2025,10.00,id-1,Pagamento`;
    const result = parseNubankCsv(csv, 'bom.csv');

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe('10.00');
    expect(result[0].description).toBe('Pagamento');
  });
});