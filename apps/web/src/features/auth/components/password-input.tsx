import { type ReactElement, useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from './form-field';

interface PasswordInputProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

export function PasswordInput(props: PasswordInputProps): ReactElement {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      className="pr-10"
      adornment={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground absolute top-0 right-0 h-9 w-9"
          onClick={() => {
            setVisible((v) => !v);
          }}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      }
    />
  );
}
