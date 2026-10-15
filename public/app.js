'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const title = {love:'💗 연애운',friend:'🫶 친구 궁합',luck:'🍀 오늘의 행운'};
  let selectedFile = null;
  let selectedType = 'love';
  let previewUrl = null;
  let resultText = '';
  let fortune = null;
  let luckyNumber = null;
  let loading = false;
  let memoryDeviceId = null;

  // Anonymous id so the server can count one ranked score per device (kept in localStorage; falls back to memory if blocked).
  function newDeviceId() {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
  }
  function getDeviceId() {
    try {
      let id = localStorage.getItem('fortuneDeviceId');
      if(!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
        id = newDeviceId();
        localStorage.setItem('fortuneDeviceId', id);
      }
      return id;
    } catch {
      return memoryDeviceId || (memoryDeviceId = newDeviceId());
    }
  }
  function showLucky(payload) {
    luckyNumber = Number.isInteger(payload.luckyNumber) ? payload.luckyNumber : null;
    const hasScore = luckyNumber !== null;
    $('luckyScore').classList.toggle('hidden', !hasScore);
    if(hasScore) {
      $('luckyNumber').textContent = luckyNumber;
      $('luckyCode').textContent = `확인 코드 ${payload.entryCode}`;
    }
    $('luckyNote').textContent = !hasScore ? '이번에는 행운숫자를 매기지 못했어요. 다시 뽑기를 눌러 주세요. 참가 기회는 그대로예요.' :
      payload.counted ? '이 점수가 이벤트 순위에 기록됐어요. 수상 확인에 필요하니 확인 코드를 기억해 주세요.' :
      '이미 참가하셨어요. 행운숫자는 처음 제출한 기록 그대로예요.';
    $('luckyBlock').classList.remove('hidden');
  }

  const FIELD = {'제목':'title','운세':'body'};
  const FIELD_LINE = /^(제목|운세)\s*[:：]\s*(.*)$/;
  const OMITTED_FIELD_LINE = /^(행운의 아이템|행운 포인트|오늘의 미션)\s*[:：]/;
  // Claude answers in labelled lines; only "운세" may continue over the following unlabelled lines.
  // Returns null when nothing usable was found, so the caller can fall back to the raw text.
  function parseFortune(text) {
    const parsed = {title:'', body:[]};
    let field = null;
    for(const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if(!line) continue;
      if(OMITTED_FIELD_LINE.test(line)) {field='omitted'; continue;}
      const match = FIELD_LINE.exec(line);
      if(match) field = FIELD[match[1]];
      else if(field !== 'body') continue; // stray lines after one-line fields are dropped
      const value = match ? match[2] : line;
      if(!value) continue;
      if(field === 'body') parsed.body.push(value);
      else parsed[field] = value;
    }
    return parsed.title || parsed.body.length ? parsed : null;
  }
  function withoutRemovedFields(text) {
    return String(text).split(/\r?\n/).filter(line => !OMITTED_FIELD_LINE.test(line.trim())).join('\n');
  }
  function renderFortune(parsed, rawText) {
    const box = $('fortuneText');
    box.replaceChildren();
    if(!parsed) {box.textContent = withoutRemovedFields(rawText); return;}
    const add = (tag, className, text) => {
      const el = document.createElement(tag);
      el.className = className; el.textContent = text; box.append(el);
    };
    if(parsed.title) add('div','fortune-title',parsed.title);
    parsed.body.forEach(line => add('p','fortune-line',line));
  }
  async function renderPublicRanking() {
    const list = $('publicRanking');
    list.replaceChildren();
    try {
      const response = await fetch('/api/ranking');
      const payload = await response.json();
      if(!response.ok) throw new Error('순위를 불러오지 못했어요.');
      if(!payload.entries.length) {
        const item = document.createElement('li');
        item.textContent = '아직 순위 기록이 없어요.';
        list.append(item);
        return;
      }
      for(const entry of payload.entries) {
        const item = document.createElement('li');
        const rank = document.createElement('span');
        rank.textContent = `${entry.rank}위`;
        const score = document.createElement('span');
        score.className = 'rank-score';
        score.textContent = `${entry.score}점`;
        item.append(rank,score);
        list.append(item);
      }
    } catch {
      const item = document.createElement('li');
      item.textContent = '순위를 불러오지 못했어요.';
      list.append(item);
    }
  }
  // Plain-text version for sharing/copying; the confirmation code is deliberately left out.
  function buildShareText() {
    const lines = ['🔮 배명고 AI연구반 · AI 운세 영수증', ''];
    if(fortune) {
      if(fortune.title) lines.push(fortune.title, '');
      lines.push(...fortune.body);
    } else lines.push(title[selectedType], '', withoutRemovedFields(resultText));
    lines.push('');
    if(luckyNumber !== null) lines.push(`⭐ 오늘의 행운숫자: ${luckyNumber}점`);
    lines.push('', '※ 재미용 운세입니다.');
    return lines.join('\n');
  }

  function showError(message='') {
    $('errorMessage').textContent=message;
    $('errorMessage').classList.toggle('hidden',!message);
  }
  function syncButton() {
    $('generateBtn').disabled = !selectedFile || !$('consentCheckbox').checked || loading;
    $('generateBtn').innerHTML = loading ? '✨ 운세를 뽑는 중이에요...' :
      !selectedFile ? '✦ 사진을 먼저 올려 주세요' :
      !$('consentCheckbox').checked ? '✦ 사진 처리 동의를 체크해 주세요' :
      '✦ 내 럭키 모먼트 뽑기';
  }
  function updateFile(file) {
    if(!file) return;
    showError('');
    if(!file.type.startsWith('image/')) return showError('이미지 파일을 선택해 주세요.');
    if(file.size > 10*1024*1024) return showError('사진 파일은 10MB 이하로 선택해 주세요.');
    selectedFile=file;
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl=URL.createObjectURL(file);
    $('photoPreview').src=previewUrl;
    $('previewArea').classList.remove('hidden');
    $('uploadTarget').classList.add('hidden');
    $('photoName').textContent=file.name || '선택한 사진';
    $('resultSection').classList.add('hidden');
    syncButton();
  }
  $('cameraInput').addEventListener('change', e => updateFile(e.target.files?.[0]));
  $('galleryInput').addEventListener('change', e => updateFile(e.target.files?.[0]));
  $('resetPhoto').addEventListener('click', () => {
    selectedFile=null;
    $('cameraInput').value='';$('galleryInput').value='';
    if(previewUrl) URL.revokeObjectURL(previewUrl);previewUrl=null;
    $('photoPreview').removeAttribute('src');
    $('previewArea').classList.add('hidden');
    $('uploadTarget').classList.remove('hidden');
    $('resultSection').classList.add('hidden');
    syncButton();
  });
  document.querySelectorAll('.fortune-option').forEach(btn=>btn.addEventListener('click',()=>{
    selectedType=btn.dataset.type;
    document.querySelectorAll('.fortune-option').forEach(item=>{
      const active=item===btn;
      item.classList.toggle('active',active);
      item.setAttribute('aria-pressed',String(active));
    });
    $('resultSection').classList.add('hidden');
    showError('');
  }));
  $('consentCheckbox').addEventListener('change',syncButton);

  async function imageToJpegDataUrl(file) {
    let url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve,reject)=>{
        img.onload=resolve; img.onerror=reject; img.src=url;
      });
      const w=img.naturalWidth,h=img.naturalHeight;
      if(!w || !h || w*h>40_000_000) throw new Error('너무 큰 사진입니다. 크기를 줄여 다시 올려 주세요.');
      const scale=Math.min(1,1000/Math.max(w,h));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(w*scale));
      canvas.height=Math.max(1,Math.round(h*scale));
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const dataUrl=canvas.toDataURL('image/jpeg',0.72);
      if(dataUrl.length>2_700_000) throw new Error('사진을 압축할 수 없어요. 다른 사진을 올려 주세요.');
      return dataUrl;
    } finally {URL.revokeObjectURL(url);}
  }
  async function generateFortune() {
    if(!selectedFile || !$('consentCheckbox').checked || loading) return;
    loading=true;syncButton();showError('');
    $('resultSection').classList.add('hidden');
    try {
      const imageData=await imageToJpegDataUrl(selectedFile);
      const response=await fetch('/api/fortune',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({imageData,fortuneType:selectedType,consent:true,deviceId:getDeviceId()})
      });
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error || 'AI 운세를 생성하지 못했어요.');
      resultText=payload.result;
      showLucky(payload);
      await renderPublicRanking();
      $('resultType').textContent=title[selectedType];
      fortune=parseFortune(resultText);
      renderFortune(fortune,resultText);
      $('resultSection').classList.remove('hidden');
      $('resultSection').scrollIntoView({behavior:'smooth',block:'start'});
    } catch(err) {
      showError(err.message || '사진을 처리하지 못했어요. 다시 시도해 주세요.');
    } finally {loading=false;syncButton();}
  }
  $('generateBtn').addEventListener('click',generateFortune);
  $('againBtn').addEventListener('click',generateFortune);
  $('shareBtn').addEventListener('click',async()=>{
    if(!resultText) return;
    const text=buildShareText();
    if(navigator.share) {
      try {await navigator.share({title:'AI 운세 영수증',text});return;} catch(e){if(e.name==='AbortError')return;}
    }
    try {await navigator.clipboard.writeText(text);alert('운세 결과를 복사했어요!');}
    catch {window.prompt('운세 결과를 복사해 주세요.',text);}
  });
  syncButton();
})();
