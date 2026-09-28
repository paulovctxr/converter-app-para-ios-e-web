import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=(await readFile(new URL('../supabase/functions/community-cleanup/index.ts',import.meta.url),'utf8')).replace(/^import .*;\n/,'');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const secret='a'.repeat(64);
function setup({envSecret=secret,storageError=false}={}){
  const calls=[];let handler;let runs=0;
  const select={lte:()=>select,or:()=>select,order:()=>select,limit:async()=>({data:runs++===0?[{id:'story-1',image_path:'user/story-1.jpg'}]:[],error:null})};
  const db={from:()=>({select:()=>select,delete:()=>({in:async(_,ids)=>{calls.push(['rows',ids]);return {error:null};}})}),storage:{from:(bucket)=>({remove:async(paths)=>{calls.push(['files',bucket,paths]);return {error:storageError?new Error('offline'):null};}})}};
  new Function('Deno','createClient',code)({env:{get:(key)=>key==='COMMUNITY_CLEANUP_SECRET'?envSecret:'server-only-test'},serve:fn=>{handler=fn;}},()=>db);
  return {handler,calls};
}
test('cleanup rejects missing secrets and unauthorized invocations without deleting files',async()=>{
  let state=setup();assert.equal((await state.handler(new Request('https://test',{method:'POST'}))).status,401);assert.deepEqual(state.calls,[]);
  state=setup({envSecret:''});assert.equal((await state.handler(new Request('https://test',{method:'POST'}))).status,503);
});
test('cleanup removes files before rows and preserves rows on Storage failure',async()=>{
  const req=()=>new Request('https://test',{method:'POST',headers:{authorization:`Bearer ${secret}`}});
  let state=setup();const result=await state.handler(req());assert.equal(result.status,200);assert.equal((await result.json()).removed,1);assert.equal(state.calls[0][0],'files');assert.equal(state.calls[1][0],'rows');
  state=setup({storageError:true});assert.equal((await state.handler(req())).status,500);assert.equal(state.calls.length,1);
});
