import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { createHash, randomInt } from 'node:crypto';
import path from 'node:path';

const KEYS = ['composition','idea','expression','fun'];
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L: easy to read out loud at the prize desk
const SCORE_LABEL = /^[\s*#>-]*창의성\s*\**\s*[:：]/;
const SCORE_LINE = /창의성\s*\**\s*[:：]\s*\**\s*구도\s*=\s*(\d{1,2})\s*,\s*아이디어\s*=\s*(\d{1,2})\s*,\s*표현\s*=\s*(\d{1,2})\s*,\s*재미\s*=\s*(\d{1,2})/;

// Splits Claude's text into the fortune body and the 4 creativity sub-scores (0-25 each).
// parts is null when the score line is missing or malformed: the caller must not rank that request.
export function extractScore(text) {
  const lines = String(text).split(/\r?\n/);
  const body = lines.filter(line => !SCORE_LABEL.test(line)).join('\n').trim();
  const match = lines.map(line => SCORE_LINE.exec(line)).find(Boolean);
  if(!match) return {body, parts:null};
  const values = match.slice(1).map(Number);
  if(values.some(n => n > 25)) return {body, parts:null};
  return {body, parts:Object.fromEntries(KEYS.map((key,i) => [key, values[i]]))};
}
export const totalScore = parts => KEYS.reduce((sum,key) => sum + parts[key], 0);

// Ties are broken by idea > expression > composition > fun, then by who submitted first.
const byRank = (a,b) => b.score-a.score || b.parts.idea-a.parts.idea || b.parts.expression-a.parts.expression ||
  b.parts.composition-a.parts.composition || b.parts.fun-a.parts.fun || a.at-b.at;
export const rankEntries = entries => [...entries].sort(byRank)
  .map((entry,i) => ({rank:i+1, code:entry.code, score:entry.score, parts:entry.parts, type:entry.type, at:entry.at}));

// Append-only JSON-lines file; photos and names are never stored, only the score, a short code and a hashed device id.
export function createRankingStore({dir, log=console.log}={}) {
  const entries = [], byDevice = new Map(), codes = new Set(), pending = new Set();
  const file = dir ? path.join(dir,'entries.jsonl') : null;
  let persistent = false, writeErrors = 0, queue = Promise.resolve();

  function remember(entry) {
    if(!entry || typeof entry.device!=='string' || typeof entry.code!=='string' || !Number.isInteger(entry.score) ||
       !entry.parts || !Number.isFinite(entry.at)) throw new Error('invalid entry');
    entries.push(entry); byDevice.set(entry.device,entry); codes.add(entry.code);
  }
  if(file) {
    try {
      mkdirSync(dir,{recursive:true});
      writeFileSync(file,'',{flag:'a'});
      for(const line of readFileSync(file,'utf8').split('\n')) {
        if(!line.trim()) continue;
        try {remember(JSON.parse(line));} catch {log('ranking: skipped an unreadable line');}
      }
      persistent = true;
    } catch(e) {log('ranking: storage unavailable, keeping entries in memory only',e.code||e.name);}
  }
  const newCode = () => {
    for(;;) {
      const code = Array.from({length:4},() => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
      if(!codes.has(code)) return code;
    }
  };
  return {
    hashDevice: id => createHash('sha256').update(id).digest('hex'),
    get: device => byDevice.get(device),
    // One scored entry per device: reserve() also blocks a second request that arrives while the first is still waiting on Claude.
    reserve(device) {
      if(byDevice.has(device) || pending.has(device)) return false;
      pending.add(device); return true;
    },
    release: device => {pending.delete(device);},
    async add({device, parts, type}) {
      const entry = {code:newCode(), device, score:totalScore(parts), parts, type, at:Date.now()};
      remember(entry); pending.delete(device);
      if(persistent) {
        queue = queue.then(() => appendFile(file, JSON.stringify(entry)+'\n'))
          .catch(e => {writeErrors++; log('ranking: write failed',e.code||e.name);});
        await queue;
      }
      return entry;
    },
    list: () => rankEntries(entries),
    status: () => ({persistent, writeErrors, total:entries.length})
  };
}
