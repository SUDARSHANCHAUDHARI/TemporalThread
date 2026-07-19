#!/usr/bin/env node
import { doctorCodexIntegration } from './installer-lib.mjs';

const targetIndex = process.argv.indexOf('--target');
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : process.cwd();
if (!target) throw new Error('--target requires a directory');
const result = doctorCodexIntegration(target);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
