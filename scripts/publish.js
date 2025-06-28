#!/usr/bin/env node

import { execSync } from 'child_process';

try {
  // Get the new version from version:update script
  const newVersion = execSync('node scripts/update-version.js', { encoding: 'utf8' }).trim();

  // Run the publish command with the new version
  execSync(`yarn publish --new-version ${newVersion} --non-interactive`, {
    stdio: 'inherit',
    encoding: 'utf8'
  });

  console.log(`✅ Successfully published version ${newVersion}`);
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to publish:', error);
  process.exit(1);
}