import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({entryPoints:[root+'src/engine.mjs'],outfile:root+'public/engine.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022'});
console.log('Built independent Contra campaign engine (8 operations)');
