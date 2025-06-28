#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packagePath = join(__dirname, '..', 'package.json');

try {
  // Read the current package.json
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;

  // Split version into major, minor, patch
  const [major, minor, patch] = currentVersion.split('.');

  // Increment patch version
  const newVersion = `${major}.${minor}.${parseInt(patch) + 1}`;
  packageJson.version = newVersion;

  // Write back to package.json
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

  // Only output the new version number for capture
  console.log(newVersion);
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to update version:', error);
  process.exit(1);
}