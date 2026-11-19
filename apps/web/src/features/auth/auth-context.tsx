import {
  type ReactElement,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, SignInInput, SignUpInput, UserDto } from '@auth/shared';
import { authApi } from '@/lib/api/auth-api';
import { onSessionChange, refreshSession, setSession } from '@/lib/api/client';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh this long before the access token expires, so requests rarely see a 401. */
const REFRESH_LEEWAY_SECONDS = 60;

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDto | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  // Single source of truth: every session change (sign-in, refresh, expiry) flows through here.
  useEffect(
    () =>
      onSessionChange((session: AuthResponse | null) => {
        setUser(session?.user ?? null);
        setExpiresIn(session?.expiresIn ?? null);
        setStatus(session ? 'authenticated' : 'anonymous');
        if (!session) queryClient.clear();
      }),
    [queryClient],
  );

  // Silent sign-in on load using the httpOnly refresh cookie.
  useEffect(() => {
    void refreshSession();
  }, []);

  // Proactive refresh shortly before expiry.
  useEffect(() => {
    if (expiresIn === null) return;
    const delayMs = Math.max(expiresIn - REFRESH_LEEWAY_SECONDS, 5) * 1000;
    const timer = window.setTimeout(() => void refreshSession(), delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [expiresIn]);

  const signIn = useCallback(async (input: SignInInput) => {
    setSession(await authApi.signIn(input));
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    setSession(await authApi.signUp(input));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setSession(null); // clear local state even if the network call fails
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, logout, logoutAll }),
    [status, user, signIn, signUp, logout, logoutAll],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
