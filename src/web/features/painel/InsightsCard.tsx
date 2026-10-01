import type { Insight } from '../../../core';
import { t } from '../../i18n';
import { Card, SectionHeader, Triangle } from '../../ui';
import { insightText } from './insightText';

const TONE_COLOR = { positive: 'text-pos', negative: 'text-neg-text', neutral: 'text-ink-2' } as const;

/** 06 — Destaques: lista numerada; o tom vê-se pelo triângulo e pelo texto para leitores de ecrã, além da cor. */
export function InsightsCard({ insights }: { insights: readonly Insight[] }) {
  const d = t().dashboard;
  const items = insights
    .map((insight) => ({ insight, text: insightText(insight) }))
    .filter((x) => x.text !== null);
  return (
    <Card aria-labelledby="destaques-titulo" className="h-full">
      <SectionHeader number="06" id="destaques-titulo" title={d.insights.title} />
      {items.length === 0 ? (
        <p className="font-display text-[16px] text-ink-2 italic">{d.insights.empty}</p>
      ) : (
        <ol aria-label={d.insights.list} className="flex flex-col">
          {items.map(({ insight, text }, i) => (
            <li
              key={insight.id}
              data-insight={insight.id}
              className="flex gap-3 border-b border-line py-3 first:pt-0 last:border-b-0"
            >
              <span
                className={`flex w-8 shrink-0 items-start gap-1 font-display text-[22px] leading-none ${TONE_COLOR[insight.tone]}`}
              >
                {i + 1}
                {insight.tone === 'neutral' ? null : (
                  <span className="mt-1">
                    <Triangle direction={insight.tone === 'positive' ? 'up' : 'down'} size={8} />
                  </span>
                )}
              </span>
              <p className="min-w-0 text-[14px] leading-snug">
                <span className="sr-only">
                  {insight.tone === 'positive'
                    ? t().common.positive
                    : insight.tone === 'negative'
                      ? t().common.negative
                      : d.insights.toneNeutral}
                  {': '}
                </span>
                {text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
