import { createFileRoute } from '@tanstack/react-router';
import { Download, Upload } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { addDays } from '../../core/dates';
import { formatCents } from '../../core/format';
import type { IsoDate } from '../../core/types';
import { ChartFrame, ChartLegend, CumulativeChart, DepositHeatmap, HeatLegend, MonthlyBars } from '../charts';
import { useTheme } from '../theme';
import {
  Amount,
  Button,
  Card,
  Chip,
  Dialog,
  Logo,
  Mark,
  SectionHeader,
  Segmented,
  Select,
  Skeleton,
  Stat,
  TextField,
  Triangle,
} from '../ui';

export const Route = createFileRoute('/componentes')({
  component: ComponentsPage,
});

const SWATCHES = [
  { name: 'Fundo', token: 'bg', use: 'fundo da página' },
  { name: 'Superfície', token: 'surface', use: 'cartões' },
  { name: 'Superfície 2', token: 'surface-2', use: 'trilhos, hover' },
  { name: 'Linha', token: 'line', use: 'filetes' },
  { name: 'Controlo', token: 'control', use: 'bordas de controlos' },
  { name: 'Tinta', token: 'ink', use: 'texto' },
  { name: 'Tinta 2', token: 'ink-2', use: 'texto secundário' },
  { name: 'Positivo', token: 'pos', use: 'marca, positivo' },
  { name: 'Positivo claro', token: 'pos-tint', use: 'áreas, pílulas' },
  { name: 'Negativo', token: 'neg', use: 'negativo, marcas' },
  { name: 'Negativo (texto)', token: 'neg-text', use: 'negativo, texto' },
  { name: 'Negativo claro', token: 'neg-tint', use: 'áreas, pílulas' },
  { name: 'Quota 2', token: 'share-2', use: 'barras secundárias' },
  { name: 'Pílula', token: 'pill', use: 'item ativo' },
  { name: 'Botão principal', token: 'cta', use: 'ação principal' },
] as const;

const PROFILES = [
  { value: 'todos', label: 'Todos' },
  { value: 'ana', label: 'Ana' },
  { value: 'rui', label: 'Rui' },
];
const PERIODS = [
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' },
  { value: 'tudo', label: 'Tudo' },
];

