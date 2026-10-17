import fs from 'node:fs';
import {glbFromMeshes} from './make-fixtures.mjs';
const spec=JSON.parse(fs.readFileSync(new URL('../radiance/scenes.json',import.meta.url)));
function boxTriangles(box){const [x0,y0,z0]=box.min,[x1,y1,z1]=box.max,v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];return [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]].flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]].flatMap(i=>v[i]));}
for(const scene of spec.scenes)fs.writeFileSync(new URL('../../tests/fixtures/imports/scene-'+scene.id+'.glb',import.meta.url),glbFromMeshes(scene.boxes.map(box=>({name:box.name,positions:boxTriangles(box)}))));
