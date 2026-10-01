import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../api/auth';

/** Termina a sessão, esquece tudo o que estava em cache e volta à entrada. */
export function useSignOut(): { signOut: () => Promise<void>; pending: boolean } {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      queryClient.clear();
      setPending(false);
      await navigate({ to: '/entrar' });
    }
  }
  return { signOut, pending };
}
