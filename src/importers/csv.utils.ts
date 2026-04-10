import Papa, { type ParseError, type ParseMeta } from 'papaparse'

export type CsvRow = string[]

export type CsvParseResult = {
  rows: CsvRow[]
  errors: ParseError[]
  meta: ParseMeta
}

export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

export function parseCsvText(text: string): CsvParseResult {
  const sanitizedText = stripBom(text)

  const result = Papa.parse<string[]>(sanitizedText, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  })

  return {
    rows: result.data,
    errors: result.errors,
    meta: result.meta,
  }
}

export const sanitizeDescription = (text: string): string => {
  return text.replace(/\s+/g, ' ').trim();
};

export function normalizeCell(value: unknown): string {
  if (value == null) {
    return ''
  }

  return String(value).trim()
}

export function getHeadersFromRow(row?: CsvRow): string[] {
  if (!row) {
    return []
  }

  return row.map(normalizeCell)
}

export function getPreviewRows(rows: CsvRow[], limit = 5): CsvRow[] {
  if (limit <= 0) {
    return []
  }

  return rows.slice(0, limit)
}

export function isCsvEmpty(rows: CsvRow[]): boolean {
  return rows.length === 0
}
