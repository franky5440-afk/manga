// check_book3d.mjs — 3D 精裝書＋全站書色統一＋書架牆面的介面契約（2026-09-21，Frank 核定原型 C）。
// 執行：node tools/check_book3d.mjs（需本機有 google-chrome 或 chromium；可用 CHROME=路徑 指定）
// 為什麼要開真瀏覽器：首頁書架的進場動畫最後一格是 transform: none 且 fill-mode both，
// 動畫層級高於一般宣告，會把書卡的 3D 旋轉蓋回平面——只讀 CSS 文字看不出來，必須量 computed style。
// 外觀好不好看仍由 review 端截圖判斷，這裡只釘「結構、數值與可讀性」。
// 2026-09-21 第二版（上線後 Frank 回報）：書脊太薄、看不到書脊與封面間的折線、書牆最左排書脊超出框；
// 另在 iMac Chrome（GPU）實測「漸層裡的 color-mix 會畫錯色」「preserve-3d 會把文字斜切」。
// 因此改為：書脊是書卡盒子內的色帶（不再往後折 90 度）、摺痕是 ::after、底色純 --tone 疊半透明深色、禁用 preserve-3d。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('assets/css/style.css');
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');   // 去掉註解，避免說明文字被當成違規

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n   ', e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

// ── 色彩工具 ──────────────────────────────────────────────
const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
// rgb()／rgba() 為 0~255；color-mix 的計算值 Chrome 會回傳 color(srgb r g b)，為 0~1（舊版漏了這種格式，彩度檢查形同空轉）
const rgb = (s) => {
  const m = s.match(/rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (m) return [m[1], m[2], m[3]].map((v) => Number(v) / 255);
  const k = s.match(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/);
  return k ? [k[1], k[2], k[3]].map(Number) : null;
};
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
// 封面＝純色 --tone 底，疊一層「--ground 色（27, 20, 17）半透明」的垂直漸層做上亮下暗。
// 換算成混色比例：stops[i] ＝ (1 − alpha) × 100，即 --tone 佔的百分比，與舊版 color-mix 色標等價。
const shade = cardRule.match(/linear-gradient\(\s*(180deg|to bottom)\s*,\s*rgba\(\s*27,\s*20,\s*17,\s*([\d.]+)\s*\)[^,]*,\s*rgba\(\s*27,\s*20,\s*17,\s*([\d.]+)\s*\)/);
const stops = shade ? [shade[2], shade[3]].map((a) => Math.round((1 - Number(a)) * 1000) / 10) : [];
test('封面：background-color 為 var(--tone)，疊 180deg 的 rgba(27, 20, 17, a) 兩色標漸層，上亮下暗、alpha 相差 ≥ 0.30', () => {
  ok(/background-color\s*:\s*var\(--tone\)\s*;/.test(cardRule), '.book-card 要有 background-color: var(--tone)');
  ok(stops.length === 2, '.book-card 找不到 linear-gradient(180deg, rgba(27, 20, 17, a), rgba(27, 20, 17, b)) 的深色疊層');
  ok(stops[0] - stops[1] >= 30, '上 alpha ' + shade[2] + '、下 alpha ' + shade[3] + '，落差不足 0.30（或方向反了）');
});
test('漸層裡不可有 color-mix()（iMac Chrome 實測會畫錯色；要混色請先存成自訂屬性或改用半透明疊層）', () => {
  const bad = [...cssCode.matchAll(/([a-z-]+)\s*:\s*([^;{}]*gradient\([^;{}]*);/g)].filter((m) => /color-mix\(/.test(m[2])).map((m) => m[1] + ': ' + m[2].slice(0, 60));
  ok(!bad.length, bad.length + ' 條宣告違規，例：' + bad[0]);
});
test('不可使用 transform-style: preserve-3d（iMac Chrome 實測會把書卡文字斜切）', () => {
  ok(!/preserve-3d/.test(cssCode), 'style.css 仍含 preserve-3d（註解不算）');
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
    const minSpine = w >= 720 ? 28 : 20;
    test(`[${w}px] ${p}：書卡是平面（transform-style 為 flat）`, () => {
      const bad = R.cards.filter((c) => c.ts !== 'flat');
      ok(!bad.length, bad.length + ' 本不是 flat，例：' + (bad[0] && bad[0].ts));
    });
    test(`[${w}px] ${p}：::before 是書卡盒子內左側的書脊色帶（left ≥ 0、寬 ≥ ${minSpine}px、沒有被轉成側面）`, () => {
      const bad = R.cards.filter((c) => {
        const v = matrix(c.spineT);
        return c.spineContent === 'none' || c.spinePos !== 'absolute' || parseFloat(c.spineLeft) < 0 || parseFloat(c.spineW) < minSpine ||
          (c.spineT !== 'none' && (!v || Math.abs(v[0]) < 0.9)) || !/rgba\(0, 0, 0, 0\.[3-9]/.test(c.spineImg);
      });
      ok(!bad.length, bad.length + ' 本不符，例：' + JSON.stringify(bad[0] && { left: bad[0].spineLeft, w: bad[0].spineW, t: bad[0].spineT, pos: bad[0].spinePos, img: bad[0].spineImg.slice(0, 80) }));
    });
    test(`[${w}px] ${p}：::after 是書脊與封面交界的摺痕（緊貼書脊右緣、寬 3~10px、起點是 alpha ≥ 0.45 的暗溝）`, () => {
      const bad = R.cards.filter((c) => {
        const edge = parseFloat(c.spineLeft) + parseFloat(c.spineW), left = parseFloat(c.creaseLeft), cw = parseFloat(c.creaseW);
        const first = (c.creaseImg.match(/rgba\(0, 0, 0, ([\d.]+)\)/) || [])[1];
        return c.creaseContent === 'none' || Math.abs(left - edge) > 3 || !(cw >= 3 && cw <= 10) || !(Number(first) >= 0.45);
      });
      ok(!bad.length, bad.length + ' 本不符，例：' + JSON.stringify(bad[0] && { left: bad[0].creaseLeft, w: bad[0].creaseW, spineEdge: parseFloat(bad[0].spineLeft) + parseFloat(bad[0].spineW), img: bad[0].creaseImg.slice(0, 80) }));
    });
    test(`[${w}px] ${p}：書卡文字不壓在書脊與摺痕上（內容左緣 ≥ 書脊右緣 + 6px）`, () => {
      const bad = R.cards.filter((c) => c.contentLeft < parseFloat(c.spineLeft) + parseFloat(c.spineW) + 6);
      ok(!bad.length, bad.length + ' 本不符，例：內容左緣 ' + (bad[0] && bad[0].contentLeft) + 'px、書脊寬 ' + (bad[0] && bad[0].spineW));
    });
    test(`[${w}px] ${p}：書名裡的英文單字不可從中間斷行（例：SPY×FAMILY）`, () => ok(!R.brokenWords.length, '斷字：' + R.brokenWords.slice(0, 4).join('、')));
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
    test(`[${w}px] ${p}：書牆的書（含書脊）不超出牆面左右邊界`, () => ok(!R.outOfWall.length, '超出：' + R.outOfWall.slice(0, 4).join('、')));
    test(`[${w}px] ${p}：書卡顏色已調和（封面底色 sRGB 彩度 ≤ 0.52）`, () => {
      const bad = R.cards.map((c) => rgb(c.bg)).filter((c) => !c || chroma(c) > 0.52);
      ok(!bad.length, bad.length + ' 個色標太鮮豔，例：' + bad.slice(0, 2).map((c) => c.map((v) => Math.round(v * 255)).join(',')).join('；'));
    });
  }
  // 華文圈小封面（首頁）與詳情頁大封面：Frank 2026-09-21 追加「華文圈排行的書沒有跟著改成 3D」
  for (const p of ['index.html', PAGES[PAGES.length - 1]]) {
    const R = S[p];
    if (!R || R.error) continue;
    const O = R.objs || [];
    test(`[${w}px] ${p}：頁面上有 .book-obj 封面可量`, () => ok(O.length, '找不到 .book-obj'));
    if (!O.length) continue;
    test(`[${w}px] ${p}：封面（.book-obj）靜止時往右轉 15~45 度，且為 flat`, () => {
      const bad = O.map((o) => {
        const v = matrix(o.t);
        if (!v) return 'transform=' + o.t;
        const deg = Math.acos(Math.max(-1, Math.min(1, v[0]))) * 180 / Math.PI;
        return deg >= 15 && deg <= 45 && v[2] < 0 && o.ts === 'flat' ? null : deg.toFixed(1) + 'deg／' + o.ts;
      }).filter(Boolean);
      ok(!bad.length, bad.length + ' 個不符：' + bad.slice(0, 3).join(', '));
    });
    test(`[${w}px] ${p}：封面 ::before 是盒內書脊色帶（left ≥ 0、小封面寬 ≥ 12px／大封面 ≥ 24px、不轉成側面）`, () => {
      const bad = O.filter((o) => {
        const v = matrix(o.spineT);
        return o.spineContent === 'none' || o.spinePos !== 'absolute' || parseFloat(o.spineLeft) < 0 || parseFloat(o.spineW) < (o.sm ? 12 : 24) ||
          (o.spineT !== 'none' && (!v || Math.abs(v[0]) < 0.9)) || !/rgba\(0, 0, 0, 0\.[3-9]/.test(o.spineImg);
      });
      ok(!bad.length, bad.length + ' 個不符，例：' + JSON.stringify(bad[0] && { sm: bad[0].sm, left: bad[0].spineLeft, w: bad[0].spineW, img: bad[0].spineImg.slice(0, 60) }));
    });
    test(`[${w}px] ${p}：封面 ::after 摺痕緊貼書脊右緣（寬 2~8px、起點 alpha ≥ 0.45）`, () => {
      const bad = O.filter((o) => {
        const edge = parseFloat(o.spineLeft) + parseFloat(o.spineW), cw = parseFloat(o.creaseW);
        const first = (o.creaseImg.match(/rgba\(0, 0, 0, ([\d.]+)\)/) || [])[1];
        return o.creaseContent === 'none' || Math.abs(parseFloat(o.creaseLeft) - edge) > 3 || !(cw >= 2 && cw <= 8) || !(Number(first) >= 0.45);
      });
      ok(!bad.length, bad.length + ' 個不符，例：' + JSON.stringify(bad[0] && { left: bad[0].creaseLeft, w: bad[0].creaseW }));
    });
    test(`[${w}px] ${p}：封面上亮下暗（.book-face 疊 180deg 的 rgba(27, 20, 17, a) 漸層），書名不壓書脊`, () => {
      const bad = O.filter((o) => !/linear-gradient\(rgba\(27, 20, 17, [\d.]+\), rgba\(27, 20, 17, [\d.]+\)\)/.test(o.faceImg) ||
        (o.textLeft !== null && o.textLeft < parseFloat(o.spineLeft) + parseFloat(o.spineW) + 4));
      ok(!bad.length, bad.length + ' 個不符，例：' + JSON.stringify(bad[0] && { face: bad[0].faceImg.slice(0, 70), textLeft: bad[0].textLeft, spineW: bad[0].spineW }));
    });
    test(`[${w}px] ${p}：封面轉角度後不超出所在卡片`, () => {
      const bad = O.filter((o) => o.outside);
      ok(!bad.length, bad.length + ' 個超出');
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
