import { validateProject, validateBuild, requireCondition, isMain, safeFailure } from './validation.mjs';

if (isMain(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    requireCondition(args.length === 0 || (args.length === 1 && args[0] === '--production'), 'INVALID_ARGUMENT');
    console.log(JSON.stringify(args.length ? await validateBuild() : await validateProject(), null, 2));
  }
  catch (error) { console.error(safeFailure(error)); process.exitCode = 1; }
}
