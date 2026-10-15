import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createAppServer} from '../server.mjs';

const jpeg=await readFile(new URL('./fixture.jpg',import.meta.url));
const imageData='data:image/jpeg;base64,'+jpeg.toString('base64');
const SCORE_79='창의성: 구도=20, 아이디어=22, 표현=18, 재미=19';
const fortune=(scoreLine=SCORE_79)=>'제목: 🍀 행운 한 스푼\n운세: 즐거운 축제 하루예요!\n작은 웃음이 행운을 불러올지도 몰라요.\n친구에게 먼저 인사해 보세요.\n행운의 아이템: 🎧 이어폰\n오늘의 미션: 친구와 인사하기'+(scoreLine?'\n'+scoreLine:'');

let upstreamCalls=[], claudeText=fortune(), delayMs=0, failStatus=0, stopReason='end_turn';
const resetMock=()=>{upstreamCalls=[];claudeText=fortune();delayMs=0;failStatus=0;stopReason='end_turn';};
const mockClaude=async (url,opts)=>{
  upstreamCalls.push({url,options:JSON.parse(opts.body), headers:opts.headers});
  if(delayMs) await new Promise(resolve=>setTimeout(resolve,delayMs));
  if(failStatus) return new Response('{}',{status:failStatus});
  return new Response(JSON.stringify({
    stop_reason:stopReason,
    content:[{type:'thinking',signature:'hidden'}, {type:'text', text:claudeText}]
  }),{status:200,headers:{'content-type':'application/json'}});
};

const baseEnv={ANTHROPIC_API_KEY:'test-key', ANTHROPIC_MODEL:'claude-haiku-5-5',DAILY_API_LIMIT:'200',IP_LIMIT_PER_15MIN:'200'};
const cleanups=[];
async function startApp(extraEnv={}) {
  const dir=await mkdtemp(path.join(tmpdir(),'fortune-test-'));
  const env={...baseEnv,DATA_DIR:dir,...extraEnv};
  const server=createAppServer({env,requestFetch:mockClaude});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const jsonPost=(route,data,headers={})=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)});
  cleanups.push(async()=>{await new Promise(resolve=>server.close(resolve)); await rm(dir,{recursive:true,force:true});});
  return {base,dir,env,
    post:(data,headers)=>jsonPost('/api/fortune',data,headers),
    admin:(data,headers)=>jsonPost('/api/admin/ranking',data,headers)};
}
after(async()=>{for(const cleanup of cleanups) await cleanup();});

const device=n=>`device-${String(n).padStart(12,'0')}`;
const submit=(app,n,type='love')=>app.post({imageData,fortuneType:type,consent:true,deviceId:device(n)});
const app=await startApp({ADMIN_PASSWORD:'test-admin-password'});

