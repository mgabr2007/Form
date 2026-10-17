const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function projectAPI(request,env){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'Sign in to store projects in your account.'},401);
 if(!env.BUCKET)return json({error:'Cloud storage is not configured.'},503);
 const prefix='projects/'+encodeURIComponent(user)+'/',url=new URL(request.url);
 try{
 if(request.method==='GET'){
  const id=url.searchParams.get('snapshot');if(id){if(!/^[a-zA-Z0-9_-]+$/.test(id))return json({error:'Invalid snapshot'},400);const object=await env.BUCKET.get(prefix+id);if(!object)return json({error:'Snapshot not found'},404);return new Response(object.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
  const page=await env.BUCKET.list({prefix,limit:100,include:['customMetadata'],cursor:url.searchParams.get('cursor')||undefined});return json({snapshots:page.objects.map(o=>({id:o.key.slice(prefix.length),...o.customMetadata,uploaded:o.uploaded})),cursor:page.truncated?page.cursor:null});
 }
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return json({error:'Invalid origin'},403);
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing body'},400);const chunks=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>8*1024*1024){await reader.cancel();return json({error:'Cloud snapshot exceeds 8 MB. Export a local backup.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const text=new TextDecoder().decode(bytes),data=JSON.parse(text);
  if(data.schema!=='form-project-bundle-v2'||typeof data.project?.id!=='string'||!Array.isArray(data.project.revisions)||!Array.isArray(data.runs))return json({error:'Invalid project bundle'},400);
  const id=crypto.randomUUID();await env.BUCKET.put(prefix+id,text,{httpMetadata:{contentType:'application/json'},customMetadata:{projectId:data.project.id.slice(0,100),name:String(data.project.name||'Project').slice(0,100)}});return json({id},201);
 }
 return json({error:'Method not allowed'},405);
 }catch{return json({error:'Project request failed. Local data is unchanged.'},400);}
}
