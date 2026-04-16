/**
 * Sanitização de campos de destinatário de extratos bancários brasileiros.
 *
 * Estratégia de dois níveis (baseada em extractNomeNu do script de referência):
 *
 * NÍVEL 1 — Capture Group (primário):
 *   Regex com grupo de captura lazy (.+?) que isola o nome entre o separador
 *   de tipo de transação e o início do CPF/CNPJ (marcador • ou dígito).
 *   Exemplo: "Transferência recebida pelo Pix - PEDRO SILVA - •••.967" → "PEDRO SILVA"
 *
 * NÍVEL 2 — Prefix Strip (fallback):
 *   Remove prefixo de tipo via regex, pega o primeiro segmento antes de " - ",
 *   e limpa parentéticos finais. Usado quando não há CPF/CNPJ na descrição.
 *   Exemplo: "Pix enviado - João Silva" → "João Silva"
 */

/**
 * Regex de captura (Nível 1).
 * Grupo (.+?) captura o nome entre o tipo da transação e o terminador [•\d]
 * que marca o início do CPF mascarado (•) ou CNPJ (dígito).
 */
const CAPTURE_RE =
  /(?:transfer[eê]ncia\s+(?:recebida?|enviada?|estorno)?\s*(?:pelo\s+pix)?|reembolso\s+recebido\s*(?:pelo\s+pix)?|pix\s+(?:recebido|enviado)|recebida?(?:\s+pelo\s+pix)?|enviada?(?:\s+pelo\s+pix)?)\s*-\s*(.+?)\s*-\s*[•\d]/i

/**
 * Regex de prefixo (Nível 2 — fallback).
 * Remove prefixos comuns de tipo de transação quando não há CPF na descrição.
 */
const PREFIX_RE =
  /^(?:pix\s+(?:enviado|recebido)\s*[-–]?\s*|pix\s*[-–]\s*|pagamento\s+efetuado\s*[-–]?\s*|reembolso\s+recebido\s*(?:pelo\s+pix)?\s*[-–]?\s*|transfer[eê]ncia\s+(?:enviada?|recebida?)?\s*(?:pelo\s+pix)?\s*[-–]?\s*|compra\s+no\s+(?:d[eé]bito|cr[eé]dito)\s*)/i

/**
 * Extrai o nome limpo da pessoa ou estabelecimento de uma descrição de extrato bancário.
 *
 * @param raw - Descrição bruta do CSV (ex: "Transferência recebida pelo Pix - CLIENTE FICTICIO - •••.000.000-••")
 * @returns Nome limpo (ex: "CLIENTE FICTICIO") ou undefined se não for possível extrair
 */
export function sanitizeCounterparty(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined

  const input = raw.trim()

  // Nível 1: capture group — nome entre tipo e CPF/CNPJ/dígito (padrão Nubank com metadados)
  const captureMatch = input.match(CAPTURE_RE)
  if (captureMatch?.[1]) {
    return captureMatch[1].trim() || undefined
  }

  // Nível 2: prefix strip — para descrições sem CPF/CNPJ no sufixo
  const name = input
    .replace(PREFIX_RE, '')           // remove prefixo de tipo de transação
    .split(/\s+-\s+/)[0]             // pega só o nome, antes de qualquer " - banco/CPF"
    .replace(/\s*\([^)]*\)\s*$/, '') // remove parentético final ex: "(Transferência enviada)"
    .replace(/^[-\s]+|[-\s]+$/g, '') // limpa hífens/espaços residuais nas bordas
    .replace(/\s+/g, ' ')            // colapsa espaços internos
    .trim()

  return name || undefined
}
