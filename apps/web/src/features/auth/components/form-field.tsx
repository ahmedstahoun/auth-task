import { type ReactElement, useId, type ComponentProps, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string | undefined;
  /** Extra content under the input (e.g. password checklist), linked via aria-describedby. */
  hint?: ReactNode;
  /** Content rendered inside the input row (e.g. show/hide toggle). */
  adornment?: ReactNode;
}

export function FormField({
  label,
  error,
  hint,
  adornment,
  ...inputProps
}: FormFieldProps): ReactElement {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {adornment}
      </div>
      {error && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      {hint && <div id={hintId}>{hint}</div>}
    </div>
  );
}
