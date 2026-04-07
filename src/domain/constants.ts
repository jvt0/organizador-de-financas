import type {
  DecimalSeparator,
  Direction,
  ImportDateFormat,
  ImportDelimiter,
  SourceType,
} from './types';

export const SOURCE_TYPES: readonly SourceType[] = ['inter', 'nubank', 'generic'];

export const NATIVE_SOURCE_TYPES: readonly SourceType[] = ['inter', 'nubank'];

export const DIRECTIONS: readonly Direction[] = ['in', 'out'];

export const IMPORT_DELIMITERS: readonly ImportDelimiter[] = [',', ';', '\t'];

export const IMPORT_DATE_FORMATS: readonly ImportDateFormat[] = [
  'dd/MM/yyyy',
  'yyyy-MM-dd',
  'MM/dd/yyyy',
];

export const DECIMAL_SEPARATORS: readonly DecimalSeparator[] = [',', '.'];

export const FINGERPRINT_AMOUNT_PRECISION = 2;

export const COUNTERPARTY_STOP_TERMS: readonly string[] = [
  'pix recebido',
  'pix enviado',
  'transferencia',
  'transferência',
  'pagamento',
  'recebimento',
];

export const OWN_TRANSFER_TERMS: readonly string[] = [
  'transferencia entre contas',
  'transferência entre contas',
  'transf entre contas',
  'conta propria',
  'conta própria',
  'resgate',
  'aplicacao',
  'aplicação',
];
