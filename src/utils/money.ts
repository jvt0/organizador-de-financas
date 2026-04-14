/**
 * Money Pattern — Value Object Helpers
 *
 * Regra fundamental: valores monetários são SEMPRE armazenados como inteiros
 * na menor unidade da moeda (centavos para BRL, pence para GBP, etc.).
 *
 * Por que nunca usar float para dinheiro?
 *   0.1 + 0.2 === 0.30000000000000004  (em JavaScript)
 *   Em 10.000 transações, o drift acumulado pode divergir vários reais.
 *
 * Fluxo correto:
 *   CSV "10,50" → parseFloat → 10.5 → Math.round(10.5 * 100) = 1050 (armazena)
 *   Display: 1050 / 100 = 10.5 → Intl.NumberFormat → "R$ 10,50" (exibe)
 */

export type Money = {
  amountInUnits: number; // inteiro, ex: 1050 para R$10,50
  currency: string;      // ISO 4217, ex: 'BRL'
  precision: number;     // casas decimais, ex: 2
};

/**
 * Converte unidades mínimas para o valor decimal de exibição.
 * Exemplo: toDecimal(1050, 2) → 10.5
 */
export function toDecimal(amountInUnits: number, precision = 2): number {
  return amountInUnits / 10 ** precision;
}

/**
 * Formata um valor monetário usando Intl.NumberFormat.
 * A formatação segue automaticamente as regras de cada moeda (separadores, símbolo, casas).
 * Exemplo: formatMoney(1050, 'BRL') → "R$ 10,50"
 *          formatMoney(1050, 'USD') → "$10.50"
 */
export function formatMoney(amountInUnits: number, currency: string, precision = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(toDecimal(amountInUnits, precision));
}

/**
 * Soma dois valores Money. Lança erro se as moedas forem diferentes.
 * Garante que nunca se somem Reais com Dólares silenciosamente.
 */
export function add(m1: Money, m2: Money): Money {
  if (m1.currency !== m2.currency) {
    throw new Error(
      `Não é possível somar moedas diferentes: ${m1.currency} e ${m2.currency}. ` +
        'Converta para a mesma moeda antes de somar.',
    );
  }
  if (m1.precision !== m2.precision) {
    throw new Error(
      `Precisões incompatíveis: ${m1.precision} e ${m2.precision}. ` +
        'Normalize antes de somar.',
    );
  }

  return {
    amountInUnits: m1.amountInUnits + m2.amountInUnits,
    currency: m1.currency,
    precision: m1.precision,
  };
}

/**
 * Converte unidades mínimas para string decimal formatada (sem símbolo de moeda).
 * Útil para logs, depuração e exportação CSV.
 * Exemplo: toDisplay(1050) → "10.50"
 */
export function toDisplay(amountInUnits: number, precision = 2): string {
  return toDecimal(amountInUnits, precision).toFixed(precision);
}

/**
 * Converte um valor float (de CSV/parser) para unidades mínimas inteiras.
 * Usa Math.round para eliminar o drift binário de ponto flutuante.
 * Exemplo: toUnits(10.5) → 1050
 *          toUnits(0.1 + 0.2) → 30  (correto, sem drift)
 */
export function toUnits(decimalAmount: number, precision = 2): number {
  return Math.round(decimalAmount * 10 ** precision);
}
