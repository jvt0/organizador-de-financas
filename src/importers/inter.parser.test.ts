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
});