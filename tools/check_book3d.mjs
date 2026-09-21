// check_book3d.mjs — 3D 精裝書＋全站書色統一＋書架牆面的介面契約（2026-09-21，Frank 核定原型 C）。
// 執行：node tools/check_book3d.mjs（需本機有 google-chrome 或 chromium；可用 CHROME=路徑 指定）
// 為什麼要開真瀏覽器：首頁書架的進場動畫最後一格是 transform: none 且 fill-mode both，
// 動畫層級高於一般宣告，會把書卡的 3D 旋轉蓋回平面——只讀 CSS 文字看不出來，必須量 computed style。
// 外觀好不好看仍由 review 端截圖判斷，這裡只釘「結構、數值與可讀性」。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('assets/css/style.css');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n   ', e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

// ── 色彩工具 ──────────────────────────────────────────────
const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const rgb = (s) => { const m = s.match(/rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m ? [m[1], m[2], m[3]].map((v) => Number(v) / 255) : null; };
const lum = (c) => { const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
const chroma = (c) => Math.max(...c) - Math.min(...c);
const token = (name) => { const m = css.match(new RegExp(name + '\\s*:\\s*(#[0-9a-f]{6})\\s*;', 'i')); return m ? m[1].toLowerCase() : null; };
// 以頂層逗號切 background-image 的各層（括號內的逗號不切）
function layers(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const matrix = (t) => { const m = /^matrix3d\(([^)]+)\)/.exec(t || ''); return m ? m[1].split(',').map(Number) : null; };

// ── 靜態：色票與 CSS 規則 ─────────────────────────────────
const WALL_TOP = '#4a3526', WALL = '#3d2c20', LEATHER = '#6b4a33';
test('色票：--leather #6b4a33、--wall-top #4a3526、--wall #3d2c20；--ground 維持 #1b1411', () => {
  ok(token('--leather') === LEATHER, '--leather 應為 ' + LEATHER + '，實際 ' + token('--leather'));
  ok(token('--wall-top') === WALL_TOP, '--wall-top 應為 ' + WALL_TOP + '，實際 ' + token('--wall-top'));
  ok(token('--wall') === WALL, '--wall 應為 ' + WALL + '，實際 ' + token('--wall'));
  ok(token('--ground') === '#1b1411', '--ground 不可改（書卡混色與對比測試都以它為準）');
});
test('書色統一：--tone 為 var(--c) 45% 混 var(--leather)，且 var(--c) 只准出現在 --tone 定義裡', () => {
  ok(/--tone\s*:\s*color-mix\(\s*in\s+srgb\s*,\s*var\(--c\)\s+45%\s*,\s*var\(--leather\)\s*\)/.test(css), '缺少 --tone: color-mix(in srgb, var(--c) 45%, var(--leather))');
  const uses = (css.match(/var\(--c\)/g) || []).length;
  const inTone = (css.match(/--tone\s*:[^;]*var\(--c\)/g) || []).length;
  ok(uses === inTone, 'var(--c) 在 --tone 以外還出現 ' + (uses - inTone) + ' 次（書脊、封面、華文圈小封面都要改用 var(--tone)）');
});
const cardRule = (css.match(/(^|\n)\s*\.book-card\s*\{([^}]*)\}/) || [])[2] || '';
const stops = [...cardRule.matchAll(/color-mix\(\s*in\s+srgb\s*,\s*var\(--tone\)\s+(\d+(?:\.\d+)?)%\s*,\s*var\(--ground\)\s*\)/g)].map((m) => Number(m[1]));
test('封面漸層：垂直、上亮下暗、兩色標相差 ≥ 30 個百分點', () => {
  ok(stops.length === 2, '.book-card 應有兩個 var(--tone) 混 var(--ground) 的色標，實際 ' + stops.length);
  const main = cardRule.match(/linear-gradient\(\s*([^,]*?)\s*,\s*color-mix\(\s*in\s+srgb\s*,\s*var\(--tone\)/);
  ok(main && /^(180deg|to bottom)$/.test(main[1].trim()), '主漸層要明寫 180deg 或 to bottom，實際 ' + (main && main[1]));
  ok(stops[0] - stops[1] >= 30, '上 ' + stops[0] + '% 下 ' + stops[1] + '%，落差不足 30');
});
// 找出「selector 含 .book-card 與指定狀態」的規則裡的 rotateY 角度
function stateAngles(state) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1], body = m[2];
    if (!sel.includes(state) || !sel.includes('.book-card')) continue;
    const a = body.match(/rotateY\(\s*(-?[\d.]+)deg\s*\)/);
    if (a) out.push(Number(a[1]));
  }
  return out;
}
test('滑鼠移上去轉正：有 :hover 規則把 .book-card 轉到 |rotateY| ≤ 12deg', () => {
  const a = stateAngles(':hover');
  ok(a.some((x) => Math.abs(x) <= 12), '找不到 :hover 的轉正規則，實際角度 ' + JSON.stringify(a));
});
test('鍵盤也能轉正：有 :focus-visible 或 :focus-within 規則把 .book-card 轉到 |rotateY| ≤ 12deg', () => {
  const a = stateAngles(':focus-visible').concat(stateAngles(':focus-within'));
  ok(a.some((x) => Math.abs(x) <= 12), '找不到鍵盤聚焦的轉正規則，實際角度 ' + JSON.stringify(a));
});

