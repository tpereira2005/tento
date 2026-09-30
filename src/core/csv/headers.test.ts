import { describe, expect, it } from 'vitest';
import { HEADER_ALIASES, mapHeaders, normalizeToken, normalizeType } from './headers';

describe('normalizeToken', () => {
  it('tira BOM, espaços, acentos, maiúsculas e não-letras', () => {
    expect(normalizeToken('﻿ Depósito ')).toBe('deposito');
    expect(normalizeToken('Operação')).toBe('operacao');
    expect(normalizeToken('with drawal')).toBe('withdrawal');
  });
});

describe('mapHeaders', () => {
  it.each(HEADER_ALIASES.date)('reconhece o alias de data %s', (alias) => {
    expect(mapHeaders([alias, 'tipo', 'valor'])).toEqual({
      ok: true,
      value: { date: 0, type: 1, amount: 2 },
    });
  });
  it.each(HEADER_ALIASES.type)('reconhece o alias de tipo %s', (alias) => {
    expect(mapHeaders(['data', alias, 'valor'])).toEqual({
      ok: true,
      value: { date: 0, type: 1, amount: 2 },
    });
  });
  it.each(HEADER_ALIASES.amount)('reconhece o alias de valor %s', (alias) => {
    expect(mapHeaders(['data', 'tipo', alias])).toEqual({
      ok: true,
      value: { date: 0, type: 1, amount: 2 },
    });
  });

  it('aceita o formato canónico com erros de ortografia, BOM e colunas por outra ordem', () => {
    expect(mapHeaders(['﻿Date', 'Tipe', 'Vaule'])).toEqual({
      ok: true,
      value: { date: 0, type: 1, amount: 2 },
    });
    expect(mapHeaders(['Extra', ' VALOR ', 'Operação', 'Dia'])).toEqual({
      ok: true,
      value: { date: 3, type: 2, amount: 1 },
    });
  });

  it('lista as colunas em falta', () => {
    expect(mapHeaders(['Date', 'Foo', 'Bar'])).toEqual({ ok: false, error: { missing: ['type', 'amount'] } });
    expect(mapHeaders([])).toEqual({ ok: false, error: { missing: ['date', 'type', 'amount'] } });
    expect(mapHeaders(['Date', 'Type'])).toEqual({ ok: false, error: { missing: ['amount'] } });
  });

  it('em caso de repetição ganha a primeira coluna', () => {
    expect(mapHeaders(['valor', 'date', 'tipo', 'amount'])).toEqual({
      ok: true,
      value: { date: 1, type: 2, amount: 0 },
    });
  });
});

describe('normalizeType', () => {
  it.each(['deposit', 'Deposit', 'DEPÓSITO', 'deposito', ' dep ', 'Depositar'])('%s é depósito', (raw) => {
    expect(normalizeType(raw)).toBe('deposit');
  });
  it.each([
    'withdrawal',
    'Withdraw',
    'withdrawl',
    'with drawal',
    'Levantamento',
    'levantar',
    'SAQUE',
    'Retirada',
  ])('%s é levantamento', (raw) => {
    expect(normalizeType(raw)).toBe('withdrawal');
  });
  it('devolve null quando não reconhece', () => {
    expect(normalizeType('bonus')).toBeNull();
    expect(normalizeType('')).toBeNull();
  });
});
