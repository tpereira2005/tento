import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '../../core/dates';
import { formatCents } from '../../core/format';
import type { IsoDate } from '../../core/types';
import { ChartFrame, ChartLegend, CumulativeChart, DepositHeatmap, HeatLegend, MonthlyBars } from '.';

const MONTHS = [
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
];
/** O getByText normaliza o espaço inseparável do DOM; o valor esperado tem de o acompanhar. */
const plain = (text: string) => text.split(String.fromCharCode(160)).join(' ');
const cents = (euros: number[]) => euros.map((e) => Math.round(e * 100));
const CUMULATIVE = cents([120, 35, -175, -130, -290, 20, -75, -215, -155, -415, -380, -664.5]);
const MONTHLY = cents([120, -85, -210, 45, -160, 310, -95, -140, 60, -260, 35, -284.5]);
const cumulativePoints = MONTHS.map((month, i) => ({ month, cumulativeCents: CUMULATIVE[i] ?? 0 }));
const monthlyPoints = MONTHS.map((month, i) => ({ month, netCents: MONTHLY[i] ?? 0 }));

function year(): { date: string; depositedCents: number; level: 0 | 1 | 2 | 3 | 4 }[] {
  const out: { date: string; depositedCents: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
  let n = 0;
  for (let d = '2025-10-01' as IsoDate; d <= '2026-09-30'; d = addDays(d, 1)) {
    const level = n % 9 === 0 ? 3 : n % 5 === 0 ? 1 : 0;
    out.push({ date: d, depositedCents: level * 2500, level });
    n += 1;
  }
  return out;
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CumulativeChart', () => {
  const label = 'Resultado acumulado de out 2025 a set 2026';

  it('desenha a curva, as áreas e um ponto por mês', () => {
    const { container } = render(<CumulativeChart points={cumulativePoints} ariaLabel={label} />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
    expect(container.querySelector('path[data-part="line"]')?.getAttribute('d')).toMatch(/^M/);
    expect(container.querySelector('path[data-part="area-above"]')).not.toBeNull();
    expect(container.querySelector('path[data-part="area-below"]')?.getAttribute('fill')).toMatch(
      /^url\(#.+-hatch\)$/,
    );
    expect(container.querySelectorAll('circle[data-part="dot"]')).toHaveLength(12);
  });

  it('pinta os pontos pelo sinal com o traço da superfície', () => {
    const { container } = render(<CumulativeChart points={cumulativePoints} ariaLabel={label} />);
    const dots = [...container.querySelectorAll('circle[data-part="dot"]')];
    expect(dots[0]?.getAttribute('fill')).toBe('var(--pos)');
    expect(dots[2]?.getAttribute('fill')).toBe('var(--neg)');
    expect(dots[0]?.getAttribute('stroke')).toBe('var(--surface)');
  });

  it('mostra os rótulos diretos, o final e os meses', () => {
    render(
      <CumulativeChart points={cumulativePoints} ariaLabel={label} annotation="abaixo de zero desde abril" />,
    );
    expect(screen.getByText(plain(formatCents(12000, { signed: true })))).toBeInTheDocument();
    expect(screen.getByText(plain(formatCents(2000, { signed: true })))).toBeInTheDocument();
    expect(screen.getByText(plain(formatCents(-66450)))).toBeInTheDocument();
    expect(screen.getByText('acumulado em set')).toBeInTheDocument();
    expect(screen.getByText('abaixo de zero desde abril')).toBeInTheDocument();
    for (const m of ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set']) {
      expect(screen.getByText(m)).toBeInTheDocument();
    }
  });

  it('modo compacto mostra os meses alternados e omite a anotação', () => {
    render(<CumulativeChart points={cumulativePoints} compact annotation="nota" ariaLabel={label} />);
    expect(screen.getByText('set')).toBeInTheDocument();
    expect(screen.getByText('nov')).toBeInTheDocument();
    expect(screen.queryByText('out')).toBeNull();
    expect(screen.queryByText('nota')).toBeNull();
  });

  it('usa um identificador de padrão único por instância', () => {
    const { container } = render(
      <>
        <CumulativeChart points={cumulativePoints} ariaLabel="a" />
        <CumulativeChart points={cumulativePoints} ariaLabel="b" />
      </>,
    );
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('vazio ou com um ponto mostra uma mensagem calma', () => {
    const { rerender, container } = render(<CumulativeChart points={[]} ariaLabel={label} />);
    expect(screen.getByText(/Ainda não há dados suficientes/)).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    rerender(<CumulativeChart points={cumulativePoints.slice(0, 1)} ariaLabel={label} />);
    expect(screen.getByText(/Ainda não há dados suficientes/)).toBeInTheDocument();
  });
});

describe('MonthlyBars', () => {
  const label = 'Resultado mensal: 5 meses positivos';

  it('desenha 12 barras com cor por sinal', () => {
    const { container } = render(<MonthlyBars points={monthlyPoints} ariaLabel={label} />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
    expect(container.querySelectorAll('rect[data-bar]')).toHaveLength(12);
    expect(container.querySelectorAll('rect[data-bar="positive"]')).toHaveLength(5);
    expect(container.querySelectorAll('rect[data-bar="negative"]')).toHaveLength(7);
    expect(container.querySelector('rect[data-bar="positive"]')?.getAttribute('fill')).toBe('var(--pos)');
    expect(container.querySelector('rect[data-bar="negative"]')?.getAttribute('fill')).toBe('var(--neg)');
  });

  it('rotula só os extremos', () => {
    render(<MonthlyBars points={monthlyPoints} ariaLabel={label} />);
    expect(screen.getByText('+310')).toBeInTheDocument();
    expect(screen.getByText('−284,50')).toBeInTheDocument();
    expect(screen.queryByText('+120')).toBeNull();
    expect(screen.getByText('set')).toBeInTheDocument();
  });

  it('modo compacto alterna os meses', () => {
    render(<MonthlyBars points={monthlyPoints} compact ariaLabel={label} />);
    expect(screen.getByText('set')).toBeInTheDocument();
    expect(screen.queryByText('out')).toBeNull();
  });

  it('vazio mostra uma mensagem', () => {
    render(<MonthlyBars points={[]} ariaLabel={label} />);
    expect(screen.getByText(/Ainda não há dados suficientes/)).toBeInTheDocument();
  });
});

describe('DepositHeatmap', () => {
  it('desenha uma célula por dia e os rótulos de mês e de dia', () => {
    const { container } = render(<DepositHeatmap days={year()} ariaLabel="Calendário" />);
    expect(screen.getByRole('img', { name: 'Calendário' })).toBeInTheDocument();
    expect(container.querySelectorAll('rect[data-level]')).toHaveLength(365);
    for (const m of ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set']) {
      expect(screen.getByText(m)).toBeInTheDocument();
    }
    for (const d of ['seg', 'qua', 'sex']) expect(screen.getByText(d)).toBeInTheDocument();
    expect(container.querySelector('rect[data-level="3"]')?.getAttribute('fill')).toBe('var(--heat-3)');
  });

  it('sem dias mostra uma mensagem', () => {
    render(<DepositHeatmap days={[]} ariaLabel="Calendário" />);
    expect(screen.getByText(/Ainda não há dias/)).toBeInTheDocument();
  });
});

describe('ChartFrame e legendas', () => {
  const table = {
    caption: 'Resultado acumulado por mês',
    columns: ['Mês', 'Acumulado'],
    rows: [
      ['out 2025', formatCents(12000, { signed: true })],
      ['nov 2025', formatCents(3500, { signed: true })],
    ],
  };

  it('troca o gráfico pela tabela e volta', async () => {
    render(
      <ChartFrame title="Resultado acumulado" number="01" table={table} right={<ChartLegend />}>
        <CumulativeChart points={cumulativePoints} ariaLabel="Gráfico acumulado" />
      </ChartFrame>,
    );
    expect(screen.getByRole('heading', { name: 'Resultado acumulado' })).toBeInTheDocument();
    expect(screen.getByText('positivo')).toBeInTheDocument();
    expect(screen.getByText('negativo')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Ver como tabela' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('table')).toBeNull();

    await userEvent.click(toggle);
    const grid = screen.getByRole('table', { name: 'Resultado acumulado por mês' });
    expect(within(grid).getAllByRole('row')).toHaveLength(3);
    expect(within(grid).getByText(plain(formatCents(12000, { signed: true })))).toBeInTheDocument();
    expect(within(grid).getByRole('columnheader', { name: 'Acumulado' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Gráfico acumulado' })).toBeNull();
    const back = screen.getByRole('button', { name: 'Ver gráfico' });
    expect(back).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(back);
    expect(screen.getByRole('img', { name: 'Gráfico acumulado' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('HeatLegend mostra menos e mais', () => {
    render(<HeatLegend />);
    expect(screen.getByText(/menos/)).toBeInTheDocument();
    expect(screen.getByText(/mais/)).toBeInTheDocument();
  });
});