// ── 真瀏覽器量測 ──────────────────────────────────────────
const firstId = JSON.parse(read('data/manga.json'))[0].id;
const LIST_PAGES = ['index.html', 'timeless.html', 'essentials.html', 'library.html'];
const PAGES = LIST_PAGES.concat(['manga.html?id=' + firstId]);
const chrome = [process.env.CHROME, 'google-chrome', 'chromium', 'chromium-browser']
  .filter(Boolean).find((b) => spawnSync(b, ['--version']).status === 0);

async function probe(width) {
  const port = 8800 + Math.floor(Math.random() * 900);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'book3d-'));
  try {
    await new Promise((r) => setTimeout(r, 800));
    const url = 'http://127.0.0.1:' + port + '/tools/book3d_probe.html?pages=' + encodeURIComponent(PAGES.join(','));
    const res = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--user-data-dir=' + profile, '--window-size=' + width + ',900', '--virtual-time-budget=40000', '--dump-dom', url],
    { encoding: 'utf8', timeout: 120000 });
    const m = (res.stdout || '').match(/<pre id="out">([\s\S]*?)<\/pre>/);
    const text = m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&') : '';
    return text.startsWith('{') ? JSON.parse(text) : null;
  } finally {
    srv.kill();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

test('本機有 Chrome／Chromium 可跑真瀏覽器量測', () => ok(chrome, '找不到 google-chrome／chromium（可用 CHROME=路徑 指定）'));
const shots = {};
if (chrome) for (const w of [360, 1280]) shots[w] = await probe(w);

const ground = hex('#1b1411'), leather = hex(LEATHER), white = [1, 1, 1];
const books = ['manga', 'essentials', 'classics'].flatMap((f) => JSON.parse(read('data/' + f + '.json')).map((b) => hex(b.color || '#3b4a6b')));

for (const w of [360, 1280]) {
  const S = shots[w];
  test(`[${w}px] 量測頁有回傳五頁結果`, () => {
    ok(S, '量測頁沒有回傳 JSON（Chrome 沒跑完或 probe 壞了）');
    for (const p of PAGES) ok(S[p] && !S[p].error, p + '：' + (S[p] && S[p].error || '無結果'));
  });
  if (!S) continue;
  for (const p of LIST_PAGES) {
    const R = S[p];
    if (!R || R.error) continue;
    test(`[${w}px] ${p}：書卡靜止時往右轉 20~45 度（露出左側書脊），且沒有被進場動畫蓋回平面`, () => {
      ok(R.cardCount > 0, '頁面上沒有 .book-card');
      const bad = R.cards.map((c) => {
        const v = matrix(c.t);
        if (!v) return 'transform=' + c.t;
        const deg = Math.acos(Math.max(-1, Math.min(1, v[0]))) * 180 / Math.PI;
        return deg >= 20 && deg <= 45 && v[2] < 0 ? null : deg.toFixed(1) + 'deg(m13=' + v[2].toFixed(2) + ')';
      }).filter(Boolean);
      ok(!bad.length, bad.length + ' 本不符：' + bad.slice(0, 4).join(', '));
    });
    test(`[${w}px] ${p}：::before 是往後折 90 度的書脊（transform-origin 在左緣、寬 ≥ 20px）`, () => {
      const bad = R.cards.filter((c) => {
        const v = matrix(c.spineT);
        return c.spineContent === 'none' || !v || Math.abs(v[0]) > 0.05 || !/^0px\b/.test(c.spineOrigin) || parseFloat(c.spineW) < 20;
      });
      ok(!bad.length, bad.length + ' 本不符，例：' + JSON.stringify(bad[0] && { t: bad[0].spineT, o: bad[0].spineOrigin, w: bad[0].spineW }));
    });
    test(`[${w}px] ${p}：封面左緣有摺痕層（90deg 線性漸層、寬 ≤ 24px）`, () => {
      const c = R.cards[0];
      const L = layers(c.img), Z = layers(c.size);
      ok(L.some((l, i) => /^linear-gradient\(90deg/.test(l) && /^\d+(\.\d+)?px\b/.test(Z[i] || '') && parseFloat(Z[i]) <= 24),
        '找不到摺痕層，background-image 層數 ' + L.length + '，background-size ' + c.size);
    });
    test(`[${w}px] ${p}：全幅白色反光不可把書名對比壓到 3.0 以下`, () => {
      const c = R.cards[0];
      const L = layers(c.img), Z = layers(c.size);
      let alpha = 0;
      L.forEach((l, i) => {
        if (/^\d+(\.\d+)?px\b/.test(Z[i] || '') && parseFloat(Z[i]) <= 24) return;   // 摺痕層只在左緣，不蓋書名
        for (const m of l.matchAll(/rgba\(\s*255,\s*255,\s*255,\s*([\d.]+)\)/g)) alpha = Math.max(alpha, Number(m[1]));
      });
      ok(stops.length === 2, '色標格式不符，無法計算');
      const worst = Math.min(...books.map((b) => contrast(white, mix(white, mix(mix(b, leather, 0.45), ground, stops[0] / 100), alpha))));
      ok(worst >= 3, '反光 alpha ' + alpha + ' 讓最暗的一本書名對比只剩 ' + worst.toFixed(2));
    });
    test(`[${w}px] ${p}：每本書下方有地面陰影（li::after 放射漸層）`, () => {
      ok(R.liShadow.length, '找不到書架／書牆的 li');
      const bad = R.liShadow.filter((s) => s.content === 'none' || !/radial-gradient/.test(s.img));
      ok(!bad.length, bad.length + ' 個 li 沒有地面陰影');
    });
    test(`[${w}px] ${p}：書架區是胡桃木牆（背景含 --wall-top 與 --wall）`, () => {
      ok(R.walls.length, '找不到 .shelf-viewport／.book-wall');
      const bad = R.walls.filter((s) => !s.includes('rgb(74, 53, 38)') || !s.includes('rgb(61, 44, 32)'));
      ok(!bad.length, bad.length + ' 面牆不符，例：' + bad[0]);
    });
    test(`[${w}px] ${p}：牆面上書卡以外的文字，對最亮的牆色 ${WALL_TOP} 對比 ≥ 4.5`, () => {
      const bad = R.wallText.filter((t) => { const c = rgb(t.color); return !c || contrast(c, hex(WALL_TOP)) < 4.5; });
      ok(!bad.length, bad.length + ' 處不足，例：' + bad.slice(0, 3).map((t) => t.text + '=' + t.color).join('；'));
    });
    test(`[${w}px] ${p}：書卡內容沒有溢出封面`, () => ok(!R.overflow.length, '溢出：' + R.overflow.slice(0, 4).join('、')));
    test(`[${w}px] ${p}：書卡顏色已調和（主漸層各色標 sRGB 彩度 ≤ 0.52）`, () => {
      const bad = R.cards.map((c) => layers(c.img).pop()).map((l) => [...l.matchAll(/rgba?\([^)]+\)/g)].map((m) => rgb(m[0])).filter(Boolean))
        .flat().filter((c) => chroma(c) > 0.52);
      ok(!bad.length, bad.length + ' 個色標太鮮豔，例：' + bad.slice(0, 2).map((c) => c.map((v) => Math.round(v * 255)).join(',')).join('；'));
    });
  }
  for (const p of PAGES) {
    const R = S[p];
    if (!R || R.error) continue;
    test(`[${w}px] ${p}：頁面底色維持 --ground（只換書架區，不換整站）`, () => ok(R.bodyBg === 'rgb(27, 20, 17)', 'body 背景 ' + R.bodyBg));
    test(`[${w}px] ${p}：沒有橫向捲軸`, () => ok(R.scrollWidth <= R.innerWidth, 'scrollWidth ' + R.scrollWidth + ' > ' + R.innerWidth));
    test(`[${w}px] ${p}：小封面／大封面（.book-face）也已調和（彩度 ≤ 0.52）`, () => {
      const bad = R.faces.map(rgb).filter((c) => c && chroma(c) > 0.52);
      ok(!bad.length, bad.length + ' 個封面太鮮豔，例：' + bad.slice(0, 2).map((c) => c.map((v) => Math.round(v * 255)).join(',')).join('；'));
    });
  }
}

console.log(failed ? `\n${failed} FAIL` : '\nALL PASS');
process.exit(failed ? 1 : 0);
