/** Só aceita caminhos internos (evita redirecionar para outro site) e nunca volta às páginas de entrada. */
export function safeRedirect(target: unknown): string {
  if (typeof target !== 'string') return '/';
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/';
  if (target === '/entrar' || target === '/registar') return '/';
  if (target.startsWith('/entrar?') || target.startsWith('/registar?')) return '/';
  return target;
}
