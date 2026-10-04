/* URL と CSS の生成 */
(function () {
  'use strict';

  const OUTLINE_OFFSETS = [[2, 2], [-2, -2], [-2, 2], [2, -2]];

  const DEFAULT_OPTIONS = {
    mode: 'enhanced',    // 'compat' = 元の exe と同じ CSS / 'enhanced' = 改良版
    border: false,       // 縁取り
    blink: false,        // 点滅
    jump: false,         // 上下運動
    // ここから改良版のみ
    direction: 'row',    // 'row' 横並び / 'column' 縦並び / 'free' 自由配置
    canvasW: 1920,       // 自由配置：OBS のブラウザソースの幅
    canvasH: 1080,       // 自由配置：OBS のブラウザソースの高さ
    othersPlace: 'bl',   // 自由配置：登録していない人をまとめる場所 tl / tr / bl / br
    speakFront: true,    // 自由配置：話している人を手前に出す
    gap: 0,
    padding: 16,
    maxWidth: 400,
    maxHeight: 0,        // 0 = 制限なし
    borderColor: '#FFFFFF',
    borderWidth: 2,
    glowColor: '#FFFFFF',
    glowSize: 8,
    jumpHeight: 10,
    motion: 'none',      // 話している間の追加の動き none / sway / pulse / shake / squash / nod
    motionStrength: 5,
    speedMs: 750,
    speakScale: 100,     // 話している間の大きさ（%）
    idleBrightness: 70,
    idleGray: false,
    idleOpacity: 100,
    idleScale: 100,
    speakingOnly: false, // 話している人だけ表示
    enter: 'none',       // 参加したときの登場 none / fade / up / pop
    showOthers: false,
    showName: false,
    namePos: 'below',    // below / above / overlay
    nameFont: '',
    nameSize: 14,
    nameColor: '#FFFFFF',
    nameBold: false,
    nameBg: '#1E2124',
    nameBgOpacity: 95,
    nameRadius: 3,
    nameOutline: false,
    nameOutlineColor: '#000000',
    // 配信映えの演出（改良版のみ）
    footShadow: false,   // 足元の影
    footShadowColor: '#000000',
    rainbow: false,      // 縁取りを虹色に流す
    mark: 'none',        // 話している人のマーク none / talk / note / notes / bang / star / heart / custom
    markText: '',
    markSize: 32,
    markColor: '#FFFFFF',
    aura: 'none',        // 話している人の後ろ none / spot / halo / ripple
    auraColor: '#FFE38A',
    idleMotion: 'none',  // 話していない人の動き none / breath
    nameHighlight: false, // 話している人の名前を目立たせる
    nameHighlightColor: '#1E2124',
    nameHighlightBg: '#FFE38A'
  };

  /* 名前に使える Google Fonts（表示名: CSS 用の指定） */
  const FONTS = {
    'M PLUS Rounded 1c': 'M+PLUS+Rounded+1c:wght@400;700;800',
    'Zen Maru Gothic': 'Zen+Maru+Gothic:wght@500;700',
    'Kosugi Maru': 'Kosugi+Maru',
    'DotGothic16': 'DotGothic16',
    'Yusei Magic': 'Yusei+Magic',
    'RocknRoll One': 'RocknRoll+One',
    'Dela Gothic One': 'Dela+Gothic+One',
    'Zen Kurenaido': 'Zen+Kurenaido'
  };

  function activeUsers(users) {
    return (users || []).filter(u => u.enabled && String(u.id || '').trim() && u.stand);
  }

  const num = (v, d) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) ? d : Number(v));

  /* 自由配置：キャンバスの大きさ */
  function canvasSize(opt) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opt);
    return {
      w: Math.min(7680, Math.max(160, Math.round(num(o.canvasW, 1920)))),
      h: Math.min(4320, Math.max(90, Math.round(num(o.canvasH, 1080))))
    };
  }

  /* 自由配置：各キャラクターの位置。x = 左端、y = 足元（上からの距離）。未設定なら下に均等に並べる */
  function freeLayout(users, opt) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opt);
    const { w, h } = canvasSize(o);
    const list = activeUsers(users);
    const pad = Number(o.padding) || 0;
    const step = (w - pad * 2) / Math.max(1, list.length);
    const map = {};
    list.forEach((u, i) => {
      const x = Math.round(num(u.x, pad + step * i));
      const y = Math.round(num(u.y, h - pad));
      map[String(u.id).trim()] = {
        x: Math.min(w, Math.max(-2000, x)),
        y: Math.min(h + 2000, Math.max(0, y)),
        scale: Math.min(300, Math.max(10, num(u.scale, 100))),
        z: Math.round(num(u.z, i + 1))
      };
    });
    return map;
  }

  /* ---------- 互換モード：元の exe と同じ出力（発言中画像があるときだけ切り替えの行を追加） ---------- */
  function generateCompat(users, opt) {
    const list = activeUsers(users);
    const lines = [':root {'];
    for (const u of list) {
      const id = String(u.id).trim();
      lines.push(`  --img-stand-url-${id}: url("${u.stand}");`);
      // 元の版では空のまま未使用だった変数。発言中画像があれば入れる
      lines.push(`  --img-mouth-url-${id}: url("${u.mouth || ''}");`);
    }
    lines.push('}\n');
    lines.push('body, #root { overflow: hidden !important; }');
    lines.push('[class*="Voice_voiceStates__"] { display: flex; align-items: flex-end; padding: 16px; }');
    lines.push('[class*="Voice_voiceState__"] { height: auto; margin-bottom: 0px; }');
    lines.push('[class*="Voice_avatar__"] { filter: brightness(70%); }');

    const effects = [];
    const animations = [];
    if (opt.border) {
      effects.push('drop-shadow(2px 2px 0px #FFFFFF)');
      effects.push('drop-shadow(-2px -2px 0px #FFFFFF)');
      effects.push('drop-shadow(-2px 2px 0px #FFFFFF)');
      effects.push('drop-shadow(2px -2px 0px #FFFFFF)');
    }
    if (opt.blink) animations.push('speak-light');
    if (opt.jump) animations.push('speak-jump');

    let base = '[class*="Voice_avatarSpeaking__"] { position: relative; filter: brightness(100%)';
    if (effects.length) base += ' ' + effects.join(' ');
    base += ';';
    if (animations.length) {
      const anims = animations.map(a => `${a} 750ms infinite alternate ease-in-out`).join(', ');
      base += ` animation: ${anims};`;
    }
    base += ' }';
    lines.push(base);

    if (opt.blink) {
      lines.push('\n@keyframes speak-light {\n  0% { filter: drop-shadow(0 0 2px #FFFFFF); }\n  50% { filter: drop-shadow(0 0 8px #FFFFFF); }\n  100% { filter: drop-shadow(0 0 2px #FFFFFF); }\n}');
    }
    if (opt.jump) {
      lines.push('\n@keyframes speak-jump {\n  0% { bottom: 0px; }\n  50% { bottom: 10px; }\n  100% { bottom: 0px; }\n}');
    }
    lines.push('[class*="Voice_name__"] { display: none; }');
    lines.push('img { display: none; }');
    for (const u of list) {
      const id = String(u.id).trim();
      lines.push(`img[src*="avatars/${id}"] { content: var(--img-stand-url-${id}); display: block; width: auto; height: auto; max-width: 400px; border-radius: 0; border: none; }`);
      if (u.mouth) {
        lines.push(`img[src*="avatars/${id}"][class*="Voice_avatarSpeaking__"] { content: var(--img-mouth-url-${id}); }`);
      }
    }
    return lines.join('\n');
  }

  /* ---------- 改良版 ---------- */
  function cssUrl(v) {
    return 'url("' + String(v).replace(/[\r\n\t]/g, '').replace(/ /g, '%20').replace(/["\\]/g, '\\$&') + '")';
  }

  function rgba(hex, alpha) {
    const h = String(hex || '#000000').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * 100) / 100})`;
  }

  function outlineShadows(opt) {
    const w = Math.max(1, Number(opt.borderWidth) || 2);
    return OUTLINE_OFFSETS
      .map(([x, y]) => `drop-shadow(${x / 2 * w}px ${y / 2 * w}px 0px ${opt.borderColor})`)
      .join(' ');
  }

  function textOutline(color) {
    const d = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
    return d.map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(', ');
  }

  /* 話している間の追加の動き（transform を使うので上下運動と同時に使える） */
  function motionKeyframes(kind, strength, scale) {
    const k = Number(strength) || 5;
    const s = Number(scale) / 100;
    const sc = s === 1 ? '' : ` scale(${s})`;
    switch (kind) {
      case 'sway': return ['@keyframes speak-motion {', `  0% { transform: rotate(-${k * 0.8}deg)${sc}; }`, `  100% { transform: rotate(${k * 0.8}deg)${sc}; }`, '}'];
      case 'pulse': return ['@keyframes speak-motion {', `  0% { transform: scale(${s}); }`, `  100% { transform: scale(${Math.round((s + k / 100) * 1000) / 1000}); }`, '}'];
      case 'shake': return ['@keyframes speak-motion {', `  0% { transform: translateX(-${k * 0.5}px)${sc}; }`, `  100% { transform: translateX(${k * 0.5}px)${sc}; }`, '}'];
      case 'squash': return ['@keyframes speak-motion {', `  0% { transform: scale(${Math.round(s * (1 + k / 120) * 1000) / 1000}, ${Math.round(s * (1 - k / 120) * 1000) / 1000}); }`, `  100% { transform: scale(${Math.round(s * (1 - k / 200) * 1000) / 1000}, ${Math.round(s * (1 + k / 200) * 1000) / 1000}); }`, '}'];
      case 'nod': return ['@keyframes speak-motion {', `  0% { transform: rotate(0deg)${sc}; }`, `  100% { transform: rotate(${k * 0.6}deg) translateY(${k * 0.4}px)${sc}; }`, '}'];
      default: return [];
    }
  }

  const ENTER_KEYFRAMES = {
    fade: ['@keyframes join-enter {', '  from { opacity: 0; }', '  to { opacity: 1; }', '}'],
    up: ['@keyframes join-enter {', '  from { opacity: 0; transform: translateY(30px); }', '  to { opacity: 1; transform: translateY(0); }', '}'],
    pop: ['@keyframes join-enter {', '  0% { opacity: 0; transform: scale(.4); }', '  70% { opacity: 1; transform: scale(1.08); }', '  100% { transform: scale(1); }', '}']
  };

  const RAINBOW = ['#ff4d4d', '#ffb02e', '#ffe14d', '#4de06a', '#4db8ff', '#9b6bff'];
  const MARKS = { talk: '💬', note: '♪', notes: '🎵', bang: '！', star: '✨', heart: '💗' };

  function filterChain(parts) {
    return parts.filter(Boolean).join(' ');
  }

  function generateEnhanced(users, opt) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opt);
    const list = activeUsers(users);
    const speed = Math.max(100, Number(o.speedMs) || 750);
    const glow = Number(o.glowSize) || 8;
    const shadow = o.footShadow ? `drop-shadow(4px 8px 6px ${rgba(o.footShadowColor, 0.55)})` : '';
    const font = o.showName && FONTS[o.nameFont] ? o.nameFont : '';
    const enter = ENTER_KEYFRAMES[o.enter];
    const speakScale = Number(o.speakScale) || 100;
    const L = [];

    if (font) {
      L.push(`@import url('https://fonts.googleapis.com/css2?family=${FONTS[font]}&display=swap');`, '');
    }

    L.push('/* 立ち絵（待機 / 発言中） */');
    L.push(':root {');
    for (const u of list) {
      const id = String(u.id).trim();
      L.push(`  --stand-${id}: ${cssUrl(u.stand)};`);
      if (u.mouth) L.push(`  --mouth-${id}: ${cssUrl(u.mouth)};`);
    }
    L.push('}', '');

    L.push('/* 背景の透過とスクロール禁止 */');
    L.push('body, #root { background: transparent !important; overflow: hidden !important; margin: 0 !important; }', '');

    // 並べ方（間隔をマイナスにすると重なり、話している人が手前に来る）
    L.push('/* 並べ方 */');
    const free = o.direction === 'free';
    const col = o.direction === 'column';
    const gap = Number(o.gap) || 0;
    const cv = canvasSize(o);
    if (free) {
      // 自由配置：配信画面と同じ大きさの入れ物にして、登録した人は座標で置く（登録していない人は隅にまとめる）
      const place = String(o.othersPlace || 'bl');
      L.push(`[class*="Voice_voiceStates__"] { position: relative; box-sizing: border-box; width: ${cv.w}px; height: ${cv.h}px; display: flex; flex-flow: row wrap; justify-content: ${place.includes('r') ? 'flex-end' : 'flex-start'}; align-content: ${place.includes('t') ? 'flex-start' : 'flex-end'}; align-items: flex-end; gap: ${Math.max(0, gap)}px; padding: ${Number(o.padding) || 0}px; margin: 0; overflow: hidden; }`);
    } else {
      L.push(`[class*="Voice_voiceStates__"] { display: flex; flex-direction: ${col ? 'column' : 'row'}; align-items: ${col ? 'flex-start' : 'flex-end'}; gap: ${Math.max(0, gap)}px; padding: ${Number(o.padding) || 0}px; margin: 0; }`);
    }
    let state = `[class*="Voice_voiceState__"] { position: relative; display: flex; flex-direction: ${o.showName && o.namePos === 'above' ? 'column-reverse' : 'column'}; align-items: center; height: auto; margin: 0 !important;`;
    if (enter) state += ' animation: join-enter .5s ease-out backwards;';
    state += ' }';
    L.push(state);
    if (gap < 0 && !free) {
      L.push(`[class*="Voice_voiceState__"] + [class*="Voice_voiceState__"] { margin-${col ? 'top' : 'left'}: ${gap}px !important; }`);
    }
    if (enter) L.push(...enter);
    L.push('');

    if (free) {
      // 足元（左下）を基準に置くので、口パク差分で画像の高さが変わっても足元はずれない
      L.push('/* 自由配置（x = 左端、y = 足元の位置。配信画面の左上が 0, 0） */');
      const pos = freeLayout(users, o);
      for (const u of list) {
        const id = String(u.id).trim();
        const p = pos[id];
        const name = String(u.name || '').replace(/\*\//g, '');
        let r = `[class*="Voice_voiceState__"]:has(img[src*="avatars/${id}"]) { position: absolute; left: ${p.x}px; bottom: ${cv.h - p.y}px; z-index: ${p.z};`;
        if (p.scale !== 100) r += ` scale: ${Math.round(p.scale) / 100};`;
        r += ' transform-origin: 0 100%; }';
        if (name) L.push(`/* ${name} */`);
        L.push(r);
      }
      if (o.speakFront) {
        L.push('[class*="Voice_voiceState__"]:has([class*="Voice_avatarSpeaking__"]) { z-index: 1000 !important; }');
      }
      L.push('');
    }

    // 話していない人
    L.push('/* 話していない人 */');
    const idleScale = Number(o.idleScale) / 100;
    let idle = `[class*="Voice_avatar__"] { position: relative; z-index: 1; filter: ${filterChain([`brightness(${Number(o.idleBrightness)}%)`, o.idleGray ? 'grayscale(1)' : '', shadow])};`;
    if (Number(o.idleOpacity) < 100) idle += ` opacity: ${Number(o.idleOpacity) / 100};`;
    idle += ` transform: ${idleScale === 1 ? 'none' : `scale(${idleScale})`}; transform-origin: 50% 100%;`;
    if (o.idleMotion === 'breath') idle += ' animation: idle-breath 2.8s ease-in-out infinite alternate;';
    idle += ' transition: filter .2s ease, opacity .2s ease, transform .2s ease; }';
    L.push(idle);
    if (o.idleMotion === 'breath') {
      const s = idleScale;
      L.push('@keyframes idle-breath {');
      L.push(`  0% { transform: scale(${s}); }`);
      L.push(`  100% { transform: scale(${Math.round(s * 1.012 * 1000) / 1000}, ${Math.round(s * 0.985 * 1000) / 1000}); }`);
      L.push('}');
    }
    if (o.speakingOnly) {
      L.push('[class*="Voice_voiceState__"]:not(:has([class*="Voice_avatarSpeaking__"])) { display: none !important; }');
    }
    L.push('');

    // 話している人
    L.push('/* 話している人 */');
    const outlineColor = o.borderColor;
    const outlineOf = c => (o.border ? outlineShadows(Object.assign({}, o, { borderColor: c })) : '');
    const anims = [];
    const useFilterAnim = o.blink || (o.border && o.rainbow);
    if (useFilterAnim) {
      anims.push(o.rainbow && o.border
        ? `speak-filter ${speed * 4}ms infinite linear`
        : `speak-filter ${speed}ms infinite alternate ease-in-out`);
    }
    if (o.jump) anims.push(`speak-jump ${speed}ms infinite alternate ease-in-out`);
    if (o.motion && o.motion !== 'none') {
      const ms = o.motion === 'shake' ? Math.max(60, Math.round(speed / 6)) : speed;
      anims.push(`speak-motion ${ms}ms infinite alternate ease-in-out`);
    }
    let speaking = `[class*="Voice_avatarSpeaking__"] { position: relative; z-index: 2; filter: ${filterChain(['brightness(100%)', outlineOf(outlineColor), shadow])}; opacity: 1;`;
    speaking += ` transform: ${speakScale === 100 ? 'none' : `scale(${speakScale / 100})`}; transform-origin: 50% 100%;`;
    speaking += ` animation: ${anims.length ? anims.join(', ') : 'none'};`;
    speaking += ' }';
    L.push(speaking);

    if (useFilterAnim) {
      // 縁取り・虹色・点滅・影をひとつの keyframes にまとめる（filter の上書きで消えないように）
      L.push('@keyframes speak-filter {');
      if (o.rainbow && o.border) {
        const steps = RAINBOW.concat(RAINBOW[0]);
        steps.forEach((c, i) => {
          const pct = Math.round(i / (steps.length - 1) * 100);
          const g = o.blink ? `drop-shadow(0 0 ${i % 2 ? glow : Math.max(1, Math.round(glow / 4))}px ${c})` : '';
          L.push(`  ${pct}% { filter: ${filterChain(['brightness(100%)', outlineOf(c), g, shadow])}; }`);
        });
      } else {
        L.push(`  0% { filter: ${filterChain(['brightness(100%)', outlineOf(outlineColor), `drop-shadow(0 0 ${Math.max(1, Math.round(glow / 4))}px ${o.glowColor})`, shadow])}; }`);
        L.push(`  100% { filter: ${filterChain(['brightness(100%)', outlineOf(outlineColor), `drop-shadow(0 0 ${glow}px ${o.glowColor})`, shadow])}; }`);
      }
      L.push('}');
    }
    if (o.jump) {
      L.push('@keyframes speak-jump {');
      L.push('  0% { bottom: 0px; }');
      L.push(`  100% { bottom: ${Number(o.jumpHeight) || 0}px; }`);
      L.push('}');
    }
    L.push(...motionKeyframes(o.motion, o.motionStrength, speakScale));
    L.push('');

    // 話している人のまわりの演出（名前の入れ物の疑似要素を使う。:has() 不要）
    const after = '[class*="Voice_avatarSpeaking__"] + [class*="Voice_user__"]';
    const mark = o.mark === 'custom' ? String(o.markText || '').slice(0, 8) : MARKS[o.mark];
    if (mark) {
      L.push('/* 話している人のマーク */');
      L.push(`${after}::before { content: "${mark.replace(/["\\]/g, '\\$&')}"; position: absolute; top: 0; right: 0; z-index: 3; font-size: ${Number(o.markSize) || 32}px; line-height: 1; color: ${o.markColor}; text-shadow: 0 0 4px rgba(0, 0, 0, .6); pointer-events: none; animation: speak-mark 900ms ease-in-out infinite alternate; }`);
      L.push('@keyframes speak-mark {');
      L.push('  0% { transform: translateY(0) rotate(-8deg); }');
      L.push('  100% { transform: translateY(-10px) rotate(8deg); }');
      L.push('}');
      L.push('');
    }
    if (o.aura && o.aura !== 'none') {
      L.push('/* 話している人の後ろの演出 */');
      const base = `${after}::after { content: ""; position: absolute; left: 50%; top: 45%; width: 110%; aspect-ratio: 1; border-radius: 50%; z-index: 0; pointer-events: none;`;
      const c = o.auraColor;
      if (o.aura === 'spot') {
        L.push(`${base} transform: translate(-50%, -50%); background: radial-gradient(circle, ${rgba(c, 0.6)} 0%, ${rgba(c, 0.25)} 40%, ${rgba(c, 0)} 70%); animation: aura-spot 1.2s ease-in-out infinite alternate; }`);
        L.push('@keyframes aura-spot {', '  0% { opacity: .65; }', '  100% { opacity: 1; }', '}');
      } else if (o.aura === 'halo') {
        L.push(`${base} background: repeating-conic-gradient(${rgba(c, 0.55)} 0deg 8deg, ${rgba(c, 0)} 8deg 24deg); -webkit-mask: radial-gradient(circle, transparent 0 30%, #000 42%, #000 58%, transparent 70%); mask: radial-gradient(circle, transparent 0 30%, #000 42%, #000 58%, transparent 70%); animation: aura-halo 8s linear infinite; }`);
        L.push('@keyframes aura-halo {', '  from { transform: translate(-50%, -50%) rotate(0deg); }', '  to { transform: translate(-50%, -50%) rotate(360deg); }', '}');
      } else if (o.aura === 'ripple') {
        L.push(`${base} border: 4px solid ${c}; box-sizing: border-box; animation: aura-ripple 1.4s ease-out infinite; }`);
        L.push('@keyframes aura-ripple {', '  0% { transform: translate(-50%, -50%) scale(.5); opacity: .9; }', '  100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0; }', '}');
      }
      L.push('');
    }

    // 名前（StreamKit は名前に直接スタイルを書いているので !important で上書きする）
    L.push('/* 名前 */');
    L.push('[class*="Voice_user__"] { position: static !important; padding: 0 !important; margin: 0 !important; text-align: center; white-space: nowrap; }');
    if (o.showName) {
      const n = ['[class*="Voice_name__"] { display: inline-block !important;'];
      if (o.namePos === 'overlay') n.push(' position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); z-index: 3;');
      else n.push(` position: relative; z-index: 3; margin: ${o.namePos === 'above' ? '0 0 4px' : '4px 0 0'} !important;`);
      n.push(` color: ${o.nameColor} !important;`);
      n.push(` font-size: ${Number(o.nameSize) || 14}px !important;`);
      n.push(` font-weight: ${o.nameBold ? 800 : 500} !important;`);
      if (font) n.push(` font-family: '${font}', sans-serif !important;`);
      n.push(` background-color: ${rgba(o.nameBg, (Number(o.nameBgOpacity) || 0) / 100)} !important;`);
      n.push(` border-radius: ${Number(o.nameRadius) || 0}px !important;`);
      n.push(' padding: .2em .55em !important; line-height: 1.35 !important; white-space: nowrap; transition: color .2s ease, background-color .2s ease;');
      if (o.nameOutline) n.push(` text-shadow: ${textOutline(o.nameOutlineColor)} !important;`);
      n.push(' }');
      L.push(n.join(''));
      if (o.nameHighlight) {
        L.push(`${after} [class*="Voice_name__"] { color: ${o.nameHighlightColor} !important; background-color: ${rgba(o.nameHighlightBg, Math.max(0.6, (Number(o.nameBgOpacity) || 0) / 100))} !important; }`);
      }
    } else {
      L.push('[class*="Voice_name__"] { display: none !important; }');
    }
    L.push('');

    if (!o.showOthers) {
      L.push('/* 登録していない人を隠す */');
      L.push('img { display: none; }');
      if (list.length) {
        const sel = list.map(u => `img[src*="avatars/${String(u.id).trim()}"]`).join(', ');
        L.push(`[class*="Voice_voiceState__"]:not(:has(${sel})) { display: none !important; }`);
      } else {
        L.push('[class*="Voice_voiceState__"] { display: none !important; }');
      }
      L.push('');
    }

    L.push('/* ユーザーごとの差し替え */');
    for (const u of list) {
      const id = String(u.id).trim();
      const name = String(u.name || '').replace(/\*\//g, '');
      if (name) L.push(`/* ${name} */`);
      let rule = `img[src*="avatars/${id}"] { content: var(--stand-${id}); display: block; width: auto; height: auto; max-width: ${Number(o.maxWidth) || 400}px;`;
      if (Number(o.maxHeight) > 0) rule += ` max-height: ${Number(o.maxHeight)}px;`;
      rule += ' border-radius: 0; border: none; }';
      L.push(rule);
      if (u.mouth) {
        L.push(`img[src*="avatars/${id}"][class*="Voice_avatarSpeaking__"] { content: var(--mouth-${id}); }`);
      }
    }
    return L.join('\n');
  }

  function generateCSS(users, opt) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opt);
    return o.mode === 'compat' ? generateCompat(users, o) : generateEnhanced(users, o);
  }

  /* ---------- URL ---------- */
  function buildUrl(guild, channel) {
    const g = String(guild || '').trim();
    const c = String(channel || '').trim();
    if (!g || !c) return '';
    return `https://streamkit.discord.com/overlay/voice/${g}/${c}`;
  }


  const api = { DEFAULT_OPTIONS, FONTS, generateCSS, buildUrl, freeLayout, canvasSize };
  window.OverlayCSS = api;
})();
