/**
 * TypeScript declarations for oats.config.json
 * 
 * This file provides TypeScript type definitions for the OATS configuration file.
 * It enables IntelliSense and type checking when working with oats.config.json
 * in TypeScript-aware editors.
 */

declare module "*/oats.config.json" {
  interface OatsConfig {
    /**
     * JSON Schema reference for IDE support
     * @default "https://raw.githubusercontent.com/shekhardtu/oatsjs/main/schema/oats.schema.json"
     */
    $schema?: string;

    /**
     * Configuration schema version
     * @default "1.0.0"
     */
    version?: string;

    /**
     * Service configurations
     */
    services: {
      /**
       * Backend service configuration
       */
      backend: BackendServiceConfig;

      /**
       * TypeScript client configuration
       */
      client: ClientServiceConfig;

      /**
       * Frontend service configuration (optional)
       */
      frontend?: FrontendServiceConfig;
    };

    /**
     * Synchronization settings (optional)
     */
    sync?: SyncConfig;

    /**
     * Logging configuration (optional)
     */
    log?: LogConfig;

    /**
     * Custom metadata for extensions (optional)
     */
    metadata?: Record<string, any>;
  }

  interface BackendServiceConfig {
    /**
     * Service type identifier
     * @default "openapi"
     */
    type?: "openapi" | "graphql" | "custom";

    /**
     * Relative path to backend directory
     */
    path: string;

    /**
     * Port number for the backend development server
     * @default 4000
     */
    port?: number;

    /**
     * Command to start the backend service
     */
    startCommand: string;

    /**
     * Pattern to detect when the backend is ready
     * @default "Server listening on"
     */
    readyPattern?: string;

    /**
     * API specification configuration
     */
    apiSpec: {
      /**
       * Path to the API specification file (relative to backend directory)
       */
      path: string;

      /**
       * API specification format
       * @default "openapi3"
       */
      format?: "openapi3" | "openapi2" | "swagger";

      /**
       * Additional file patterns to watch for changes
       */
      watch?: string[];
    };

    /**
     * Environment variables to set when starting the service
     */
    env?: Record<string, string>;

    /**
     * Working directory for the start command
     * @default The service path
     */
    cwd?: string;
  }

  interface ClientServiceConfig {
    /**
     * Service type identifier
     * @default "typescript-client"
     */
    type?: "typescript-client" | "custom";

    /**
     * Relative path to client directory
     */
    path: string;

    /**
     * Code generator to use
     */
    generator: "@hey-api/openapi-ts" | "openapi-generator" | "swagger-typescript-api" | "custom";

    /**
     * Package name for the generated client
     */
    packageName: string;

    /**
     * Command to generate the client (when generator is "custom")
     */
    generateCommand?: string;

    /**
     * Command to build the client package
     */
    buildCommand?: string;

    /**
     * Command to link the package for local development
     * @default "npm link" or "yarn link" based on package manager
     */
    linkCommand?: string;

    /**
     * Command to run after generation
     */
    postGenerate?: string;

    /**
     * Whether to automatically install dependencies after generation
     * @default false
     */
    autoInstall?: boolean;

    /**
     * Generator-specific configuration (when not using "custom")
     */
    generatorConfig?: {
      /**
       * Input file path (relative to client directory)
       * @default "./swagger.json"
       */
      input?: string;

      /**
       * Output directory for generated code
       * @default "./src"
       */
      output?: string;

      /**
       * HTTP client library to use
       * @default "axios"
       */
      client?: "axios" | "fetch" | "xhr" | "node";

      /**
       * Additional generator options
       */
      [key: string]: any;
    };
  }

  interface FrontendServiceConfig {
    /**
     * Service type identifier
     * @default "webapp"
     */
    type?: "webapp" | "mobile" | "desktop";

    /**
     * Relative path to frontend directory
     */
    path: string;

    /**
     * Port number for the frontend development server
     * @default 3000
     */
    port?: number;

    /**
     * Command to start the frontend service
     */
    startCommand: string;

    /**
     * Pattern to detect when the frontend is ready
     * @default "compiled successfully"
     */
    readyPattern?: string;

    /**
     * Command to link packages in the frontend
     * @default "npm link" or "yarn link" based on package manager
     */
    packageLinkCommand?: string;

    /**
     * Frontend framework (for future framework-specific features)
     * @default "auto-detect"
     */
    framework?: "react" | "vue" | "angular" | "svelte" | "next" | "nuxt" | "auto-detect";

    /**
     * Environment variables to set when starting the frontend service
     */
    env?: Record<string, string>;
  }

  interface SyncConfig {
    /**
     * Synchronization strategy
     * @default "smart"
     */
    strategy?: "smart" | "aggressive" | "manual";

    /**
     * Debounce delay in milliseconds before syncing
     * @default 1000
     */
    debounceMs?: number;

    /**
     * Automatically link packages after generation
     * @default true
     */
    autoLink?: boolean;

    /**
     * Show desktop notifications for sync events
     * @default true
     */
    notifications?: boolean;

    /**
     * Number of retry attempts for failed syncs
     * @default 3
     */
    retryAttempts?: number;

    /**
     * Delay between retry attempts in milliseconds
     * @default 2000
     */
    retryDelayMs?: number;

    /**
     * File patterns to ignore during sync
     */
    ignore?: string[];
  }

  interface LogConfig {
    /**
     * Minimal output mode
     * @default false
     */
    quiet?: boolean;

    /**
     * Show timestamps in logs
     * @default true
     */
    timestamp?: boolean;

    /**
     * Use colored output
     * @default true
     */
    color?: boolean;

    /**
     * Show output from individual services
     * @default true
     */
    showServiceOutput?: boolean;

    /**
     * Log level
     * @default "info"
     */
    level?: "debug" | "info" | "warn" | "error";
  }

  const config: OatsConfig;
  export default config;
}