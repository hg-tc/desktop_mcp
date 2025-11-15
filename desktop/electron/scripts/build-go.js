#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const goBackendDir = path.join(repoRoot, 'backend', 'go');
const outputDir = path.resolve(__dirname, '..', 'dist', 'bin');
const executableName =
  process.platform === 'win32' ? 'xiaohongshu-mcp.exe' : 'xiaohongshu-mcp';
const outputPath = path.join(outputDir, executableName);

fs.mkdirSync(outputDir, { recursive: true });

console.log('Building Go service...');

const result = spawnSync('go', ['build', '-o', outputPath, '.'], {
  cwd: goBackendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    CGO_ENABLED: '0'
  }
});

if (result.status !== 0) {
  console.error('Failed to compile Go service.');
  process.exit(result.status ?? 1);
}

console.log('Go service built at', outputPath);

