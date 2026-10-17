import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.FORM_PLAYWRIGHT_MODULE||'playwright'),root=fileURLToPath(new URL('../../',import.meta.url));
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,pathname.startsWith('/tests/')?'.'+pathname:'dist/'+(pathname==='/'?'index.html':pathname));if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.FORM_CHROMIUM_PATH,headless:true,args:process.env.FORM_CHROMIUM_MODULE?require(process.env.FORM_CHROMIUM_MODULE).default.args:['--no-sandbox']});
const page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:'+server.address().port);const decoded=[];
 for(const id of ['box','overhang','setback','courtyard','neighbours']){
  const result=await page.evaluate(async id=>{
   const {parseModel}=await import('/model-assets.js'),{transformedTriangles}=await import('/imported-model.js');
   const source=await(await fetch('/tests/fixtures/imports/scene-'+id+'.glb')).arrayBuffer(),asset=await parseModel(new File([source],'scene-'+id+'.glb'));
   const placement={id:'reference-scene',assetId:asset.id,position:asset.sourceOrigin,rotation:0,scale:1,receivers:{}};
   const triangles=transformedTriangles(asset,placement).triangles,meshBounds=asset.meshes.map(m=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<m.positions.length;i++){const k=i%3,v=m.positions[i]+asset.sourceOrigin[k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}return {min,max};});
   return {id,assetId:asset.id,triangles,meshBounds};
  },id);decoded.push(result);console.log('Decoded',id);
 }
 fs.writeFileSync(new URL('./decoded-scenes.json',import.meta.url),JSON.stringify(decoded,null,2)+'\n');
 const safety=await page.evaluate(async()=>{
  const {parseModel}=await import('/model-assets.js');const original=await(await fetch('/tests/fixtures/imports/envelope.glb')).arrayBuffer();
  const mutate=(change)=>{const v=new DataView(original),n=v.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(original,20,n))),bin=new Uint8Array(original,28+n);change(json);const bytes=new TextEncoder().encode(JSON.stringify(json)),size=Math.ceil(bytes.length/4)*4,out=new ArrayBuffer(28+size+bin.length),d=new DataView(out),b=new Uint8Array(out);d.setUint32(0,0x46546c67,true);d.setUint32(4,2,true);d.setUint32(8,out.byteLength,true);d.setUint32(12,size,true);d.setUint32(16,0x4e4f534a,true);b.fill(32,20,20+size);b.set(bytes,20);d.setUint32(20+size,bin.length,true);d.setUint32(24+size,0x004e4942,true);b.set(bin,28+size);return out;};
  const cases=[['external buffer',j=>j.buffers[0].uri='https://example.invalid/source.bin'],['external texture',j=>j.images=[{uri:'https://example.invalid/texture.png'}]],['unsupported compression',j=>j.extensionsRequired=['KHR_draco_mesh_compression']],['animation',j=>j.animations=[{}]],['cyclic hierarchy',j=>j.nodes[0].children=[0]],['allocation budget',j=>j.accessors[0].count=999999999]];
  const results=[];for(const [name,change]of cases){let message='';try{await parseModel(new File([mutate(change)],'invalid.glb'));}catch(e){message=e.message;}results.push({name,rejected:!!message,message});}return results;
 });assert.ok(safety.every(r=>r.rejected));
 fs.writeFileSync(new URL('./rejection-results.json',import.meta.url),JSON.stringify(safety,null,2)+'\n');console.log(safety);
}finally{await browser.close();server.close();}
