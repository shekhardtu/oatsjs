declare module 'detect-port' {
  function detectPort(port: number): Promise<number>;
  function detectPort(
    port: number,
    callback: (err: Error | null, port: number) => void
  ): void;
  
  export = detectPort;
}