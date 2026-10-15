import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const name of ['engine','renderer'])await build({entryPoints:[root+`src/${name}.ts`],outfile:root+`public/${name}.mjs`,bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'inline',banner:{js:'// Battle City adaptation. Upstream MIT: assets/battle-city-license.html'}});
console.log('Built independent tank engine + Canvas renderer');
