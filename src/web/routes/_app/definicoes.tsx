import { createFileRoute } from '@tanstack/react-router';
import { DefinicoesPage } from '../../features/definicoes/DefinicoesPage';

export const Route = createFileRoute('/_app/definicoes')({
  component: DefinicoesPage,
});
