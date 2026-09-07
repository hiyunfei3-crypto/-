// Use the same Vinext build/prerender APIs as its CLI, but allow a graceful
// Node shutdown. Forced process.exit() crashes libuv after prerender on Windows.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { access } from 'node:fs/promises';

process.env.NODE_ENV = 'production';
const { createBuilder } = await import('vite');
const { loadNextConfig, resolveNextConfig, createRscCompatibilityId, PHASE_PRODUCTION_BUILD } = await import('../node_modules/vinext/dist/config/next-config.js');
const { runPrerender } = await import('../node_modules/vinext/dist/build/run-prerender.js');
const { emitPrerenderPathManifest } = await import('../node_modules/vinext/dist/build/prerender-paths.js');
const { cleanBuildOutput } = await import('../node_modules/vinext/dist/build/clean-output.js');
const root = process.cwd().replaceAll('\\', '/');
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== path.resolve(root)) throw new Error('Build output must stay inside the project');
await access(path.join(root, '.openai/hosting.json'));
const config = await resolveNextConfig(await loadNextConfig(root, PHASE_PRODUCTION_BUILD), root);
if (config.output !== 'export') throw new Error('This build requires output: export');
process.env.__VINEXT_SHARED_BUILD_ID = config.buildId;
process.env.__VINEXT_SHARED_RSC_COMPATIBILITY_ID = createRscCompatibilityId(config);
process.env.__VINEXT_SHARED_REVALIDATE_SECRET = randomBytes(32).toString('hex');
console.log('Building static song catalogue in ' + output);
cleanBuildOutput({ root, outDir: output });
const builder = await createBuilder({ mode: 'production' });
await builder.buildApp();
await runPrerender({ root, nextConfig: config });
await emitPrerenderPathManifest({ root, nextConfig: config });
await access(path.join(output, 'client/index.html'));
console.log('Static build passed: dist/client/index.html');
