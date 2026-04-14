/**
 * Normalização de descrição para agrupamento por padrão de consumo (clustering).
 *
 * Remove ruídos mutáveis que variam entre transações do mesmo estabelecimento:
 * códigos de transação, timestamps embutidos, emojis e separadores.
 *
 * Exemplos:
 *   "PADARIA ALFA 123"   → "padaria alfa"
 *   "Padaria Alfa 456"   → "padaria alfa"   (mesmo cluster)
 *   "PIX-987654 MERCADO" → "pix mercado"
 *   "☕ Café Central"    → "cafe central"
 */
export function normalizeDescription(value: string): string {
  return (
    value
      // 1. Normalização Unicode + remoção de diacríticos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // 2. Lowercase
      .toLowerCase()
      // 3. Remove emoji (blocos principais do Unicode)
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u2600-\u27BF]/g, '')
      // 4. Remove sequências isoladas de 3+ dígitos (códigos de transação, NSU, etc.)
      //    Preserva números curtos que podem fazer parte do nome (ex: "7-ELEVEN", "24H")
      .replace(/\b\d{3,}\b/g, '')
      // 5. Substitui separadores e pontuação por espaço
      .replace(/[-_/#*|\\]+/g, ' ')
      // 6. Remove qualquer caractere não alfanumérico restante
      .replace(/[^a-z0-9\s]/g, ' ')
      // 7. Colapsa espaços extras
      .replace(/\s+/g, ' ')
      .trim()
  );
}
