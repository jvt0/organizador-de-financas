import { describe, it, expect } from 'vitest';
import { parseInterCsv } from './inter.parser';

describe('Inter Parser', () => {
  it('deve ignorar metadados e encontrar o cabeçalho dinâmico do Inter', () => {
    const csvInter = ` Extrato Conta Corrente
Saldo ;83,33

Data Lançamento;Histórico;Descrição;Valor;Saldo
30/03/2024;Pix recebido;Joao Vitor;84,00;370,13
29/03/2024;Pix enviado ;Luccius Magno;-1.900,00;63,63`;

    const result = parseInterCsv(csvInter, 'inter_teste.csv');

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe('84,00');
    expect(result[1].amount).toBe('-1.900,00');
    // Verifica a concatenação sénior que fizemos (Histórico + Descrição)
    expect(result[1].description).toBe('Pix enviado Luccius Magno');
  });

  it('deve lançar erro se não encontrar o cabeçalho esperado', () => {
    const csvInvalido = `Arquivo;Sem;Sentido;Nenhum`;
    expect(() => parseInterCsv(csvInvalido)).toThrow('Cabeçalho não encontrado');
  });

  it('retorna array vazio quando CSV contém apenas o cabeçalho sem linhas de dados', () => {
    const csvSoHeader = `Data Lançamento;Histórico;Descrição;Valor;Saldo`;
    expect(parseInterCsv(csvSoHeader, 'vazio.csv')).toHaveLength(0);
  });

  it('preserva unicode e caracteres internacionais na descrição raw', () => {
    const csv = `Data Lançamento;Histórico;Descrição;Valor;Saldo
30/03/2024;Pix recebido;Yûko 高木ゆうこ;1000,00;1000,00`;
    const result = parseInterCsv(csv, 'unicode.csv');

    expect(result).toHaveLength(1);
    // description é o campo raw — não deve sofrer normalização de charset
    expect(result[0].description).toContain('Yûko');
    expect(result[0].description).toContain('高木ゆうこ');
  });

  it('preserva emoji na descrição raw', () => {
    const csv = `Data Lançamento;Histórico;Descrição;Valor;Saldo
30/03/2024;Pix recebido;Padaria ☕ do João;15,00;1000,00`;
    const result = parseInterCsv(csv, 'emoji.csv');

    expect(result[0].description).toContain('☕');
    expect(result[0].description).toContain('João');
  });

  it('define bankName como Inter em todas as transações', () => {
    const csv = `Data Lançamento;Histórico;Descrição;Valor;Saldo
30/03/2024;Pix;João;100,00;500,00
29/03/2024;Ted;Maria;200,00;300,00`;
    const result = parseInterCsv(csv, 'inter.csv');

    expect(result.every(r => r.bankName === 'Inter')).toBe(true);
  });

  it('preenche campo raw com metadados de rastreabilidade', () => {
    const csv = `Data Lançamento;Histórico;Descrição;Valor;Saldo
30/03/2024;Pix;João;100,00;500,00`;
    const result = parseInterCsv(csv, 'rastreavel.csv');

    expect(result[0].raw).toMatchObject({
      arquivoFonte: 'rastreavel.csv',
      indexNoArquivo: expect.any(Number),
      linhaOriginal: expect.any(String),
    });
  });

  it('gera ids únicos para cada linha dentro do mesmo arquivo', () => {
    const csv = `Data Lançamento;Histórico;Descrição;Valor;Saldo
30/03/2024;Pix;João;100,00;500,00
29/03/2024;Ted;Maria;200,00;300,00
28/03/2024;Pix;Pedro;50,00;250,00`;
    const result = parseInterCsv(csv, 'ids.csv');

    const ids = result.map(r => r.id);
    const uniqueIds = new Set(ids);
    // Nenhum id deve se repetir dentro do mesmo lote
    expect(uniqueIds.size).toBe(ids.length);
  });
});