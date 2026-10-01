import { en } from '../i18n/en';
import { ptPT, type Messages } from '../i18n/pt-PT';
import type { ReportLabels } from './types';

export function buildReportLabels(messages: Messages): ReportLabels {
  return { ...messages.report, monthsShort: messages.charts.monthsShort };
}

/** Textos fixos do PDF em português de Portugal. */
export const ptReportLabels: ReportLabels = buildReportLabels(ptPT);
/** Textos fixos do PDF em inglês. */
export const enReportLabels: ReportLabels = buildReportLabels(en);
