export const FINGERPRINT_AMOUNT_PRECISION = 2;

export const COUNTERPARTY_STOP_TERMS = [
  'pix recebido',
  'pix enviado',
  'pix',
  'transferencia',
  'transf',
  'pagamento',
  'recebimento',
  'ted',
  'doc',
] as const;

export const OWN_TRANSFER_STRONG_TERMS = [
  'transferencia entre contas',
  'transf entre contas',
  'entre contas',
  'conta propria',
  'mesma titularidade',
] as const;

//export const OWN_TRANSFER_WEAK_TERMS = [
//  'resgate',
//  'aplicacao',
//] as const;
