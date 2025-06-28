/// <reference types="jest" />

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidConfig(): R;
      toHaveConfigError(path: string): R;
    }
  }
}

export { };
