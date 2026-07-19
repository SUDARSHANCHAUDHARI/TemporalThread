#!/usr/bin/env node
import { errorMessage } from './output.js';
import { runCli } from './program.js';

runCli().catch((error) => {
  process.stderr.write(`Error: ${errorMessage(error)}\n`);
  process.exitCode = 1;
});
