import { describe, expect, it } from 'vitest'

import {
  getHeadersFromRow,
  getPreviewRows,
  isCsvEmpty,
  normalizeCell,
  parseCsvText,
  sanitizeCounterparty,
  stripBom,
} from './csv.utils'

describe('stripBom', () => {
  it('remove BOM do inicio do texto', () => {
    expect(stripBom('\uFEFFcol1,col2')).toBe('col1,col2')
  })
})

describe('parseCsvText', () => {
  it('faz parse simples com virgula e preserva meta relevante', () => {
    const result = parseCsvText('nome,valor\nana,10')

    expect(result.rows).toEqual([
      ['nome', 'valor'],
      ['ana', '10'],
    ])
    expect(result.errors).toEqual([])
    expect(result.meta.delimiter).toBe(',')
  })

  it('faz parse com ponto e virgula', () => {
    const result = parseCsvText('nome;valor\nana;10')

    expect(result.rows).toEqual([
      ['nome', 'valor'],
      ['ana', '10'],
    ])
    expect(result.meta.delimiter).toBe(';')
  })

  it('ignora linhas vazias com skipEmptyLines greedy', () => {
    const result = parseCsvText('a,b\n\n \n1,2')

    expect(result.rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('remove BOM antes do parse', () => {
    const result = parseCsvText('\uFEFFa,b\n1,2')

    expect(result.rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('preserva delimitador dentro de aspas', () => {
    const result = parseCsvText('descricao,valor\n"mercado, padaria",10')

    expect(result.rows).toEqual([
      ['descricao', 'valor'],
      ['mercado, padaria', '10'],
    ])
  })

  it('faz parse de texto vazio sem quebrar e preserva o erro do parser', () => {
  const result = parseCsvText('')

  expect(result.rows).toEqual([])
  expect(result.errors.length).toBeGreaterThan(0)
  expect(result.errors[0]?.code).toBe('UndetectableDelimiter')
})

  it('preserva errors do PapaParse quando o CSV está malformado', () => {
    const result = parseCsvText('nome,valor\n"abc,123')

    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('parseia CRLF (Windows line endings) sem incluir carriage return nos valores', () => {
    const result = parseCsvText('nome,valor\r\nana,10\r\ncarlos,20')

    expect(result.rows).toEqual([
      ['nome', 'valor'],
      ['ana', '10'],
      ['carlos', '20'],
    ])
    expect(result.errors).toEqual([])
    // Nenhum valor deve conter \r residual
    expect(result.rows.flat().every(cell => !cell.includes('\r'))).toBe(true)
  })

  it('parseia arquivo com tab como delimitador', () => {
    const result = parseCsvText('nome\tvalor\nana\t10')

    expect(result.rows).toEqual([
      ['nome', 'valor'],
      ['ana', '10'],
    ])
    expect(result.meta.delimiter).toBe('\t')
  })

})

describe('normalizeCell', () => {
  it('faz apenas normalizacao minima com trim', () => {
    expect(normalizeCell('  valor  ')).toBe('valor')
    expect(normalizeCell(null)).toBe('')
  })
})

describe('stripBom', () => {
  it('não altera string sem BOM', () => {
    expect(stripBom('col1,col2\n1,2')).toBe('col1,col2\n1,2')
  })

  it('não altera string vazia', () => {
    expect(stripBom('')).toBe('')
  })
})

describe('getHeadersFromRow', () => {
  it('retorna headers com trim a partir de qualquer linha', () => {
    expect(getHeadersFromRow([' Nome ', ' Valor ', '  Data'])).toEqual([
      'Nome',
      'Valor',
      'Data',
    ])
  })

  it('retorna array vazio para undefined', () => {
    expect(getHeadersFromRow(undefined)).toEqual([])
  })
})

describe('getPreviewRows', () => {
  it('retorna apenas a amostra limitada', () => {
    const rows = [['1'], ['2'], ['3']]

    expect(getPreviewRows(rows, 2)).toEqual([['1'], ['2']])
  })

  it('retorna array vazio quando limite é 0', () => {
    expect(getPreviewRows([['1'], ['2']], 0)).toEqual([])
  })
})

describe('isCsvEmpty', () => {
  it('indica quando nao ha linhas', () => {
    expect(isCsvEmpty([])).toBe(true)
    expect(isCsvEmpty([['header']])).toBe(false)
  })
})

describe('sanitizeCounterparty', () => {
  it('remove prefixo "Pix enviado - " e retorna o nome', () => {
    expect(sanitizeCounterparty('Pix enviado - Jose')).toBe('Jose')
  })

  it('remove prefixo "Pix recebido - " case-insensitive', () => {
    expect(sanitizeCounterparty('PIX RECEBIDO - Maria Silva')).toBe('Maria Silva')
  })

  it('remove prefixo "Pix - "', () => {
    expect(sanitizeCounterparty('Pix - Joao')).toBe('Joao')
  })

  it('remove prefixo "Transferência recebida pelo Pix - " e descarta CPF/banco', () => {
    expect(sanitizeCounterparty(
      'Transferência recebida pelo Pix - CLIENTE FICTICIO A - •••.000.000-•• - BCO C6 S.A.'
    )).toBe('CLIENTE FICTICIO A')
  })

  it('remove prefixo "Transferência Recebida - " (sem "pelo Pix")', () => {
    expect(sanitizeCounterparty(
      'Transferência Recebida - Cliente Ficticio B - •••.000.000-•• - NU PAGAMENTOS'
    )).toBe('Cliente Ficticio B')
  })

  it('remove prefixo "Transferência enviada pelo Pix - " com parentético final', () => {
    expect(sanitizeCounterparty(
      'Transferência enviada pelo Pix - CLIENTE FICTICIO C (Transferência enviada)'
    )).toBe('CLIENTE FICTICIO C')
  })

  it('remove prefixo "Reembolso recebido pelo Pix - "', () => {
    expect(sanitizeCounterparty(
      'Reembolso recebido pelo Pix - 99 TECNOLOGIA LTDA - 18.033.552/0001-61'
    )).toBe('99 TECNOLOGIA LTDA')
  })

  it('remove prefixo "Pagamento efetuado - "', () => {
    expect(sanitizeCounterparty('Pagamento efetuado - Padaria Alfa')).toBe('Padaria Alfa')
  })

  it('colapsa espacos internos mas preserva nome com hifen interno (ex: Ana-Maria)', () => {
    expect(sanitizeCounterparty('Pix enviado - Ana-Maria   da Silva')).toBe('Ana-Maria da Silva')
  })

  it('nao altera nome limpo do Inter (campo descricao ja isolado)', () => {
    expect(sanitizeCounterparty('Bruno H Rodrigues')).toBe('Bruno H Rodrigues')
  })

  it('colapsa espacos excessivos de nomes de merchants do Inter', () => {
    expect(sanitizeCounterparty('Acai Do Alto           Salvador      Bra'))
      .toBe('Acai Do Alto Salvador Bra')
  })

  it('retorna undefined para string vazia ou nula', () => {
    expect(sanitizeCounterparty('')).toBeUndefined()
    expect(sanitizeCounterparty(null)).toBeUndefined()
    expect(sanitizeCounterparty(undefined)).toBeUndefined()
  })
})
