declare module 'detect-port' {
  /**
   * Detect if a port is available
   * @param port - The port to check
   * @returns A promise that resolves with the first available port (might be different from input if occupied)
   */
  function detectPort(port: number): Promise<number>;

  /**
   * Detect if a port is available (callback style)
   * @param port - The port to check
   * @param callback - Callback function that receives (err, port)
   */
  function detectPort(
    port: number,
    callback: (err: Error | null, port: number) => void
  ): void;

  export = detectPort;
}