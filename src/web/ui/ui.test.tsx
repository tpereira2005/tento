import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { Amount, Button, Dialog, Segmented, TextField } from '.';

describe('Button', () => {
  it('chama onClick ao clicar', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('não dispara quando desativado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Segmented', () => {
  const options = [
    { value: '3m', label: '3M' },
    { value: '12m', label: '12M' },
  ];

  it('seleciona um item e expõe o estado', async () => {
    const onValueChange = vi.fn();
    render(
      <Segmented aria-label="Período" options={options} defaultValue="3m" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Período' })).toBeInTheDocument();
    const first = screen.getByRole('radio', { name: '3M' });
    const second = screen.getByRole('radio', { name: '12M' });
    expect(first).toBeChecked();
    expect(second).not.toBeChecked();
    await userEvent.click(second);
    expect(second).toBeChecked();
    expect(first).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledWith('12m');
  });

  it('não deixa ficar sem seleção', async () => {
    render(<Segmented aria-label="Período" options={options} defaultValue="3m" />);
    await userEvent.click(screen.getByRole('radio', { name: '3M' }));
    expect(screen.getByRole('radio', { name: '3M' })).toBeChecked();
  });
});

describe('Amount', () => {
  it('formata positivos com sinal e cor positiva', () => {
    render(<Amount cents={31000} signed />);
    const el = screen.getByText('+310,00 €');
    expect(el.parentElement).toHaveClass('text-pos');
  });

  it('formata negativos com − e cor de texto negativa', () => {
    render(<Amount cents={-28450} />);
    const el = screen.getByText('−284,50 €');
    expect(el.parentElement).toHaveClass('text-neg-text');
  });

  it('tom neutro não colore', () => {
    render(<Amount cents={428000} tone="neutral" />);
    expect(screen.getByText('4 280,00 €').parentElement).toHaveClass('text-ink');
  });

  it('mostra triângulo apenas quando pedido', () => {
    const { container, rerender } = render(<Amount cents={100} />);
    expect(container.querySelector('svg')).toBeNull();
    rerender(<Amount cents={100} withTriangle />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('TextField', () => {
  it('liga rótulo, dica e erro ao campo', () => {
    render(<TextField label="Montante" hint="Em euros." error="Valor inválido." />);
    const input = screen.getByLabelText('Montante');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Em euros. Valor inválido.');
  });

  it('sem erro não marca como inválido', () => {
    render(<TextField label="Nome" />);
    const input = screen.getByLabelText('Nome');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});

describe('Dialog', () => {
  it('abre com nome e descrição acessíveis', async () => {
    render(
      <Dialog
        title="Apagar importação"
        description="Esta ação não se desfaz."
        trigger={<Button>Abrir</Button>}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Apagar importação' });
    expect(dialog).toHaveAccessibleDescription('Esta ação não se desfaz.');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
