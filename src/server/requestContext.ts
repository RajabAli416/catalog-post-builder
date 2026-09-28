import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<{ userId: string }>();

export function runAsUser<T>(userId: string, fn: () => T): T {
  return storage.run({ userId }, fn);
}

export function currentUserId(): string {
  const userId = storage.getStore()?.userId;
  if (!userId) {
    throw new Error('Sign in required.');
  }
  return userId;
}
