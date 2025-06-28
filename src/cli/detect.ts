/**
 * OATS Detect Command
 * 
 * Auto-detects project structure and generates configuration
 * 
 * @module @oatsjs/cli/detect
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { glob } from 'glob';

import chalk from 'chalk';
import ora from 'ora';

import type { OatsConfig } from '../types/config.types.js';
import { validateConfig } from '../config/schema.js';
import { FileSystemError } from '../errors/index.js';

interface DetectOptions {
  output: string;
  force?: boolean;
}

interface DetectedService {
  path: string;
  type: 'backend' | 'frontend' | 'client';
  framework?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  apiSpec?: string;
  port?: number;
  packageName?: string;
}

interface ProjectStructure {
  backend?: DetectedService;
  client?: DetectedService;
  frontend?: DetectedService;
  monorepo?: boolean;
  rootPackageManager?: 'npm' | 'yarn' | 'pnpm';
}

/**
 * Detect project structure and create configuration
 */
export async function detect(options: DetectOptions): Promise<void> {
  console.log(chalk.yellow('\n🔍 Auto-detecting project structure...\n'));

  const outputPath = join(process.cwd(), options.output);

  // Check if config already exists
  if (existsSync(outputPath) && !options.force) {
    console.error(
      chalk.red(`Configuration already exists at ${outputPath}`),
      chalk.dim('\nUse --force to overwrite')
    );
    process.exit(1);
  }

  const spinner = ora('Scanning directories...').start();

  try {
    const structure = await detectProjectStructure(process.cwd());
    spinner.succeed('Project structure detected!');

    // Display detected structure
    displayDetectedStructure(structure);

    // Generate configuration
    const config = generateConfigFromStructure(structure);

    // Validate configuration
    const validationSpinner = ora('Validating configuration...').start();
    const validation = validateConfig(config);

    if (!validation.valid) {
      validationSpinner.fail('Generated configuration is invalid');
      console.error(chalk.red('\nValidation errors:'));
      validation.errors.forEach((error) => {
        console.error(chalk.red(`  - ${error.path}: ${error.message}`));
      });
      process.exit(1);
    }

    validationSpinner.succeed('Configuration validated');

    // Write configuration
    const writeSpinner = ora('Writing configuration...').start();
    const configContent = JSON.stringify(config, null, 2);
    writeFileSync(outputPath, configContent);
    writeSpinner.succeed(`Configuration saved to ${outputPath}`);

    console.log('\n' + chalk.green('✅ Detection complete!'));
    console.log('\n' + chalk.bold('Next steps:'));
    console.log(chalk.cyan('  1. Review the configuration:'));
    console.log(chalk.dim(`     cat ${outputPath}`));
    console.log(chalk.cyan('  2. Start watching:'));
    console.log(chalk.dim('     oatsjs start'));

  } catch (error) {
    spinner.fail('Detection failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Detect project structure
 */
export async function detectProjectStructure(rootPath: string): Promise<ProjectStructure> {
  const structure: ProjectStructure = {};

  // Check if it's a monorepo
  structure.monorepo = await isMonorepo(rootPath);
  structure.rootPackageManager = await detectPackageManager(rootPath);

  // Search patterns
  const searchPaths = structure.monorepo
    ? ['packages/*', 'apps/*', 'services/*', '.']
    : ['../*', '.'];

  // Find backend
  for (const pattern of searchPaths) {
    const backend = await findBackend(rootPath, pattern);
    if (backend) {
      structure.backend = backend;
      break;
    }
  }

  // Find client
  for (const pattern of searchPaths) {
    const client = await findClient(rootPath, pattern);
    if (client) {
      structure.client = client;
      break;
    }
  }

  // Find frontend
  for (const pattern of searchPaths) {
    const frontend = await findFrontend(rootPath, pattern);
    if (frontend) {
      structure.frontend = frontend;
      break;
    }
  }

  return structure;
}

/**
 * Check if directory is a monorepo
 */
async function isMonorepo(path: string): Promise<boolean> {
  // Check for common monorepo files
  const monorepoFiles = [
    'lerna.json',
    'nx.json',
    'rush.json',
    'pnpm-workspace.yaml',
    'yarn.lock', // with workspaces in package.json
  ];

  for (const file of monorepoFiles) {
    if (existsSync(join(path, file))) {
      return true;
    }
  }

  // Check for workspaces in package.json
  const packageJsonPath = join(path, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.workspaces) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return false;
}

/**
 * Detect package manager
 */
async function detectPackageManager(path: string): Promise<'npm' | 'yarn' | 'pnpm'> {
  if (existsSync(join(path, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(path, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  return 'npm';
}

/**
 * Find backend service
 */
async function findBackend(rootPath: string, pattern: string): Promise<DetectedService | null> {
  const dirs = await glob(pattern, { cwd: rootPath, absolute: true });

  for (const dir of dirs) {
    if (!existsSync(join(dir, 'package.json'))) continue;

    const packageJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for backend frameworks
    const frameworks = {
      express: 'Express',
      fastify: 'Fastify',
      '@nestjs/core': 'NestJS',
      'koa': 'Koa',
      '@hapi/hapi': 'Hapi',
      'restify': 'Restify',
    };

    for (const [dep, framework] of Object.entries(frameworks)) {
      if (deps[dep]) {
        // Found backend
        const apiSpec = await findApiSpec(dir);
        const packageManager = await detectPackageManager(dir);

        return {
          path: relative(rootPath, dir),
          type: 'backend',
          framework,
          packageManager,
          apiSpec,
          port: detectPort(packageJson),
        };
      }
    }
  }

  return null;
}

/**
 * Find TypeScript client
 */
async function findClient(rootPath: string, pattern: string): Promise<DetectedService | null> {
  const dirs = await glob(pattern, { cwd: rootPath, absolute: true });

  for (const dir of dirs) {
    if (!existsSync(join(dir, 'package.json'))) continue;

    const packageJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    
    // Check for client indicators
    const clientIndicators = [
      packageJson.name?.includes('client'),
      packageJson.name?.includes('api'),
      packageJson.name?.includes('sdk'),
      existsSync(join(dir, 'openapi-ts.config.ts')),
      existsSync(join(dir, 'swagger.json')),
      existsSync(join(dir, 'openapi.json')),
      packageJson.scripts?.generate,
      packageJson.scripts?.codegen,
    ];

    if (clientIndicators.filter(Boolean).length >= 2) {
      const packageManager = await detectPackageManager(dir);

      return {
        path: relative(rootPath, dir),
        type: 'client',
        packageManager,
        packageName: packageJson.name,
      };
    }
  }

  return null;
}

/**
 * Find frontend service
 */
async function findFrontend(rootPath: string, pattern: string): Promise<DetectedService | null> {
  const dirs = await glob(pattern, { cwd: rootPath, absolute: true });

  for (const dir of dirs) {
    if (!existsSync(join(dir, 'package.json'))) continue;

    const packageJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for frontend frameworks
    const frameworks = {
      react: 'React',
      vue: 'Vue',
      '@angular/core': 'Angular',
      svelte: 'Svelte',
      next: 'Next.js',
      nuxt: 'Nuxt',
      '@remix-run/react': 'Remix',
    };

    for (const [dep, framework] of Object.entries(frameworks)) {
      if (deps[dep]) {
        const packageManager = await detectPackageManager(dir);

        return {
          path: relative(rootPath, dir),
          type: 'frontend',
          framework,
          packageManager,
          port: detectPort(packageJson),
        };
      }
    }
  }

  return null;
}

/**
 * Find API specification file
 */
async function findApiSpec(dir: string): Promise<string | undefined> {
  const patterns = [
    'swagger.json',
    'openapi.json',
    'swagger.yaml',
    'openapi.yaml',
    'src/swagger.json',
    'src/openapi.json',
    'dist/swagger.json',
    'dist/openapi.json',
    'docs/swagger.json',
    'docs/openapi.json',
    'src/public/tsoa/swagger.json',
  ];

  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: dir });
    if (files.length > 0) {
      return files[0];
    }
  }

  return undefined;
}

/**
 * Detect port from package.json scripts
 */
function detectPort(packageJson: any): number | undefined {
  const scripts = packageJson.scripts || {};
  const scriptValues = Object.values(scripts).join(' ');

  // Look for port patterns
  const portMatch = scriptValues.match(/(?:--port|PORT=|-p\s+)(\d{4,5})/);
  if (portMatch) {
    return parseInt(portMatch[1], 10);
  }

  return undefined;
}

/**
 * Display detected structure
 */
function displayDetectedStructure(structure: ProjectStructure): void {
  console.log('\n' + chalk.bold('Detected structure:'));

  if (structure.monorepo) {
    console.log(chalk.cyan('  📦 Monorepo') + chalk.dim(` (${structure.rootPackageManager})`));
  }

  if (structure.backend) {
    console.log(
      chalk.cyan('  🖥️  Backend:'),
      chalk.green(structure.backend.path),
      chalk.dim(`(${structure.backend.framework})`)
    );
    if (structure.backend.apiSpec) {
      console.log(chalk.dim(`     API Spec: ${structure.backend.apiSpec}`));
    }
  }

  if (structure.client) {
    console.log(
      chalk.cyan('  📡 Client:'),
      chalk.green(structure.client.path),
      chalk.dim(`(${structure.client.packageName})`)
    );
  }

  if (structure.frontend) {
    console.log(
      chalk.cyan('  🎨 Frontend:'),
      chalk.green(structure.frontend.path),
      chalk.dim(`(${structure.frontend.framework})`)
    );
  }

  if (!structure.backend && !structure.client && !structure.frontend) {
    console.log(chalk.yellow('  ⚠️  No services detected'));
  }
}

/**
 * Generate configuration from detected structure
 */
function generateConfigFromStructure(structure: ProjectStructure): OatsConfig {
  if (!structure.backend || !structure.client) {
    throw new Error(
      'Could not detect required services. Please ensure you have both a backend and client project.'
    );
  }

  const config: OatsConfig = {
    services: {
      backend: {
        path: structure.backend.path,
        port: structure.backend.port || 4000,
        startCommand: structure.backend.packageManager === 'yarn' ? 'yarn dev' : 'npm run dev',
        apiSpec: {
          path: structure.backend.apiSpec || 'src/swagger.json',
        },
      },
      client: {
        path: structure.client.path,
        packageName: structure.client.packageName || '@myorg/api-client',
        generator: 'custom',
        generateCommand:
          structure.client.packageManager === 'yarn' ? 'yarn generate' : 'npm run generate',
        buildCommand: structure.client.packageManager === 'yarn' ? 'yarn build' : 'npm run build',
        linkCommand: structure.client.packageManager === 'yarn' ? 'yarn link' : 'npm link',
      },
    },
  };

  // Add frontend if detected
  if (structure.frontend) {
    config.services.frontend = {
      path: structure.frontend.path,
      port: structure.frontend.port || 3000,
      startCommand: structure.frontend.packageManager === 'yarn' ? 'yarn dev' : 'npm run dev',
      packageLinkCommand:
        structure.frontend.packageManager === 'yarn' ? 'yarn link' : 'npm link',
    };
  }

  return config;
}