const CHART_MONTHS = [
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
const CHART_CUMULATIVE = [
  12000, 3500, -17500, -13000, -29000, 2000, -7500, -21500, -15500, -41500, -38000, -66450,
];
const CHART_NET = [12000, -8500, -21000, 4500, -16000, 31000, -9500, -14000, 6000, -26000, 3500, -28450];
const CHART_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthLabel(month: string): string {
  return `${CHART_SHORT[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)}`;
}

/** Dias de exemplo (fictícios, determinísticos) de 2025-10-01 a 2026-09-30. */
function demoDays(): { date: string; depositedCents: number; level: 0 | 1 | 2 | 3 | 4 }[] {
  const out: { date: string; depositedCents: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
  const levels = [0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 1, 0, 4, 0, 0, 0, 2, 0] as const;
  let n = 0;
  for (let d = '2025-10-01' as IsoDate; d <= '2026-09-30'; d = addDays(d, 1)) {
    const level = levels[(n * 7) % levels.length] ?? 0;
    out.push({ date: d, depositedCents: level * 2500, level });
    n += 1;
  }
  return out;
}

function ChartsShowcase() {
  const cumulative = CHART_MONTHS.map((month, i) => ({ month, cumulativeCents: CHART_CUMULATIVE[i] ?? 0 }));
  const monthly = CHART_MONTHS.map((month, i) => ({ month, netCents: CHART_NET[i] ?? 0 }));
  const days = demoDays();
  const weeks = days.filter((d) => d.level > 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <ChartFrame
            title="Resultado acumulado"
            number="01"
            right="soma de levantado − depositado, mês a mês"
            table={{
              caption: 'Resultado acumulado por mês',
              columns: ['Mês', 'Acumulado'],
              rows: cumulative.map((p) => [
                monthLabel(p.month),
                formatCents(p.cumulativeCents, { signed: true }),
              ]),
            }}
          >
            <CumulativeChart
              points={cumulative}
              annotation="abaixo de zero desde abril"
              ariaLabel="Resultado acumulado de out 2025 a set 2026: começa em +120,00 €, fecha set em −664,50 €."
            />
          </ChartFrame>
        </div>
        <div className="min-w-0 lg:col-span-4">
          <ChartFrame
            title="Resultado mensal"
            number="02"
            right={<ChartLegend />}
            table={{
              caption: 'Resultado líquido por mês',
              columns: ['Mês', 'Resultado'],
              rows: monthly.map((p) => [monthLabel(p.month), formatCents(p.netCents, { signed: true })]),
            }}
          >
            <MonthlyBars
              points={monthly}
              ariaLabel="Resultado mensal: 5 meses positivos, 7 negativos; melhor mar +310,00 €, pior set −284,50 €."
            />
          </ChartFrame>
        </div>
      </div>
      <ChartFrame
        title="Dias com depósito"
        number="03"
        right={<HeatLegend />}
        table={{
          caption: 'Dias com depósito',
          columns: ['Data', 'Depositado'],
          rows: weeks.map((d) => [d.date.split('-').reverse().join('/'), formatCents(d.depositedCents)]),
        }}
      >
        <DepositHeatmap
          days={days}
          ariaLabel="Calendário de dias com depósito, de out 2025 a set 2026 (dados de exemplo)."
        />
      </ChartFrame>
    </div>
  );
}

function Swatches() {
  useTheme(); // volta a renderizar quando o tema muda, para reler os valores
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {SWATCHES.map((s) => (
        <li key={s.token} className="min-w-0">
          <div
            className="h-12 rounded-[10px] border border-line"
            style={{ background: `var(--${s.token})` }}
            aria-hidden="true"
          />
          <p className="mt-2 text-[13px] font-semibold">{s.name}</p>
          <p
            className="num min-h-4 text-[11px] break-all text-ink-2"
            ref={(el) => {
              if (el) {
                el.textContent = getComputedStyle(document.documentElement)
                  .getPropertyValue(`--${s.token}`)
                  .trim();
              }
            }}
          />
          <p className="text-[12px] text-ink-2">{s.use}</p>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">{title}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ComponentsPage() {
  const [profile, setProfile] = useState('todos');
  const [period, setPeriod] = useState('12m');
  const [name, setName] = useState('');

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <header>
        <h1 className="font-display text-[44px] leading-none font-light tracking-[-0.02em] sm:text-[56px]">
          Componentes
        </h1>
        <p className="mt-3 max-w-xl text-ink-2">
          O sistema de design do Tento: cartões com filete de 1 px, sem sombras, dois temas e o mesmo layout.
          Positivo e negativo nunca dependem só da cor.
        </p>
      </header>

      <Card aria-labelledby="sec-marca">
        <SectionHeader id="sec-marca" number="01" title="Marca" />
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <Logo size="sm" />
          <Logo size="md" />
          <Logo size="lg" className="max-w-full" />
          <div className="flex items-end gap-4 text-ink">
            <Mark size={24} />
            <Mark size={40} />
            <Mark size={64} />
          </div>
        </div>
      </Card>

      <Card aria-labelledby="sec-cores">
        <SectionHeader id="sec-cores" number="02" title="Cores" right="valores do tema atual" />
        <Swatches />
      </Card>

      <Card aria-labelledby="sec-tipografia">
        <SectionHeader id="sec-tipografia" number="03" title="Tipografia" />
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-[44px] leading-none font-light tracking-[-0.02em] text-neg-text sm:text-[56px]">
              {formatCents(-66450)}
            </p>
            <p className="mt-3 font-display text-[20px] italic">Resultado líquido</p>
            <p className="mt-2 text-[13px] text-ink-2">
              <strong className="font-semibold text-ink">Fraunces</strong> · títulos e números de destaque ·
              300–400, itálico para frases
            </p>
          </div>
          <div>
            <p className="text-[32px] leading-none font-semibold">Aa</p>
            <p className="mt-3 font-medium">Importar, comparar, exportar</p>
            <p className="mt-2 text-[13px] text-ink-2">
              <strong className="font-semibold text-ink">Instrument Sans</strong> · interface · 400 / 500 /
              600
            </p>
          </div>
          <div>
            <div className="num flex flex-col gap-1 text-[16px]">
              <span>{formatCents(428000)}</span>
              <span>{formatCents(361550)}</span>
              <span className="text-neg-text">{formatCents(-66450)}</span>
            </div>
            <p className="mt-3 text-[13px] text-ink-2">
              <strong className="font-semibold text-ink">DM Mono</strong> · tabelas e rótulos · algarismos
              tabulares
            </p>
          </div>
        </div>
      </Card>

      <Card aria-labelledby="sec-botoes">
        <SectionHeader id="sec-botoes" number="04" title="Botões" />
        <div className="flex flex-col gap-6">
          <Block title="Tamanho médio (40 px)">
            <Button icon={Download}>Exportar PDF</Button>
            <Button variant="secondary" icon={Upload}>
              Importar CSV
            </Button>
            <Button variant="quiet">Cancelar</Button>
          </Block>
          <Block title="Tamanho pequeno (32 px)">
            <Button size="sm">Guardar</Button>
            <Button size="sm" variant="secondary">
              Editar
            </Button>
            <Button size="sm" variant="quiet">
              Ver todas
            </Button>
          </Block>
          <Block title="Desativados">
            <Button disabled>Exportar PDF</Button>
            <Button variant="secondary" disabled>
              Importar CSV
            </Button>
            <Button variant="quiet" disabled>
              Cancelar
            </Button>
          </Block>
        </div>
      </Card>

      <Card aria-labelledby="sec-controlos">
        <SectionHeader id="sec-controlos" number="05" title="Controlos" />
        <div className="flex flex-col gap-6">
          <Block title="Seleção e segmentos">
            <Select label="Perfil" options={PROFILES} value={profile} onValueChange={setProfile} />
            <Segmented aria-label="Período" options={PERIODS} value={period} onValueChange={setPeriod} />
          </Block>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Nome da casa"
              hint="Como aparece nos relatórios."
              placeholder="Casa A"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
            <TextField
              label="Montante depositado"
              defaultValue="abc"
              error="Indica um montante válido, por exemplo 50,00."
              inputMode="decimal"
            />
          </div>
        </div>
      </Card>

      <Card aria-labelledby="sec-valores">
        <SectionHeader id="sec-valores" number="06" title="Valores" />
        <div className="flex flex-col gap-6">
          <Block title="Montantes">
            <Amount cents={31000} signed withTriangle />
            <Amount cents={-28450} signed withTriangle />
            <Amount cents={428000} tone="neutral" />
            <Amount cents={-66450} variant="display" withTriangle className="text-[40px]" />
          </Block>
          <Block title="Pílulas">
            <Chip tone="pos">
              <Triangle direction="up" size={8} />
              +120,00 €
            </Chip>
            <Chip tone="neg">
              <Triangle direction="down" size={8} />
              −50,00 €
            </Chip>
            <Chip>Dados de exemplo</Chip>
          </Block>
          <Block title="Triângulos">
            <Triangle direction="up" size={12} />
            <span className="text-[13px] text-ink-2">positivo</span>
            <Triangle direction="down" size={12} />
            <span className="text-[13px] text-ink-2">negativo</span>
          </Block>
        </div>
      </Card>

      <Card aria-labelledby="sec-cartoes">
        <SectionHeader id="sec-cartoes" number="07" title="Cartões" right="soma de levantado − depositado" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Média mensal" value={<Amount cents={-5538} />} hint="últimos 12 meses" />
          <Stat label="Melhor mês" value={<Amount cents={31000} signed />} hint="março" />
          <Stat label="Pior mês" value={<Amount cents={-28450} />} hint="setembro" />
          <Stat label="Último depósito" value="28/09/2026" hint="há 2 dias" />
        </div>
      </Card>

      <Card aria-labelledby="sec-dialogo">
        <SectionHeader id="sec-dialogo" number="08" title="Diálogo" />
        <Dialog
          title="Apagar importação"
          description="As transações desta importação deixam de contar para o resultado. Podes importar o ficheiro de novo."
          trigger={<Button variant="secondary">Abrir diálogo</Button>}
        >
          <div className="flex justify-end gap-2">
            <Button variant="primary">Apagar</Button>
          </div>
        </Dialog>
      </Card>

      <Card aria-labelledby="sec-estados">
        <SectionHeader id="sec-estados" number="09" title="Estados" right="a carregar" />
        <div className="flex flex-col gap-3" role="status" aria-label="A carregar">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </Card>

      <ChartsShowcase />
    </div>
  );
}
