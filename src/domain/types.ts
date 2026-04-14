export type SourceType = 'inter' | 'nubank' | 'generic';

export type Direction = 'in' | 'out';

export type ImportDelimiter = ',' | ';' | '\t';

export type ImportDateFormat = 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';

export type DecimalSeparator = ',' | '.';

export type RawTransactionData = Record<string, string>;

export type ImportedFile = {
  id: string;
  name: string;
  sourceType: SourceType;
  hash: string;
  uploadedAt: string;
  rowCount: number;
  validRowCount: number;
  ignoredRowCount: number;
  templateId?: string;
  notes?: string;
};

export type Transaction = {
  id: string;
  fileId: string;
  source: SourceType;
  date: string;
  dateTs: number;
  /**
   * Money Pattern: valor armazenado na menor unidade da moeda (ex: centavos para BRL).
   * Nunca use float para valores monetários — soma de floats acumula drift binário.
   * Display: amountInUnits / 10^precision  →  formatMoney() em src/utils/money.ts
   */
  amountInUnits: number;
  /** Código ISO 4217 da moeda (ex: 'BRL', 'USD'). Obrigatório para suporte multi-moeda. */
  currency: string;
  /** Casas decimais da moeda. Default 2 (centavos). JPY=0, KWD=3. */
  precision: number;
  direction: Direction;
  description: string;
  /** Campo gerado pela normalização de descrição para agrupamento por padrão de consumo */
  descriptionNormalized: string;
  /** ID original da linha no arquivo fonte — parte do fingerprint para preservar transações idênticas */
  sourceRowId: string;
  counterparty?: string;
  counterpartyNormalized?: string;
  bankName?: string;
  /**
   * Conservative heuristic in v0.1:
   * prefer undefined over false when confidence is not strong.
   */
  ownTransfer?: boolean;
  category?: string;
  tags?: string[];
  fingerprint: string;
  possibleDuplicateKey?: string;
  raw?: RawTransactionData;
};

export type ImportTemplate = {
  id: string;
  name: string;
  delimiter: ImportDelimiter;
  headerRowIndex: number;
  dateColumn: string;
  amountColumn?: string;
  creditColumn?: string;
  debitColumn?: string;
  descriptionColumn: string;
  counterpartyColumn?: string;
  dateFormat: ImportDateFormat;
  decimalSeparator: DecimalSeparator;
  negativeMeansOutflow: boolean;
};

export type AppSetting = {
  key: string;
  value: unknown;
};
