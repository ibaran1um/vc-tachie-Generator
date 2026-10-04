(function () {
  'use strict';
  const C = window.OverlayCSS;
  const $ = s => document.querySelector(s);

  /* ---------- 保存（IndexedDB） ---------- */
  const store = {
    db: null,
    open() {
      return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB が使えません'));
        const req = indexedDB.open('vc-tachie-overlay', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; resolve(); };
        req.onerror = () => reject(req.error);
      });
    },
    get(key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('kv', 'readonly');
        const r = tx.objectStore('kv').get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    },
    set(key, value) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  };

  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  let state = {
    guild: '', channel: '',
    currentProfile: null, profiles: {},
    users: [],
    options: Object.assign({}, C.DEFAULT_OPTIONS)
  };
  let storageOk = false;
  let saveTimer = null;

  function save() {
    if (!storageOk) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      store.set('state', JSON.parse(JSON.stringify(state))).catch(() => toast('保存できませんでした。容量を確認してください。'));
    }, 250);
  }

  /* ---------- 共通 ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  async function copyText(text, done) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) { toast('コピーできませんでした。手動で選択してコピーしてください。'); return; }
    }
    toast(done);
  }


  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  function pickFile(accept, multiple) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
      inp.onchange = () => resolve(Array.from(inp.files || []));
      inp.click();
    });
  }

  const fmtKB = n => n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
  const validId = id => /^\d{15,21}$/.test(String(id || '').trim());

  /* ---------- 対象・URL・プロファイル ---------- */
  function renderTarget() {
    $('#guild').value = state.guild;
    $('#channel').value = state.channel;
    renderUrl();
    const sel = $('#profile');
    sel.innerHTML = '';
    const names = Object.keys(state.profiles).sort((a, b) => a.localeCompare(b, 'ja'));
    const none = document.createElement('option');
    none.value = ''; none.textContent = names.length ? '（選択しない）' : '（まだありません）';
    sel.appendChild(none);
    for (const n of names) {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      sel.appendChild(o);
    }
    sel.value = state.currentProfile && state.profiles[state.currentProfile] ? state.currentProfile : '';
  }

  function renderUrl() {
    $('#url').value = C.buildUrl(state.guild, state.channel);
  }

  function selectProfile(name) {
    state.currentProfile = name || null;
    const p = name && state.profiles[name];
    if (p) { state.guild = p.guild_id; state.channel = p.channel_id; }
    renderTarget();
    save();
  }

  function needIds() {
    if (!state.guild.trim() || !state.channel.trim()) {
      toast('サーバー ID とボイスチャンネル ID を入力してください。');
      return true;
    }
    return false;
  }

  function saveProfileAs() {
    if (needIds()) return;
    const name = (prompt('プロファイル名', state.currentProfile || '新しいプロファイル') || '').trim();
    if (!name) return;
    if (state.profiles[name] && !confirm(`『${name}』は既に存在します。上書きしますか？`)) return;
    state.profiles[name] = { guild_id: state.guild.trim(), channel_id: state.channel.trim() };
    state.currentProfile = name;
    renderTarget(); save();
    toast(`『${name}』を保存しました。`);
  }

  function bindTarget() {
    $('#guild').addEventListener('input', e => { state.guild = e.target.value.trim(); renderUrl(); save(); });
    $('#channel').addEventListener('input', e => { state.channel = e.target.value.trim(); renderUrl(); save(); });
    $('#profile').addEventListener('change', e => selectProfile(e.target.value));
    $('#profSave').addEventListener('click', () => {
      if (!state.currentProfile) return saveProfileAs();
      if (needIds()) return;
      state.profiles[state.currentProfile] = { guild_id: state.guild.trim(), channel_id: state.channel.trim() };
      save(); toast(`『${state.currentProfile}』を上書き保存しました。`);
    });
    $('#profSaveAs').addEventListener('click', saveProfileAs);
    $('#profDel').addEventListener('click', () => {
      const n = state.currentProfile;
      if (!n) return toast('削除するプロファイルを選んでください。');
      if (!confirm(`プロファイル『${n}』を削除しますか？`)) return;
      delete state.profiles[n];
      state.currentProfile = null;
      renderTarget(); save();
      toast(`『${n}』を削除しました。`);
    });
    const copyUrl = () => { if (!needIds()) copyText(C.buildUrl(state.guild, state.channel), 'URL をコピーしました。'); };
    $('#urlCopy').addEventListener('click', copyUrl);
    $('#urlCopy2').addEventListener('click', copyUrl);
    $('#urlOpen').addEventListener('click', () => { if (!needIds()) window.open(C.buildUrl(state.guild, state.channel), '_blank', 'noopener'); });
  }

  /* ---------- キャラクター ---------- */
  function addUser(data) {
    const u = Object.assign({ key: newId(), id: '', name: '', stand: '', mouth: '', enabled: true }, data || {});
    state.users.push(u);
    return u;
  }

  function imageSlot(u, field, label) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const box = document.createElement('div');
    box.className = 'thumb';
    if (u[field]) {
      const img = document.createElement('img');
      img.src = u[field]; img.alt = `${u.name || 'キャラクター'}の${label}`;
      img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), { textContent: '読み込めません' })); };
      box.appendChild(img);
    } else {
      box.appendChild(Object.assign(document.createElement('span'), { textContent: '画像なし' }));
    }
    box.appendChild(Object.assign(document.createElement('span'), { className: 'cap', textContent: label }));
    const acts = document.createElement('div');
    acts.className = 'acts';
    const bFile = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: '選ぶ' });
    bFile.title = `${label}をファイルから選ぶ`;
    bFile.onclick = async () => {
      const [f] = await pickFile('image/png,image/jpeg,image/webp,image/gif');
      if (!f) return;
      u[field] = await readFileAsDataUrl(f);
      if (!u.name) u.name = f.name.replace(/\.[^.]+$/, '');
      changed(true);
    };
    const bUrl = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: 'URL' });
    bUrl.title = `${label}を URL で指定する`;
    bUrl.onclick = () => {
      const cur = u[field] && !u[field].startsWith('data:') ? u[field] : '';
      const v = prompt('画像の URL（https://…）', cur);
      if (v === null) return;
      u[field] = v.trim();
      changed(true);
    };
    acts.append(bFile, bUrl);
    if (u[field]) {
      const bDel = Object.assign(document.createElement('button'), { type: 'button', className: 'small danger', textContent: '×' });
      bDel.title = `${label}を外す`;
      bDel.setAttribute('aria-label', `${label}を外す`);
      bDel.onclick = () => { u[field] = ''; changed(true); };
      acts.append(bDel);
    }
    slot.append(box, acts);
    return slot;
  }

  function renderUsers() {
    const wrap = $('#users');
    wrap.innerHTML = '';
    if (!state.users.length) {
      wrap.innerHTML = '<p class="empty">まだいません。「追加」から立ち絵の画像を選んで登録してください。</p>';
    }
    for (const u of state.users) {
      const card = document.createElement('div');
      card.className = 'ucard' + (u.enabled ? '' : ' off');

      const top = document.createElement('div');
      top.className = 'top';
      const lab = document.createElement('label');
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!u.enabled });
      cb.onchange = () => { u.enabled = cb.checked; card.classList.toggle('off', !cb.checked); changed(false); };
      lab.append(cb, document.createTextNode('使う'));
      const del = Object.assign(document.createElement('button'), { type: 'button', className: 'small danger', textContent: '削除' });
      del.style.marginLeft = 'auto';
      del.onclick = () => {
        if (!confirm(`『${u.name || u.id || 'このキャラクター'}』を削除しますか？`)) return;
        state.users = state.users.filter(x => x !== u);
        changed(true);
      };
      top.append(lab, del);

      const nameL = document.createElement('label'); nameL.className = 'field'; nameL.textContent = '表示名';
      const nameI = Object.assign(document.createElement('input'), { type: 'text', value: u.name || '' });
      nameI.oninput = () => { u.name = nameI.value; changed(false); };
      nameL.appendChild(nameI);

      const idL = document.createElement('label'); idL.className = 'field'; idL.textContent = 'Discord ユーザー ID';
      const idI = Object.assign(document.createElement('input'), { type: 'text', value: u.id || '', inputMode: 'numeric', autocomplete: 'off' });
      const idMsg = Object.assign(document.createElement('span'), { className: 'idbad' });
      const checkId = () => { idMsg.textContent = u.id && !validId(u.id) ? '数字 15〜21 桁の ID を入れてください' : (!u.id ? 'ID が未入力です' : ''); };
      idI.oninput = () => { u.id = idI.value.trim(); checkId(); changed(false); };
      checkId();
      idL.append(idI, idMsg);

      const thumbs = document.createElement('div');
      thumbs.className = 'thumbs';
      thumbs.append(imageSlot(u, 'stand', '待機'), imageSlot(u, 'mouth', '発言中'));

      card.append(top, nameL, idL, thumbs);
      if (isFree()) card.appendChild(positionFields(u));
      wrap.appendChild(card);
    }
    const bytes = state.users.reduce((s, u) => s + (u.stand || '').length + (u.mouth || '').length, 0);
    $('#sizeStat').textContent = state.users.length ? `登録 ${state.users.length} 人／画像データ合計 ${fmtKB(bytes)}` : '';
  }

  const isFree = () => state.options.mode === 'enhanced' && state.options.direction === 'free';

  /* 自由配置：まだ位置がない人に、今の並び（下に均等）の位置を書き込む */
  function fillPositions() {
    if (!isFree()) return;
    const pos = C.freeLayout(state.users, state.options);
    for (const u of state.users) {
      const p = pos[String(u.id || '').trim()];
      if (!p) continue;
      if (u.x === undefined || u.x === '') u.x = p.x;
      if (u.y === undefined || u.y === '') u.y = p.y;
      if (u.scale === undefined || u.scale === '') u.scale = p.scale;
      if (u.z === undefined || u.z === '') u.z = p.z;
    }
  }

  function positionFields(u) {
    const box = document.createElement('div');
    box.className = 'pos';
    const pos = C.freeLayout(state.users, state.options)[String(u.id || '').trim()];
    const defs = [
      ['x', '横 X', 'px', 1, '立ち絵の左端の位置（配信画面の左から）'],
      ['y', '足元 Y', 'px', 1, '立ち絵の足元の位置（配信画面の上から）'],
      ['scale', '大きさ', '%', 5, 'この人だけの大きさ'],
      ['z', '重なり順', '', 1, '重なったとき、数字が大きいほど手前']
    ];
    for (const [k, label, unit, step, tip] of defs) {
      const l = document.createElement('label'); l.className = 'field';
      l.title = tip;
      l.textContent = label + (unit ? `（${unit}）` : '');
      const inp = Object.assign(document.createElement('input'), { type: 'number', step: String(step) });
      inp.dataset.pos = k;
      inp.value = u[k] !== undefined && u[k] !== '' ? u[k] : (pos ? pos[k] : '');
      if (!pos) { inp.disabled = true; inp.title = 'ID と待機画像を入れて「使う」にチェックすると設定できます'; }
      inp.oninput = () => { u[k] = inp.value === '' ? '' : Number(inp.value); changed(false); };
      l.appendChild(inp);
      box.appendChild(l);
    }
    return box;
  }

  function bindUsers() {
    $('#userAdd').addEventListener('click', async () => {
      const files = await pickFile('image/png,image/jpeg,image/webp,image/gif', false);
      const u = addUser();
      if (files[0]) { u.stand = await readFileAsDataUrl(files[0]); u.name = files[0].name.replace(/\.[^.]+$/, ''); }
      changed(true);
      const cards = document.querySelectorAll('.ucard');
      const last = cards[cards.length - 1];
      if (last) { last.scrollIntoView({ block: 'nearest', inline: 'end' }); last.querySelectorAll('input[type="text"]')[1].focus(); }
    });
    $('#userClear').addEventListener('click', () => {
      if (!state.users.length) return;
      if (!confirm('すべてのキャラクターを削除しますか？')) return;
      state.users = [];
      changed(true);
    });
  }

  /* ---------- 表示設定 ---------- */
  const UNIT = { gap: 'px', padding: 'px', maxWidth: 'px', maxHeight: 'px', idleBrightness: '%', idleOpacity: '%', idleScale: '%', speakScale: '%', borderWidth: 'px', glowSize: 'px', jumpHeight: 'px', speedMs: 'ms', motionStrength: '', nameSize: 'px', nameBgOpacity: '%', nameRadius: 'px', markSize: 'px' };

  function renderOptions() {
    const o = state.options;
    document.querySelectorAll('input[name="mode"]').forEach(r => { r.checked = r.value === o.mode; });
    document.querySelectorAll('input[name="direction"]').forEach(r => { r.checked = r.value === o.direction; });
    document.querySelectorAll('[data-opt]').forEach(el => {
      const k = el.dataset.opt;
      if (el.type === 'checkbox') el.checked = !!o[k];
      else el.value = o[k];
    });
    document.querySelectorAll('[data-out]').forEach(el => {
      const k = el.dataset.out;
      el.textContent = (k === 'maxHeight' && Number(o[k]) === 0) ? '制限なし' : o[k] + (UNIT[k] || '');
    });
    $('#enh').disabled = o.mode !== 'enhanced';
    $('#freeOpts').hidden = o.direction !== 'free';
    $('#modeNote').textContent = o.mode === 'compat'
      ? '互換：以前の版と同じシンプルな CSS を出します。発言中画像には対応していますが、下の細かい設定（動き・名前など）を使うには「改良版」に切り替えてください。'
      : '改良版：動きや名前の見た目などを細かく調整できます（「登録していない人を隠す」「話している人だけ表示」「自由配置」は OBS 31 以降が必要な場合があります）。';
  }

  function bindOptions() {
    document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', () => { state.options.mode = r.value; changed(false); }));
    document.querySelectorAll('input[name="direction"]').forEach(r => r.addEventListener('change', () => {
      const wasFree = isFree();
      state.options.direction = r.value;
      if (isFree() && !wasFree) $('#zoom').value = 'fit';
      changed(true);
    }));
    const sel = $('#nameFont');
    sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '標準（StreamKit のまま）' }));
    for (const f of Object.keys(C.FONTS)) sel.appendChild(Object.assign(document.createElement('option'), { value: f, textContent: f }));
    document.querySelectorAll('[data-opt]').forEach(el => {
      const ev = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        const k = el.dataset.opt;
        state.options[k] = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.type === 'number' ? Number(el.value) : el.value);
        changed(false);
      });
    });
  }

  /* ---------- CSS とプレビュー ---------- */
  const PREVIEW_BASE = `
#root { font-family: "Zen Kaku Gothic New", "Hiragino Sans", sans-serif; }
[class*="Voice_voiceStates__"] { list-style: none; margin: 0; padding: 0; }
[class*="Voice_voiceState__"] { height: 50px; margin-bottom: 8px; cursor: pointer; }
[class*="Voice_avatar__"] { height: 40px; width: 40px; border: 3px solid transparent; border-radius: 50%; float: left; margin-right: 8px; }
[class*="Voice_avatarSpeaking__"] { border-color: #ffffff; }
[class*="Voice_user__"] { padding-top: 16px; }
[class*="Voice_name__"] { font-weight: 500; padding: 4px 6px; border-radius: 3px; }
.empty-msg { color: #fff; background: rgba(0,0,0,.55); padding: 6px 10px; border-radius: 6px; font-size: 13px; margin: 12px; display: inline-block; }
`;
  // 実際の StreamKit（2026 年 10 月確認）と同じクラス名・構造
  const CLS = { container: 'Voice_voiceContainer__adk9M voice_container', states: 'Voice_voiceStates__a121W voice_states', state: 'Voice_voiceState__OCoZh voice_state', avatar: 'Voice_avatar__htiqH voice_avatar', speaking: 'Voice_avatarSpeaking__k3m9q', user: 'Voice_user__8fGwX voice_username', name: 'Voice_name__TALd9' };
  const COLORS = ['#0e7c7b', '#c2571a', '#6b4fa3', '#2f6fb0', '#a8324a', '#5b7d2a'];
  let previewPeople = [];
  let lastCSS = '';
  let manualSpeaking = new Set();
  let speakIndex = 0;
  let shadow = null;

  function fakeAvatar(id, name, i) {
    const ch = (name || '?').trim().charAt(0) || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><!--avatars/${id}/preview--><rect width="64" height="64" fill="${COLORS[i % COLORS.length]}"/><text x="32" y="43" font-size="30" text-anchor="middle" fill="#fff" font-family="sans-serif">${ch.replace(/[<&>"]/g, '')}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/%2F/g, '/');
  }

  function buildPreviewPeople() {
    const list = state.users.filter(u => String(u.id || '').trim()).map(u => ({ id: String(u.id).trim(), name: u.name || 'ユーザー' }));
    list.push({ id: '100000000000000099', name: '登録していない人' });
    previewPeople = list.map((p, i) => Object.assign(p, { src: fakeAvatar(p.id, p.name, i) }));
  }

  const PREVIEW_FREE = `
[class*="Voice_voiceStates__"] { outline: 2px dashed rgba(255,255,255,.75); outline-offset: -1px; box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
img { -webkit-user-drag: none; user-select: none; }
li.draggable { cursor: grab; touch-action: none; }
li.dragging { cursor: grabbing; }
li.dragging::after { content: attr(data-pos); position: absolute; left: 0; bottom: 100%; z-index: 9999; font: 600 22px/1.3 sans-serif; color: #fff; background: rgba(0,0,0,.7); padding: 2px 8px; border-radius: 6px; white-space: nowrap; }
`;
  let suppressClick = false;

  function startDrag(e, li, u) {
    if (e.button !== 0) return;
    e.preventDefault();
    const pos = C.freeLayout(state.users, state.options)[String(u.id).trim()];
    const { w, h } = C.canvasSize(state.options);
    const z = currentZoom || 1;
    const sx = e.clientX, sy = e.clientY;
    let moved = false, nx = pos.x, ny = pos.y;
    li.setPointerCapture(e.pointerId);
    const move = ev => {
      const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      if (!moved) { moved = true; li.classList.add('dragging'); }
      // Shift を押しながらだと 10px 単位
      const snap = v => (ev.shiftKey ? Math.round(v / 10) * 10 : Math.round(v));
      nx = Math.min(w, Math.max(-2000, snap(pos.x + dx)));
      ny = Math.min(h + 2000, Math.max(0, snap(pos.y + dy)));
      li.style.left = nx + 'px';
      li.style.bottom = (h - ny) + 'px';
      li.dataset.pos = `x ${nx} / y ${ny}`;
    };
    const up = () => {
      li.removeEventListener('pointermove', move);
      li.removeEventListener('pointerup', up);
      li.removeEventListener('pointercancel', up);
      if (!moved) return;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      u.x = nx; u.y = ny;
      changed(true);
    };
    li.addEventListener('pointermove', move);
    li.addEventListener('pointerup', up);
    li.addEventListener('pointercancel', up);
  }

  function renderCSSAndPreview() {
    const css = C.generateCSS(state.users, state.options);
    lastCSS = css;
    const active = state.users.filter(u => u.enabled && String(u.id || '').trim() && u.stand).length;
    $('#cssStat').textContent = `${fmtKB(new Blob([css]).size)}・対象 ${active} 人` + (active === 0 ? '（チェックが入っていて、ID と待機画像がある人だけが対象です）' : '');

    buildPreviewPeople();
    if (!shadow) shadow = $('#stageHost').attachShadow({ mode: 'open' });
    const visibleNone = active === 0 && !(state.options.mode === 'enhanced' && state.options.showOthers);
    const items = previewPeople.map((p, i) => `
      <li class="${CLS.state}" data-userid="${p.id}" data-i="${i}">
        <img class="${CLS.avatar}" src="${p.src}" alt="">
        <div class="${CLS.user}"><span class="${CLS.name}" style="color: rgb(255, 255, 255); font-size: 14px; background-color: rgba(30, 33, 36, 0.95);">${p.name.replace(/[<&>"]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]))}</span></div>
      </li>`).join('');
    // プレビューは Shadow DOM の中なので :root の代わりに :host で変数を定義する
    const previewCss = css.replace(/^:root \{/m, ':host {');
    shadow.innerHTML = `<style>${PREVIEW_BASE}</style><style>${previewCss}</style>${isFree() ? `<style>${PREVIEW_FREE}</style>` : ''}
      <div id="root"><div class="${CLS.container}"><ul class="${CLS.states}">${items}</ul></div></div>
      ${visibleNone ? '<div class="empty-msg">表示される人がいません。キャラクターを登録してチェックを入れてください。</div>' : ''}`;
    const activeIds = new Set(state.users.filter(u => u.enabled && String(u.id || '').trim() && u.stand).map(u => String(u.id).trim()));
    shadow.querySelectorAll('li').forEach(li => {
      if (!isFree() || !activeIds.has(li.dataset.userid)) return;
      const u = state.users.find(x => x.enabled && String(x.id || '').trim() === li.dataset.userid && x.stand);
      li.classList.add('draggable');
      li.addEventListener('pointerdown', e => startDrag(e, li, u));
    });
    shadow.querySelectorAll('li').forEach(li => li.addEventListener('click', () => {
      if (suppressClick) return;
      if ($('#autoSpeak').checked) {
        // 自動から手動に切り替えるときは、今の状態を引き継ぐ
        manualSpeaking = new Set(Array.from(shadow.querySelectorAll('li')).filter(x => x.querySelector('img').classList.contains(CLS.speaking)).map(x => x.dataset.userid));
        $('#autoSpeak').checked = false;
      }
      const id = li.dataset.userid;
      if (manualSpeaking.has(id)) manualSpeaking.delete(id); else manualSpeaking.add(id);
      applySpeaking();
    }));
    applySpeaking();
    loadPreviewFont();
    applyZoom();
  }

  // Shadow DOM 内の @import のフォントは使われないので、ページ側にも読み込む
  function loadPreviewFont() {
    const f = state.options.mode === 'enhanced' && state.options.showName ? state.options.nameFont : '';
    let link = document.getElementById('previewFont');
    if (!f || !C.FONTS[f]) { if (link) link.remove(); return; }
    const href = `https://fonts.googleapis.com/css2?family=${C.FONTS[f]}&display=swap`;
    if (!link) { link = Object.assign(document.createElement('link'), { id: 'previewFont', rel: 'stylesheet' }); document.head.appendChild(link); }
    if (link.href !== href) link.href = href;
  }

  function applyStageBg() {
    const v = $('#stageBg').value;
    const stage = $('#stage');
    $('#stageColor').hidden = v !== 'custom';
    if (v === 'checker') { stage.style.background = ''; return; }
    stage.style.background = v === 'custom' ? $('#stageColor').value : v;
  }
  $('#stageBg').addEventListener('change', applyStageBg);
  $('#stageColor').addEventListener('input', applyStageBg);

  function applySpeaking() {
    if (!shadow) return;
    const lis = shadow.querySelectorAll('li');
    const auto = $('#autoSpeak').checked;
    lis.forEach((li, i) => {
      const on = auto ? i === speakIndex % Math.max(1, lis.length) : manualSpeaking.has(li.dataset.userid);
      li.querySelector('img').classList.toggle(CLS.speaking, on);
    });
  }
  $('#autoSpeak').addEventListener('change', applySpeaking);

  let currentZoom = 0.5;
  function applyZoom() {
    let z = $('#zoom').value;
    if (z === 'fit') {
      // 自由配置なら配信画面の幅が枠に収まる倍率、それ以外は 50%
      const avail = $('#stage').clientWidth - 2;
      z = isFree() ? Math.min(1, avail / C.canvasSize(state.options).w) : 0.5;
    }
    currentZoom = Number(z) || 1;
    $('#stageHost').style.zoom = currentZoom;
  }
  $('#zoom').addEventListener('change', applyZoom);
  window.addEventListener('resize', applyZoom);

  setInterval(() => { if ($('#autoSpeak').checked) { speakIndex++; applySpeaking(); } }, 1600);

  function changed(rerenderUsers) {
    fillPositions();
    if (rerenderUsers) renderUsers();
    renderOptions();
    renderCSSAndPreview();
    save();
  }

  /* ---------- コピー ---------- */
  function bindCopy() {
    $('#cssCopy').addEventListener('click', () => copyText(lastCSS, 'CSS をコピーしました。'));
  }

  /* ---------- 起動 ---------- */
  async function init() {
    bindTarget(); bindUsers(); bindOptions(); bindCopy();
    try {
      await store.open();
      storageOk = true;
      const saved = await store.get('state');
      if (saved && typeof saved === 'object') {
        state = Object.assign(state, saved);
        state.options = Object.assign({}, C.DEFAULT_OPTIONS, saved.options || {});
        state.users = (saved.users || []).map(u => Object.assign({ key: newId(), mouth: '' }, u));
      }
    } catch (e) {
      toast('このブラウザでは保存できません。閉じると設定は消えます。');
    }
    renderTarget();
    changed(true);
  }
  init();
})();