test('GET website and healthy server',async()=>{
  const home=await fetch(app.base+'/');assert.equal(home.status,200);
  assert.match(await home.text(),/배명고등학교/);
  const health=await fetch(app.base+'/api/health');
  assert.deepEqual(await health.json(),{ok:true,apiConfigured:true});
});
test('must consent, upload a photo, choose a valid fortune, and send a device id',async()=>{
  const ok={imageData,fortuneType:'love',consent:true,deviceId:device(900)};
  let r=await app.post({...ok,consent:false});assert.equal(r.status,400);
  r=await app.post({...ok,imageData:null});assert.equal(r.status,400);
  r=await app.post({...ok,fortuneType:'unknown'});assert.equal(r.status,400);
  r=await app.post({...ok,imageData:'data:text/html;base64,PGgxPg=='});assert.equal(r.status,400);
  r=await app.post({...ok,deviceId:undefined});assert.equal(r.status,400);
  r=await app.post({...ok,deviceId:'short'});assert.equal(r.status,400);
  r=await app.post({...ok,deviceId:'has spaces and !! symbols'});assert.equal(r.status,400);
});
test('reject cross origin POST',async()=>{
  const r=await app.post({imageData,fortuneType:'love',consent:true,deviceId:device(901)},{origin:'https://attacker.example'});
  assert.equal(r.status,403);
});
test('send real image and type in Anthropic vision request; show returned text without the score line',async()=>{
  resetMock();
  const r=await submit(app,1,'friend');
  assert.equal(r.status,200);
  const payload=await r.json();
  assert.equal(payload.fortuneType,'friend');
  assert.match(payload.result,/행운 한 스푼/);
  assert.doesNotMatch(payload.result,/창의성/);
  assert.equal(upstreamCalls.length,1);
  assert.equal(upstreamCalls[0].url,'https://api.anthropic.com/v1/messages');
  assert.equal(upstreamCalls[0].options.model,'claude-haiku-5-5');
  assert.equal(upstreamCalls[0].options.messages[0].content[0].type,'image');
  assert.equal(upstreamCalls[0].options.messages[0].content[0].source.media_type,'image/jpeg');
  assert.equal(upstreamCalls[0].headers['x-api-key'],'test-key');
  assert.match(upstreamCalls[0].options.system,/존댓말/);
  assert.match(upstreamCalls[0].options.system,/창의성/);
});
test('first submission gets a lucky number (sum of 4 parts) and a confirmation code',async()=>{
  resetMock();
  const payload=await (await submit(app,2)).json();
  assert.equal(payload.luckyNumber,79);
  assert.match(payload.entryCode,/^[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(payload.counted,true);
});
test('a device is ranked once: repeat gets a new fortune but keeps the first score and code',async()=>{
  resetMock();
  const first=await (await submit(app,3)).json();
  claudeText=fortune('창의성: 구도=25, 아이디어=25, 표현=25, 재미=25');
  const again=await (await submit(app,3)).json();
  assert.equal(upstreamCalls.length,2);
  assert.equal(again.counted,false);
  assert.equal(again.luckyNumber,first.luckyNumber);
  assert.equal(again.entryCode,first.entryCode);
});
test('missing or out-of-range score is not ranked and does not use up the device',async()=>{
  resetMock();
  claudeText=fortune('');
  let payload=await (await submit(app,4)).json();
  assert.equal(payload.luckyNumber,null);assert.equal(payload.counted,false);assert.match(payload.result,/행운 한 스푼/);
  claudeText=fortune('창의성: 구도=30, 아이디어=22, 표현=18, 재미=19');
  payload=await (await submit(app,4)).json();
  assert.equal(payload.luckyNumber,null);assert.doesNotMatch(payload.result,/창의성/);
  claudeText=fortune('창의성: 구도=10, 아이디어=10, 표현=10, 재미=10');
  payload=await (await submit(app,4)).json();
  assert.equal(payload.luckyNumber,40);assert.equal(payload.counted,true);
});
test('an upstream failure does not use up the device',async()=>{
  resetMock();failStatus=500;
  let r=await submit(app,5);assert.equal(r.status,502);
  failStatus=0;
  const payload=await (await submit(app,5)).json();
  assert.equal(payload.counted,true);
});
test('a response cut off by max_tokens is never shown or ranked, and leaves the device unused',async()=>{
  resetMock();stopReason='max_tokens';claudeText=fortune().slice(0,30);
  const r=await submit(app,7);
  assert.equal(r.status,502);
  assert.doesNotMatch(JSON.stringify(await r.json()),/행운 한 스푼/);
  assert.ok(upstreamCalls[0].options.max_tokens>=2000);
  resetMock();
  assert.equal((await (await submit(app,7)).json()).counted,true);
});
test('two simultaneous requests from one device create only one ranked entry',async()=>{
  resetMock();delayMs=40;
  const [a,b]=await Promise.all([submit(app,6),submit(app,6)].map(p=>p.then(r=>r.json())));
  assert.equal([a,b].filter(x=>x.counted).length,1);
  delayMs=0;
  const later=await (await submit(app,6)).json();
  assert.equal(later.counted,false);
  assert.equal(typeof later.luckyNumber,'number');
});

test('admin ranking needs the right password and sorts by score, then tie-break rules',async()=>{
  const ranked=await startApp({ADMIN_PASSWORD:'ranking-test-password'});
  const scores={
    10:'창의성: 구도=20, 아이디어=20, 표현=20, 재미=20', // 80, idea 20
    11:'창의성: 구도=18, 아이디어=22, 표현=20, 재미=20', // 80, idea 22 -> beats 10
    12:'창의성: 구도=25, 아이디어=25, 표현=25, 재미=25', // 100
    13:'창의성: 구도=18, 아이디어=22, 표현=20, 재미=20'  // 80, same parts as 11 but later -> after 11
  };
  for(const n of [10,11,12,13]) {resetMock();claudeText=fortune(scores[n]);assert.equal((await submit(ranked,n)).status,200);}
  assert.equal((await ranked.admin({password:'wrong-password'})).status,401);
  assert.equal((await ranked.admin({})).status,401);
  const r=await ranked.admin({password:'ranking-test-password'});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.deepEqual(body.entries.map(e=>[e.rank,e.score]),[[1,100],[2,80],[3,80],[4,80]]);
  assert.equal(body.entries[1].parts.idea,22);assert.equal(body.entries[2].parts.idea,22);assert.equal(body.entries[3].parts.idea,20);
  assert.ok(body.entries[1].at <= body.entries[2].at);
  assert.equal(body.storage.persistent,true);assert.equal(body.storage.dataDirConfigured,true);
  assert.deepEqual(body.network,{mode:'socket',headerSeen:false,yourIp:body.network.yourIp});
  assert.ok(body.entries.every(e=>!('device' in e) && /^[2-9A-HJKMNP-Z]{4}$/.test(e.code)));
});
test('admin is disabled without a strong ADMIN_PASSWORD; page is not indexable; cross-origin rejected',async()=>{
  for(const ADMIN_PASSWORD of [undefined,'','short']) {
    const off=await startApp({ADMIN_PASSWORD});
    const r=await off.admin({password:ADMIN_PASSWORD||''});
    assert.equal(r.status,503);
  }
  const r=await app.admin({password:'test-admin-password'},{origin:'https://attacker.example'});
  assert.equal(r.status,403);
  const page=await fetch(app.base+'/admin');
  assert.equal(page.status,200);assert.equal(page.headers.get('x-robots-tag'),'noindex');
});
test('admin login locks out after 10 wrong passwords',async()=>{
  const locked=await startApp({ADMIN_PASSWORD:'lockout-test-password'});
  for(let i=0;i<10;i++) assert.equal((await locked.admin({password:'nope-'+i})).status,401);
  assert.equal((await locked.admin({password:'lockout-test-password'})).status,429);
});
test('behind Railway each visitor gets their own limit (X-Real-IP); bad headers fall back; local servers ignore the header',async()=>{
  resetMock();
  const railway=await startApp({IP_LIMIT_PER_15MIN:'1',RAILWAY_ENVIRONMENT_NAME:'production'});
  const as=(target,ip,n)=>target.post({imageData,fortuneType:'love',consent:true,deviceId:device(n)},ip?{'x-real-ip':ip}:{});
  assert.equal((await as(railway,'203.0.113.5',50)).status,200);
  assert.equal((await as(railway,'203.0.113.5',51)).status,429); // same visitor: over the limit
  assert.equal((await as(railway,'198.51.100.7',52)).status,200); // another visitor is unaffected
  assert.equal((await as(railway,'not-an-ip',53)).status,200);    // junk header -> socket address
  assert.equal((await as(railway,'also-junk',54)).status,429);    // ...which is now used up
  const local=await startApp({IP_LIMIT_PER_15MIN:'1'});
  assert.equal((await as(local,'203.0.113.5',55)).status,200);
  assert.equal((await as(local,'198.51.100.7',56)).status,429);   // spoofed header ignored without Railway/TRUST_PROXY_HEADER
  const explicit=await startApp({IP_LIMIT_PER_15MIN:'1',TRUST_PROXY_HEADER:'x-real-ip'});
  assert.equal((await as(explicit,'203.0.113.5',57)).status,200);
  assert.equal((await as(explicit,'198.51.100.7',58)).status,200);
});
test('behind Railway the admin lockout is per visitor and the admin page can verify the setup',async()=>{
  const r=await startApp({ADMIN_PASSWORD:'railway-lockout-password',RAILWAY_PROJECT_ID:'project-id'});
  const tryLogin=(password,ip)=>r.admin({password},{'x-real-ip':ip});
  for(let i=0;i<10;i++) assert.equal((await tryLogin('wrong-'+i,'192.0.2.10')).status,401);
  assert.equal((await tryLogin('railway-lockout-password','192.0.2.10')).status,429);
  const ok=await tryLogin('railway-lockout-password','192.0.2.11');
  assert.equal(ok.status,200);
  assert.deepEqual((await ok.json()).network,{mode:'x-real-ip',headerSeen:true,yourIp:'192.0.2.11'});
  const noHeader=await r.admin({password:'railway-lockout-password'});
  assert.deepEqual((await noHeader.json()).network.headerSeen,false); // lets the operator spot a missing header
});
test('RAILWAY_VOLUME_MOUNT_PATH is used for the ranking file when DATA_DIR is not set',async()=>{
  const volume=await mkdtemp(path.join(tmpdir(),'fortune-volume-'));
  cleanups.push(()=>rm(volume,{recursive:true,force:true}));
  const onVolume=await startApp({ADMIN_PASSWORD:'volume-test-password',DATA_DIR:undefined,RAILWAY_VOLUME_MOUNT_PATH:volume});
  resetMock();
  assert.equal((await submit(onVolume,60)).status,200);
  const lines=(await readFile(path.join(volume,'entries.jsonl'),'utf8')).trim().split('\n');
  assert.equal(lines.length,1);
  const body=await (await onVolume.admin({password:'volume-test-password'})).json();
  assert.equal(body.storage.dataDirConfigured,true);
  assert.equal(body.network.mode,'socket'); // a Volume alone does not turn on header trust
});
test('ranking survives a server restart and the same device cannot be ranked again',async()=>{
  resetMock();claudeText=fortune();
  const first=await startApp({ADMIN_PASSWORD:'persist-test-password'});
  const before=await (await submit(first,20)).json();
  assert.equal(before.counted,true);
  const second=await startApp({ADMIN_PASSWORD:'persist-test-password',DATA_DIR:first.dir});
  const listed=await (await second.admin({password:'persist-test-password'})).json();
  assert.equal(listed.entries.length,1);
  assert.equal(listed.entries[0].code,before.entryCode);
  const again=await (await submit(second,20)).json();
  assert.equal(again.counted,false);assert.equal(again.entryCode,before.entryCode);
});
