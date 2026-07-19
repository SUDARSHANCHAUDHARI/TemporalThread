#!/usr/bin/env node
import { installCodexIntegration } from './installer-lib.mjs';

const targetIndex = process.argv.indexOf('--target');
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : process.cwd();
if (!target) throw new Error('--target requires a directory');
process.stdout.write(`${JSON.stringify(installCodexIntegration(target), null, 2)}\n`);
