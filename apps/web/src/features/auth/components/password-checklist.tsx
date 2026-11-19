import type { ReactElement } from 'react';
import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '@auth/shared';
import { cn } from '@/lib/utils';

/** Live checklist driven by the exact rules the API enforces (from @auth/shared). */
export function PasswordChecklist({ password }: { password: string }): ReactElement {
  return (
    <ul className="grid gap-1 text-sm" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2',
              met ? 'text-success' : 'text-muted-foreground',
            )}
            data-met={met}
          >
            {met ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
