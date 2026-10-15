'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const typeLabel = {love:'연애운',friend:'친구 궁합',luck:'오늘의 행운'};
  let password = ''; // kept in memory only: never in storage or the URL
  let entries = [];

  function setError(id, message='') {
    $(id).textContent = message;
    $(id).classList.toggle('hidden', !message);
  }
  function rowValues(e) {
    return [e.rank, e.code, e.score, e.parts.composition, e.parts.idea, e.parts.expression, e.parts.fun,
      typeLabel[e.type] || e.type, new Date(e.at).toLocaleString('ko-KR')];
  }
  function showLogin(message='') {
    password = '';
    $('rankingPanel').classList.add('hidden');
    $('loginPanel').classList.remove('hidden');
    setError('adminError', message);
  }
  function render(payload) {
    entries = payload.entries;
    $('totalCount').textContent = `${entries.length}명`;
    const body = $('rankingBody');
    body.replaceChildren();
    if(!entries.length) {
      const td = document.createElement('td');
      td.colSpan = 9; td.className = 'empty'; td.textContent = '아직 참가 기록이 없어요.';
      const tr = document.createElement('tr'); tr.append(td); body.append(tr);
    }
    for(const entry of entries) {
      const tr = document.createElement('tr');
      rowValues(entry).forEach((value, i) => {
        const td = document.createElement('td');
        td.textContent = value;
        if(i === 2) td.className = 'score';
        tr.append(td);
      });
      body.append(tr);
    }
    const {persistent, writeErrors, dataDirConfigured} = payload.storage;
    const warnings = [];
    if(!persistent) warnings.push('⚠ 저장소를 사용할 수 없어서 순위가 메모리에만 있어요. 서버가 재시작되면 모두 사라져요.');
    if(writeErrors > 0) warnings.push(`⚠ 저장 중 오류가 ${writeErrors}번 있었어요. 일부 기록이 파일에 남지 않았을 수 있어요.`);
    if(!dataDirConfigured) warnings.push('⚠ 저장 폴더가 따로 지정되지 않았어요. Railway에서는 Volume을 만들어 연결하지 않으면 재배포할 때 순위가 사라져요. (내 컴퓨터에서 테스트 중이라면 무시하세요.)');
    const {mode, headerSeen, yourIp} = payload.network;
    if(mode === 'x-real-ip' && !headerSeen) warnings.push('⚠ 접속자 IP 헤더(X-Real-IP)를 받지 못했어요. 이 상태에서는 참가자를 IP로 구분하지 못해서 요청 제한이 참가자 전체에 한꺼번에 적용될 수 있어요.');
    $('networkInfo').textContent = mode === 'x-real-ip' ?
      `접속자 구분: X-Real-IP 사용 중 · 지금 내 IP: ${yourIp} (휴대폰 데이터로 접속했을 때 내 실제 공인 IP처럼 보이면 정상이에요)` :
      `접속자 구분: 접속 주소 그대로 사용 · 지금 내 IP: ${yourIp}`;
    $('storageWarn').replaceChildren(...warnings.map(text => {
      const line = document.createElement('div'); line.textContent = text; return line;
    }));
    $('storageWarn').classList.toggle('hidden', !warnings.length);
  }
  async function load() {
    const response = await fetch('/api/admin/ranking', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password})
    });
    const payload = await response.json();
    if(!response.ok) throw new Error(payload.error || '순위를 불러오지 못했어요.');
    return payload;
  }
  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('adminError');
    password = $('passwordInput').value;
    try {
      render(await load());
      $('passwordInput').value = '';
      $('loginPanel').classList.add('hidden');
      $('rankingPanel').classList.remove('hidden');
      setError('rankingError');
    } catch(err) {
      password = '';
      setError('adminError', err.message || '순위를 불러오지 못했어요.');
    }
  });
  $('refreshBtn').addEventListener('click', async () => {
    setError('rankingError');
    try {render(await load());}
    catch(err) {showLogin(err.message);}
  });
  $('csvBtn').addEventListener('click', () => {
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const header = ['순위','확인코드','행운숫자','구도','아이디어','표현','재미','종류','제출시각'];
    const csv = '﻿' + [header, ...entries.map(rowValues)].map(row => row.map(quote).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    link.download = 'luckynumber-ranking.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
})();
