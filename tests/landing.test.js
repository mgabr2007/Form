import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync('public/welcome.html','utf8');
test('landing page local navigation and media resolve',()=>{
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const [,url] of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)){
    if(url.startsWith('#'))assert.ok(ids.has(url.slice(1)),url);
    else if(url!=='./'&&!/^(https?:|data:)/.test(url))assert.ok(existsSync('public/'+url.split(/[?#]/)[0]),url);
  }
});
test('landing distinguishes structural exploration from environmental comparison',()=>{
  assert.ok(html.includes('id="structure"'));
  assert.ok(html.includes('studio.html#structure'));
  assert.ok(html.includes('not a coupled simulation'));
  assert.ok(html.includes('not a safety verdict'));
  assert.ok(html.includes('does not compare structural runs'));
  assert.ok(html.includes('Structural runs are separate from cloud snapshots'));
});
test('landing videos retain controls and illustrative labels',()=>{
  const videos=[...html.matchAll(/<video\b([^>]+)>/g)];
  assert.equal(videos.length,3);
  for(const [,attributes] of videos)assert.ok(attributes.includes('controls'));
  assert.ok(html.includes('schematic, not simulated results'));
});
