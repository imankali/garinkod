// frontend/src/test/auth.ts
//
// Putting a test into a session, without the login round trip.
//
// The app's auth state lives in one zustand store, so a test can say exactly
// who is looking at the page. Everything starts signed out (see setup.ts) because
// that is the state a public page is designed for; a component test that needs a
// user calls `signIn` with only the fields that matter to it.

import { useAuthStore } from '../store/authStore';
import type { User } from '@/types/user';

/** Anything a test wants to override on the user record. */
export type TestUser = Partial<User>;

/** A signed-out visitor whose session has already been resolved. */
export function signOut() {
  useAuthStore.setState({ user: null, isAuthenticated: false, isSessionChecked: true });
}

/** Signed in, but the session check has not come back yet. */
export function sessionPending(user: TestUser = {}) {
  useAuthStore.setState({
    user: { id: 1, username: 'karbar', email: '', ...user } as User,
    isAuthenticated: true,
    isSessionChecked: false,
  });
}

/** A signed-in user; `first_name`/`last_name` default to a filled profile. */
export function signIn(user: TestUser = {}) {
  useAuthStore.setState({
    user: {
      id: 1,
      username: 'karbar',
      email: 'karbar@example.test',
      first_name: 'زهرا',
      last_name: 'بهاران',
      ...user,
    } as User,
    isAuthenticated: true,
    isSessionChecked: true,
  });
}
