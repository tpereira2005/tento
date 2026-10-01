import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { t } from '../i18n';
import { TextField, type TextFieldProps } from './TextField';

/** Campo de palavra-passe com botão para mostrar/esconder (`aria-pressed`). */
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'endAdornment'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          aria-pressed={visible}
          aria-label={t().auth.showPassword}
          title={visible ? t().auth.hidePassword : t().auth.showPassword}
          onClick={() => {
            setVisible((v) => !v);
          }}
          className="mr-1 grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      }
    />
  );
}
