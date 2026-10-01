import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BookmakerDto, ListDto, MeDto, ProfileDto, SettingsDto, WalletDto } from '../../api/types';

export const keys = {
  bookmakers: ['bookmakers'] as const,
  profiles: ['profiles'] as const,
  wallets: ['wallets'] as const,
  me: ['me'] as const,
};

export const useBookmakers = () =>
  useQuery({ queryKey: keys.bookmakers, queryFn: () => api<ListDto<BookmakerDto>>('/bookmakers') });

export const useProfiles = () =>
  useQuery({ queryKey: keys.profiles, queryFn: () => api<ListDto<ProfileDto>>('/profiles') });

export const useWallets = () =>
  useQuery({ queryKey: keys.wallets, queryFn: () => api<ListDto<WalletDto>>('/wallets') });

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<MeDto>('/me') });

type Kind = 'bookmakers' | 'profiles';

/** Apagar (cascata) ou renomear casa/perfil também desatualiza as contas, que mostram os nomes. */
function invalidateCatalog(qc: QueryClient, kind: Kind): Promise<unknown> {
  return Promise.all([keys[kind], keys.wallets].map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useCreateNamed(kind: Kind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<BookmakerDto | ProfileDto>(`/${kind}`, { method: 'POST', body: { name } }),
    onSuccess: () => invalidateCatalog(qc, kind),
  });
}

export function useRenameNamed(kind: Kind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      api<BookmakerDto | ProfileDto>(`/${kind}/${encodeURIComponent(v.id)}`, {
        method: 'PATCH',
        body: { name: v.name },
      }),
    onSuccess: () => invalidateCatalog(qc, kind),
  });
}

export function useDeleteNamed(kind: Kind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => invalidateCatalog(qc, kind),
  });
}

export function useCreateWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { profileId: string; bookmakerId: string }) =>
      api<WalletDto>('/wallets', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.wallets }),
  });
}

export function useDeleteWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/wallets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.wallets }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<SettingsDto>) =>
      api<SettingsDto>('/me/settings', { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

/** Apaga todos os dados da conta (a conta mantém-se); tudo o que estava em cache fica desatualizado. */
export function useDeleteAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirm: string) => api<undefined>('/me/data', { method: 'DELETE', body: { confirm } }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/** Apaga a própria conta (exige a palavra-passe); a sessão termina no servidor. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => api<undefined>('/me', { method: 'DELETE', body: { password } }),
  });
}

/** Descarrega a exportação JSON como ficheiro (usa o nome indicado pelo servidor, se vier). */
export async function downloadExport(): Promise<void> {
  const res = await fetch('/api/me/export', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`export_failed_${String(res.status)}`);
  const blob = await res.blob();
  const header = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(header)?.[1] ?? 'tento-dados.json';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
