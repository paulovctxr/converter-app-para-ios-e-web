import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
test('install manifest and brand icon return valid PNGs at supported sizes',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.icons[0].sizes,'192x192');assert.equal(manifest.icons[1].sizes,'512x512');
  const source=await readFile(new URL('../app/pwa-icon/route.tsx',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const output={};new Function('require','exports',code)(require,output);
  for(const size of [180,192,512]){
    const response=await output.GET(new Request(`https://test/pwa-icon?size=${size}`));
    assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith('image/png'));
    const png=Buffer.from(await response.arrayBuffer());assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
});

test('Android install keeps the native prompt in the user click and supports in-app browsers',async()=>{
  const source=await readFile(new URL('../components/install-app.tsx',import.meta.url),'utf8');
  assert.match(source,/beforeinstallprompt/);
  assert.match(source,/await event\.prompt\(\)/);
  assert.match(source,/package=com\.android\.chrome/);
  assert.match(source,/appinstalled/);
});
