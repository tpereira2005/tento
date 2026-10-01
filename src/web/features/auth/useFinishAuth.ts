import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { forgetSession, meQuery } from '../../api/session';
import { applyPreference } from '../../theme';

/**
 * Depois de entrar ou registar: carrega a sessão nova, aplica o tema guardado na conta
 * e segue para o destino.
 */
export function useFinishAuth(): (target: string) => Promise<void> {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useCallback(
    async (target: string) => {
      forgetSession(queryClient);
      const me = await queryClient.query({ ...meQuery, staleTime: 0 });
      applyPreference(me.settings.theme);
      router.history.push(target);
    },
    [queryClient, router],
  );
}
