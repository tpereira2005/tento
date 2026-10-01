import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch, renderWithRouter, urlOf } from '../../test-utils';
import { SignInForm } from './SignInForm';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(onSignedIn = vi.fn()) {
  const view = renderWithRouter(<SignInForm onSignedIn={onSignedIn} />, { at: '/entrar' });
  return { onSignedIn, ...view };
}

async function fill(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Palavra-passe', { selector: 'input' }), password);
}

describe('SignInForm', () => {
  it('valida os campos antes de chamar a API', async () => {
    const fetchMock = mockFetch({});
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));

    expect(screen.getByText('Indica o teu email.')).toBeInTheDocument();
    expect(screen.getByText('Indica a tua palavra-passe.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejeita um email mal formado', async () => {
    mockFetch({});
    setup();
    await fill('sem-arroba', 'qualquer-coisa');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText(/Indica um email válido/)).toBeInTheDocument();
  });

  it('mostra o erro da API com role=alert e não avança', async () => {
    mockFetch({
      '/api/auth/sign-in/email': jsonResponse(
        { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
        401,
      ),
    });
    const { onSignedIn } = setup();
    await fill('dono@tento.test', 'palavra-passe-errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou palavra-passe incorretos.');
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('desativa o botão enquanto o pedido está pendente e chama onSignedIn no fim', async () => {
    let release: (r: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = mockFetch({ '/api/auth/sign-in/email': () => pending });
    const { onSignedIn } = setup();
    await fill('dono@tento.test', 'uma-palavra-passe-longa');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const busy = await screen.findByRole('button', { name: 'A entrar…' });
    expect(busy).toBeDisabled();

    release(jsonResponse({ redirect: false, token: 't', user: { id: '1', email: 'dono@tento.test' } }));
    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
    const call = fetchMock.mock.calls.find(([input]) => urlOf(input).endsWith('/api/auth/sign-in/email'));
    expect(call).toBeDefined();
  });

  it('alterna a visibilidade da palavra-passe com aria-pressed', async () => {
    mockFetch({});
    setup();
    const input = await screen.findByLabelText('Palavra-passe', { selector: 'input' });
    const toggle = screen.getByRole('button', { name: 'Mostrar palavra-passe' });
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
