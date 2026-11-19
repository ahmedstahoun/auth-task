import {
  authResponseSchema,
  sessionDtoSchema,
  userDtoSchema,
  type AuthResponse,
  type SessionDto,
  type SignInInput,
  type SignUpInput,
  type UserDto,
} from '@auth/shared';
import { api } from './client';

/** Every response is parsed against the shared contract — the UI never trusts `response.data`. */
export const authApi = {
  signUp: async (input: SignUpInput): Promise<AuthResponse> =>
    authResponseSchema.parse((await api.post<unknown>('/auth/signup', input)).data),

  signIn: async (input: SignInInput): Promise<AuthResponse> =>
    authResponseSchema.parse((await api.post<unknown>('/auth/signin', input)).data),

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  logoutAll: async (): Promise<void> => {
    await api.post('/auth/logout-all');
  },

  me: async (): Promise<UserDto> => userDtoSchema.parse((await api.get<unknown>('/users/me')).data),

  sessions: async (): Promise<SessionDto[]> =>
    sessionDtoSchema.array().parse((await api.get<unknown>('/auth/sessions')).data),
};
