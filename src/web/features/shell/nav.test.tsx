import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithRouter } from '../../test-utils';
import { BottomTabs } from './BottomTabs';
import { DesktopNav } from './DesktopNav';

afterEach(cleanup);

describe('DesktopNav', () => {
  it('marca só o item da rota atual com aria-current="page"', async () => {
    renderWithRouter(<DesktopNav />, { at: '/transacoes' });
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Painel',
      'Transações',
      'Importar',
      'Comparar',
      'Relatórios',
      'Definições',
    ]);

    const current = links.filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Transações');
  });

  it('o Painel só fica ativo em "/" (correspondência exata)', async () => {
    renderWithRouter(<DesktopNav />, { at: '/' });
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Importar' })).not.toHaveAttribute('aria-current');
  });

  it('aria-current acompanha a navegação', async () => {
    renderWithRouter(<DesktopNav />, { at: '/' });
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Comparar' }));

    expect(await within(nav).findByRole('link', { name: 'Comparar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
  });
});

describe('BottomTabs', () => {
  it('mostra quatro separadores e "Mais", com o atual marcado', async () => {
    renderWithRouter(<BottomTabs />, { at: '/importar' });
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Painel', 'Transações', 'Importar', 'Comparar']);
    expect(within(nav).getByRole('link', { name: 'Importar' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Mais' })).toBeInTheDocument();
  });

  it('"Mais" abre um painel com Relatórios, Definições e Terminar sessão', async () => {
    renderWithRouter(<BottomTabs />, { at: '/' });
    await userEvent.click(await screen.findByRole('button', { name: 'Mais' }));

    const sheet = await screen.findByRole('dialog', { name: 'Mais' });
    expect(within(sheet).getByRole('link', { name: 'Relatórios' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Definições' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Terminar sessão' })).toBeInTheDocument();
  });
});
