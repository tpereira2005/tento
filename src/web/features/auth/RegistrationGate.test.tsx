import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch, renderWithRouter } from '../../test-utils';
import { RegistrationGate } from './RegistrationGate';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RegistrationGate', () => {
  it('com o registo fechado mostra a mensagem e não mostra o formulário', async () => {
    mockFetch({ '/api/setup': jsonResponse({ registrationOpen: false }) });
    renderWithRouter(<RegistrationGate onSignedUp={vi.fn()} />, { at: '/entrar' });

    expect(await screen.findByText('O registo está fechado — este Tento já tem dono.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Registo fechado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para a entrada' })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar conta' })).not.toBeInTheDocument();
  });

  it('com o registo aberto mostra o formulário e a dica da palavra-passe em direto', async () => {
    mockFetch({ '/api/setup': jsonResponse({ registrationOpen: true }) });
    renderWithRouter(<RegistrationGate onSignedUp={vi.fn()} />, { at: '/entrar' });

    expect(await screen.findByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Pelo menos 12 caracteres. Faltam 12.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Palavra-passe', { selector: 'input' }), 'abcde');
    expect(screen.getByText('Pelo menos 12 caracteres. Faltam 7.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Palavra-passe', { selector: 'input' }), 'fghijkl');
    expect(screen.getByText('Pelo menos 12 caracteres. Está boa.')).toBeInTheDocument();
  });

  it('valida a confirmação da palavra-passe sem chamar a API de registo', async () => {
    const fetchMock = mockFetch({ '/api/setup': jsonResponse({ registrationOpen: true }) });
    renderWithRouter(<RegistrationGate onSignedUp={vi.fn()} />, { at: '/entrar' });

    await userEvent.type(await screen.findByLabelText('Nome'), 'Dono');
    await userEvent.type(screen.getByLabelText('Email'), 'dono@tento.test');
    await userEvent.type(
      screen.getByLabelText('Palavra-passe', { selector: 'input' }),
      'uma-palavra-passe-longa',
    );
    await userEvent.type(screen.getByLabelText('Confirma a palavra-passe', { selector: 'input' }), 'outra');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByText('As palavras-passe não coincidem.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // só o GET /api/setup
  });

  it('se a verificação falhar, avisa e deixa tentar de novo', async () => {
    mockFetch({ '/api/setup': jsonResponse({ error: { code: 'internal_error', message: 'x' } }, 500) });
    renderWithRouter(<RegistrationGate onSignedUp={vi.fn()} />, { at: '/entrar' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar o registo.');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
