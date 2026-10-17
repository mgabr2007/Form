import {zipSync,unzipSync,strToU8,strFromU8} from './vendor/imports/fflate.js';
import {IMPORT_LIMITS} from './imported-model.js';
self.onmessage=({data})=>{
  try{
    if(data.action==='write'){
      const descriptors=data.assets.map(a=>({id:a.id,name:a.name,path:'models/'+a.id+'.'+a.format.toLowerCase()}));
      const entries={'project.json':strToU8(JSON.stringify({format:'FORM-project-package',version:1,project:data.project,assets:descriptors}))};
      let bytes=entries['project.json'].length;
      for(let i=0;i<data.assets.length;i++){const source=new Uint8Array(data.assets[i].source);bytes+=source.length;entries[descriptors[i].path]=source;}
      if(bytes>IMPORT_LIMITS.packageBytes)throw Error('Model sources exceed the 100 MiB portable package budget.');
      const zip=zipSync(entries,{level:0}),buffer=zip.buffer;self.postMessage({buffer},[buffer]);
    }else{
      if(data.buffer.byteLength>IMPORT_LIMITS.packageBytes)throw Error('Project package exceeds 100 MiB.');
      let size=0,count=0;
      const entries=unzipSync(new Uint8Array(data.buffer),{filter:entry=>{
        count++;size+=entry.originalSize;
        if(count>IMPORT_LIMITS.instances+1||size>IMPORT_LIMITS.expandedBytes)throw Error('Package expansion exceeds the import budget.');
        if(entry.name!=='project.json'&&!/^models\/[a-f0-9]{64}\.(glb|ifc)$/.test(entry.name))throw Error('Unexpected package entry.');
        if(entry.name==='project.json'&&entry.originalSize>1024*1024||entry.name!=='project.json'&&entry.originalSize>IMPORT_LIMITS.fileBytes)throw Error('Package entry is too large.');
        return true;
      }});
      if(!entries['project.json'])throw Error('Package has no project manifest.');
      const manifest=JSON.parse(strFromU8(entries['project.json']));
      if(manifest.format!=='FORM-project-package'||manifest.version!==1||!Array.isArray(manifest.assets)||manifest.assets.length>IMPORT_LIMITS.instances)throw Error('Unsupported FORM package.');
      const ids=new Set();const sources=manifest.assets.map(a=>{
        if(!/^[a-f0-9]{64}$/.test(a.id)||ids.has(a.id)||!new RegExp('^models/'+a.id+'\\.(glb|ifc)$').test(a.path)||!entries[a.path])throw Error('Missing or invalid packaged model.');ids.add(a.id);
        const extension=a.path.slice(a.path.lastIndexOf('.'));
        return {id:a.id,name:String(a.name||'model').replace(/\.(glb|ifc)$/i,'')+extension,source:entries[a.path].buffer};
      });
      for(const item of manifest.project?.imports?.items||[])if(!ids.has(item.assetId))throw Error('A model referenced by this project is absent from the package.');
      self.postMessage({project:manifest.project,sources},sources.map(s=>s.source));
    }
  }catch(e){self.postMessage({error:e.message||String(e)});}
};
