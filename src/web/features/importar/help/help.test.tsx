import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEADER_ALIASES, TYPE_ALIASES } from '../../../../core/csv/headers';
import { parseTransactionsCsv } from '../../../../core/csv/parse';
import { FormatHelp } from '.';
import { buildSampleCsv, SAMPLE_FILENAME } from './sample';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

function listed(words: readonly string[], scope: HTMLElement) {
  for (const word of words) {
    expect(within(scope).getByText(word, { selector: 'code' })).toBeInTheDocument();
  }
}

describe('FormatHelp', () => {
  it('começa fechada e abre com o resumo', async () => {
    const user = userEvent.setup();
    render(<FormatHelp />);
    const details = document.getElementById('formato');
    expect(details).toBeInstanceOf(HTMLDetailsElement);
    expect(details).not.toHaveAttribute('open');

    await user.click(screen.getByText('Como preparar o ficheiro CSV'));
    expect(details).toHaveAttribute('open');
  });

  it('usa o id recebido como âncora', () => {
    render(<FormatHelp id="ajuda-csv" />);
    expect(document.getElementById('ajuda-csv')).toBeInstanceOf(HTMLDetailsElement);
  });

  it('abre-se quando o endereço aponta para a âncora', () => {
    window.location.hash = '#formato';
    render(<FormatHelp />);
    expect(document.getElementById('formato')).toHaveAttribute('open');
  });

  it('lista todos os nomes de cabeçalho e palavras de tipo aceites pelo leitor de CSV', async () => {
    const user = userEvent.setup();
    render(<FormatHelp />);
    await user.click(screen.getByText('Como preparar o ficheiro CSV'));

    const header = screen.getByRole('heading', { name: 'Cabeçalho' }).parentElement!;
    listed(HEADER_ALIASES.date, header);
    listed(HEADER_ALIASES.type, header);
    listed(HEADER_ALIASES.amount, header);

    const types = screen.getByRole('heading', { name: 'Tipo de cada linha' }).parentElement!;
    listed(TYPE_ALIASES.deposit, types);
    listed(TYPE_ALIASES.withdrawal, types);
  });

  it('explica datas, valores, separadores, duplicados, conflitos e privacidade', async () => {
    const user = userEvent.setup();
    render(<FormatHelp />);
    await user.click(screen.getByText('Como preparar o ficheiro CSV'));
    expect(screen.getByText(/AAAA-MM-DD/)).toBeInTheDocument();
    expect(screen.getByText(/1\.234,56 · 1,234\.56/)).toBeInTheDocument();
    expect(screen.getByText(/ponto e vírgula/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Duplicados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conflitos' })).toBeInTheDocument();
    expect(screen.getByText(/O ficheiro original nunca é guardado/)).toBeInTheDocument();
  });

  it('descarrega o CSV de exemplo sem pedidos à rede', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:exemplo');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    let downloaded = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download;
    });

    render(<FormatHelp />);
    await user.click(screen.getByText('Como preparar o ficheiro CSV'));
    await user.click(screen.getByRole('button', { name: 'Descarregar CSV de exemplo' }));

    expect(click).toHaveBeenCalledOnce();
    expect(downloaded).toBe(SAMPLE_FILENAME);
    expect(SAMPLE_FILENAME).toBe('exemplo-tento.csv');
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toContain('text/csv');
    expect(fetchMock).not.toHaveBeenCalled();
    click.mockRestore();
  });
});

describe('buildSampleCsv', () => {
  it('começa com BOM e o cabeçalho canónico, e usa CRLF', () => {
    const csv = buildSampleCsv();
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')[0]).toBe('Date;Tipe;Vaule');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('é um CSV válido: cada linha é lida, sem problemas, com datas de 2025', () => {
    const parsed = parseTransactionsCsv(buildSampleCsv());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.issues).toEqual([]);
    expect(parsed.value.rows.length).toBeGreaterThanOrEqual(5);
    expect(parsed.value.meta.hadBom).toBe(true);
    expect(parsed.value.meta.delimiter).toBe(';');
    for (const row of parsed.value.rows) expect(row.date.startsWith('2025-')).toBe(true);
    expect(new Set(parsed.value.rows.map((r) => r.type))).toEqual(new Set(['deposit', 'withdrawal']));
  });
});
