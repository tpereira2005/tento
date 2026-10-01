import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch, renderWithRouter } from '../../../test-utils';
import type { PreviewDto } from './api';
import { ImportWizard } from './ImportWizard';

const wallet = (id: string, profile: string, bookmaker: string) => ({
  id,
  profileId: `p-${id}`,
  profileName: profile,
  bookmakerId: `b-${id}`,
  bookmakerName: bookmaker,
  txnCount: 0,
  lastTxnDate: null,
  lastImportAt: null,
});

const wallets = { items: [wallet('w1', 'Ana', 'Casa A'), wallet('w2', 'Rui', 'Casa B')] };

function preview(patch: Partial<PreviewDto> = {}): PreviewDto {
  return {
    meta: { delimiter: ';', decimalHint: 'comma', hadBom: true, totalDataLines: 12, headerLine: 1 },
    counts: { total: 12, valid: 10, invalid: 2, toAdd: 5, duplicates: 3, conflicts: 1, missingFromFile: 4 },
    issues: [
      { line: 4, field: 'date', code: 'invalid_date', raw: '31/02/2025' },
      { line: 9, field: 'amount', code: 'too_many_decimals', raw: '10,555' },
    ],
    issuesTotal: 2,
    conflicts: [
      {
        incoming: { line: 6, date: '2025-03-10', type: 'deposit', amountCents: 2500, seq: 0 },
        existing: { date: '2025-03-10', type: 'deposit', amountCents: 2000 },
      },
    ],
    toAddSample: [
      { line: 2, date: '2025-01-05', type: 'deposit', amountCents: 5000, seq: 0 },
      { line: 3, date: '2025-01-20', type: 'withdrawal', amountCents: 12050, seq: 0 },
    ],
    ...patch,
  } as PreviewDto;
}

const csvFile = (text: string, name = 'ana-casa-a.csv', type = 'text/csv') =>
  new File([text], name, { type });

const BOM = String.fromCharCode(0xfeff);
const MINUS = String.fromCharCode(0x2212);

interface Sent {
  body: { walletId: string; filename: string; csv: string } | undefined;
}

/** Pedidos feitos ao caminho indicado (`exact`: só esse caminho, sem sufixos). */
function sent(fetchMock: ReturnType<typeof mockFetch>, path: string, exact = false): Sent[] {
  return fetchMock.mock.calls
    .filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return exact ? url === path : url.includes(path);
    })
    .map(([, init]) => ({
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Sent['body']) : undefined,
    }));
}

const user = () => userEvent.setup({ applyAccept: false });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Setup {
  previewResponse?: () => Response;
  commitResponse?: () => Response;
  walletList?: unknown;
}

function setup({ previewResponse, commitResponse, walletList = wallets }: Setup = {}) {
  const fetchMock = mockFetch({
    '/api/wallets': () => jsonResponse(walletList),
    '/api/imports/preview': () => (previewResponse ? previewResponse() : jsonResponse(preview())),
    '/api/imports': () =>
      commitResponse
        ? commitResponse()
        : jsonResponse(
            {
              id: 'i1',
              walletId: 'w1',
              profileName: 'Ana',
              bookmakerName: 'Casa A',
              filename: 'ana-casa-a.csv',
              rowsTotal: 12,
              rowsAdded: 5,
              rowsDuplicate: 3,
              rowsInvalid: 2,
              rowsConflict: 1,
              createdAt: '2025-03-14T10:30:00.000Z',
              undoneAt: null,
            },
            201,
          ),
  });
  const onViewHistory = vi.fn();
  const onShowFormat = vi.fn();
  const view = renderWithRouter(<ImportWizard onViewHistory={onViewHistory} onShowFormat={onShowFormat} />);
  return { fetchMock, onViewHistory, onShowFormat, ...view };
}

/** Passa do passo 1 ao 2 e escolhe o ficheiro; o 3 abre sozinho. */
async function chooseFile(u: ReturnType<typeof user>, file: File) {
  await u.click(await screen.findByRole('button', { name: 'Continuar' }));
  await u.upload(await screen.findByLabelText('Ficheiro CSV'), file);
}

describe('assistente de importação', () => {
  it('sem contas explica que cada CSV pertence a uma conta e liga às Definições', async () => {
    setup({ walletList: { items: [] } });
    expect(await screen.findByText('Ainda não tens contas')).toBeInTheDocument();
    expect(screen.getByText(/combinação de um perfil com uma casa/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para as Definições' })).toHaveAttribute(
      'href',
      '/definicoes',
    );
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
  });

  it('mostra os passos e marca o atual com aria-current', async () => {
    setup();
    const steps = within(await screen.findByRole('navigation', { name: 'Passos da importação' }));
    expect(steps.getAllByRole('listitem')).toHaveLength(4);
    expect(steps.getByText('Conta').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(await screen.findByRole('combobox', { name: 'Conta' })).toHaveTextContent('Ana · Casa A');
  });

  it('o passo 2 usa um input de ficheiro real que aceita CSV', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    const input = await screen.findByLabelText('Ficheiro CSV');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.csv,text/csv');
    expect(screen.getByRole('heading', { level: 2, name: 'Ficheiro' })).toHaveFocus();
  });

  describe('validação do ficheiro', () => {
    it('recusa ficheiros que não são CSV', async () => {
      const { fetchMock } = setup();
      await chooseFile(user(), csvFile('a', 'folha.xlsx', 'application/vnd.ms-excel'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Este ficheiro não é um CSV');
      expect(sent(fetchMock, '/imports/preview')).toHaveLength(0);
    });

    it('recusa ficheiros com mais de 5 MB', async () => {
      setup();
      const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.csv', { type: 'text/csv' });
      await chooseFile(user(), big);
      expect(await screen.findByRole('alert')).toHaveTextContent('mais de 5 MB');
    });

    it('recusa ficheiros vazios', async () => {
      setup();
      await chooseFile(user(), csvFile('', 'vazio.csv'));
      expect(await screen.findByRole('alert')).toHaveTextContent('O ficheiro está vazio.');
    });
  });

  it('lê como Windows-1252 quando o ficheiro não é UTF-8 e avisa', async () => {
    const { fetchMock } = setup();
    // "Depósito" com o é em Windows-1252 (0xE9), que não é UTF-8 válido
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('Date;Tipe;Vaule\r\n2025-01-05;Dep'),
      0xf3,
      ...new TextEncoder().encode('sito;10,00\r\n'),
    ]);
    await chooseFile(user(), new File([bytes], 'ana-casa-a.csv', { type: 'text/csv' }));
    expect(
      await screen.findByText('O ficheiro não estava em UTF-8; foi lido como Windows-1252.'),
    ).toBeInTheDocument();
    const body = sent(fetchMock, '/imports/preview')[0]?.body;
    expect(body?.csv).toContain('Depósito');
    expect(body?.walletId).toBe('w1');
  });

  it('mantém o BOM do ficheiro UTF-8 e não mostra o aviso', async () => {
    const { fetchMock } = setup();
    await chooseFile(user(), csvFile(`${BOM}Date;Tipe;Vaule\r\n2025-01-05;Deposit;10,00\r\n`));
    await screen.findByRole('group', { name: 'Resumo da análise' });
    const body = sent(fetchMock, '/imports/preview')[0]?.body;
    expect(body?.csv.startsWith(BOM)).toBe(true);
    expect(screen.queryByText(/Windows-1252/)).not.toBeInTheDocument();
  });

  describe('pré-visualização', () => {
    it('mostra contagens, formato, erros, conflitos e amostra', async () => {
      setup();
      await chooseFile(user(), csvFile('x'));
      const summary = await screen.findByRole('group', { name: 'Resumo da análise' });
      const tile = (label: string) => within(summary).getByText(label).closest('div');
      expect(tile('Linhas no ficheiro')).toHaveTextContent('12');
      expect(tile('Válidas')).toHaveTextContent('10');
      expect(tile('Novas')).toHaveTextContent('5');
      expect(tile('Já importadas')).toHaveTextContent('3');
      expect(tile('Conflitos')).toHaveTextContent('1');
      expect(tile('Com erros')).toHaveTextContent('2');
      expect(tile('Em falta no ficheiro')).toHaveTextContent('4');
      expect(
        screen.getByText('Formato detetado: separador ponto e vírgula, decimais com vírgula, com BOM.'),
      ).toBeInTheDocument();
      expect(screen.getByText(/nada é apagado/i)).toBeInTheDocument();

      const errors = screen.getByRole('table', { name: 'Erros por linha' });
      expect(within(errors).getByText('Data inválida. Usa AAAA-MM-DD ou DD/MM/AAAA.')).toBeInTheDocument();
      expect(within(errors).getByText('Valor com mais de duas casas decimais.')).toBeInTheDocument();
      expect(within(errors).getByText('31/02/2025')).toBeInTheDocument();

      const conflicts = screen.getByRole('table', { name: 'Conflitos' });
      expect(within(conflicts).getByText(/25,00/)).toBeInTheDocument();
      expect(within(conflicts).getByText(/20,00/)).toBeInTheDocument();
      expect(screen.getByText(/não são importados/i)).toBeInTheDocument();

      const sample = screen.getByRole('table', { name: 'Novas transações' });
      expect(within(sample).getByText('05/01/2025')).toBeInTheDocument();
      expect(within(sample).getByText('Levantamento')).toBeInTheDocument();
      expect(within(sample).getByText(/\+120,50/)).toBeInTheDocument();
      expect(within(sample).getByText(new RegExp(`${MINUS}50,00`))).toBeInTheDocument();
    });

    it('limita os erros a 20, deixa mostrar mais e indica os que o servidor não enviou', async () => {
      const issues = Array.from({ length: 30 }, (_, i) => ({
        line: i + 2,
        field: 'type' as const,
        code: 'invalid_type' as const,
        raw: `x${String(i)}`,
      }));
      setup({
        previewResponse: () => jsonResponse(preview({ issues, issuesTotal: 245 })),
      });
      await chooseFile(user(), csvFile('x'));
      const table = await screen.findByRole('table', { name: 'Erros por linha' });
      expect(within(table).getAllByRole('row')).toHaveLength(21); // cabeçalho + 20
      expect(screen.getByText('+215 não mostrados')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais (10)' }));
      expect(within(table).getAllByRole('row')).toHaveLength(31);
      expect(screen.getByRole('button', { name: 'Mostrar menos' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('explica a falta de colunas e liga ao formato aceite', async () => {
      const { onShowFormat } = setup({
        previewResponse: () =>
          jsonResponse(
            {
              error: {
                code: 'missing_columns',
                message: 'Ficheiro CSV inválido.',
                details: { code: 'missing_columns', missing: ['type', 'amount'] },
              },
            },
            422,
          ),
      });
      await chooseFile(user(), csvFile('Date;X;Y'));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Faltam colunas no cabeçalho: tipo, valor.');
      await userEvent.click(within(alert).getByRole('button', { name: 'Ver o formato aceite' }));
      expect(onShowFormat).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    });

    it('sem novas linhas diz que não há nada de novo e não deixa continuar', async () => {
      setup({
        previewResponse: () =>
          jsonResponse(
            preview({
              counts: {
                total: 3,
                valid: 3,
                invalid: 0,
                toAdd: 0,
                duplicates: 3,
                conflicts: 0,
                missingFromFile: 0,
              },
              issues: [],
              issuesTotal: 0,
              conflicts: [],
              toAddSample: [],
            }),
          ),
      });
      await chooseFile(user(), csvFile('x'));
      expect(await screen.findByText('Nada de novo para importar.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
      expect(screen.queryByRole('table', { name: 'Erros por linha' })).not.toBeInTheDocument();
    });

    it('volta atrás, muda de ficheiro e refaz a análise', async () => {
      const { fetchMock } = setup();
      const u = user();
      await chooseFile(u, csvFile('um'));
      await screen.findByRole('group', { name: 'Resumo da análise' });
      await u.click(screen.getByRole('button', { name: 'Voltar' }));
      await u.upload(await screen.findByLabelText('Ficheiro CSV'), csvFile('dois', 'outro.csv'));
      await screen.findByText('outro.csv');
      expect(sent(fetchMock, '/imports/preview')).toHaveLength(2);
    });
  });

  describe('confirmação', () => {
    async function toConfirm(u: ReturnType<typeof user>) {
      await chooseFile(u, csvFile('x'));
      await screen.findByRole('group', { name: 'Resumo da análise' });
      await u.click(screen.getByRole('button', { name: 'Continuar' }));
    }

    it('grava, mostra o resumo, desatualiza as consultas e oferece histórico', async () => {
      const { queryClient, fetchMock, onViewHistory } = setup();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const u = user();
      await toConfirm(u);
      expect(screen.getByRole('heading', { level: 2, name: 'Confirmar' })).toHaveFocus();
      await u.click(screen.getByRole('button', { name: 'Importar 5 transações' }));

      expect(
        (await screen.findAllByText('5 transações adicionadas à conta Ana · Casa A.')).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText(/3 já importadas, 1 conflitos e 2 linhas com erros/)).toBeInTheDocument();
      expect(screen.getByText(/chega na etapa 5/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Importação concluída' })).toHaveFocus();

      expect(sent(fetchMock, '/api/imports', true)[0]?.body).toEqual({
        walletId: 'w1',
        filename: 'ana-casa-a.csv',
        csv: 'x',
      });
      await waitFor(() => {
        const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
        expect(keys).toEqual(expect.arrayContaining(['["wallets"]', '["imports"]', '["stats"]']));
      });

      await u.click(screen.getByRole('button', { name: 'Ver histórico' }));
      expect(onViewHistory).toHaveBeenCalled();
      await u.click(screen.getByRole('button', { name: 'Importar outro ficheiro' }));
      expect(await screen.findByLabelText('Ficheiro CSV')).toBeInTheDocument();
    });

    it('mostra o erro da API com role=alert e deixa tentar de novo', async () => {
      setup({
        commitResponse: () => jsonResponse({ error: { code: 'internal', message: 'x' } }, 500),
      });
      const u = user();
      await toConfirm(u);
      await u.click(screen.getByRole('button', { name: 'Importar 5 transações' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi guardado nada');
      expect(screen.getByRole('button', { name: 'Importar 5 transações' })).toBeEnabled();
    });
  });
});
