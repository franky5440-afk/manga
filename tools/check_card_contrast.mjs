// check_card_contrast.mjs — 書卡白字可讀性契約：拿站上全部書的真實 color 欄位，
// 依 style.css 的混色比例算 WCAG 對比度。執行：node tools/check_card_contrast.mjs
// 為什麼要寫成測試：第一版書卡在 76 本裡有 50 本白字對比不到 3.0，截圖縮圖上看不出來。
// 2026-09-21 改寫（Frank 裁示全站書色統一）：書本色一律先經 --tone（混 --leather 皮革色）調和，
// 書卡漸層改用 var(--tone) 混 var(--ground)，所以這裡的算式也先混 --leather 再混 --ground。
// 2026-09-21 第二版：漸層裡的 color-mix 在部分 GPU 會畫錯色，書卡改為「background-color: var(--tone)」
// 疊「linear-gradient(180deg, rgba(27, 20, 17, a), rgba(27, 20, 17, b))」。半透明 --ground 疊在 --tone 上，
// 等於 --tone 佔 (1 − alpha) 的混色，算式不變，只是從 alpha 換算比例。
import fs from 'node:fs';
import path from 'node:path';
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

// 只取 .book-card { ... } 本體那一條規則（不含 ::before、:hover）
function rule(selector) {
  const re = new RegExp('(^|\\n)\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  return m ? m[2] : null;
}
const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const lum = (c) => { const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
const white = (c) => 1.05 / (lum(c) + 0.05);

const ground = hex((css.match(/--ground\s*:\s*(#[0-9a-f]{6})/i) || [])[1] || '#000000');
const books = ['manga', 'essentials', 'classics'].flatMap((f) => JSON.parse(read('data/' + f + '.json')).map((b) => ({ id: b.id, c: hex(b.color || '#3b4a6b') })));

const card = rule('.book-card');
// 規定寫法：--tone: color-mix(in srgb, var(--c) N%, var(--leather))；書卡 background-color: var(--tone)，
// 上面疊 linear-gradient(180deg, rgba(27, 20, 17, a), rgba(27, 20, 17, b))，27, 20, 17 就是 --ground
const leather = hex((css.match(/--leather\s*:\s*(#[0-9a-f]{6})/i) || [])[1] || '#000000');
const toneM = css.match(/--tone\s*:\s*color-mix\(\s*in\s+srgb\s*,\s*var\(--c\)\s+(\d+(?:\.\d+)?)%\s*,\s*var\(--leather\)\s*\)/);
const toneK = toneM ? Number(toneM[1]) / 100 : null;
const tone = (c) => mix(c, leather, toneK);
const shade = card && card.match(/linear-gradient\(\s*(?:180deg|to bottom)\s*,\s*rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)[^,]*,\s*rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
const shadeIsGround = shade && [1, 2, 3, 5, 6, 7].every((i, k) => Math.abs(Number(shade[i]) / 255 - ground[k % 3]) < 0.003);
const stops = shade && shadeIsGround ? [1 - Number(shade[4]), 1 - Number(shade[8])] : [];

test('--tone 定義為 color-mix(in srgb, var(--c) N%, var(--leather))，且 --leather 有定義', () => {
  ok(/--leather\s*:\s*#[0-9a-f]{6}\s*;/i.test(css), '缺少 --leather 色票');
  ok(toneK !== null, '缺少 --tone 定義（格式不符）');
});
test('.book-card 背景是 var(--tone) 純色，疊兩個 --ground 色（rgba 27, 20, 17）半透明色標的 180deg 漸層', () => {
  ok(card, '找不到 .book-card 規則');
  ok(/background-color\s*:\s*var\(--tone\)\s*;/.test(card), '.book-card 要有 background-color: var(--tone)');
  ok(shade, '找不到 linear-gradient(180deg, rgba(...), rgba(...)) 深色疊層');
  ok(shadeIsGround, '疊層顏色要是 --ground（27, 20, 17），不可疊白色或其他顏色');
});
test('書卡上半部（書名，大字）白字對比 ≥ 3.0：全部書', () => {
  ok(stops.length === 2 && toneK !== null, '色標格式不符，無法計算');
  const bad = books.map((b) => [b.id, white(mix(tone(b.c), ground, stops[0]))]).filter(([, r]) => r < 3).map(([id, r]) => id + '=' + r.toFixed(2));
  ok(!bad.length, bad.length + ' 本不足：' + bad.slice(0, 8).join(', '));
});
test('書卡下半部（作者／類型，小字）白字對比 ≥ 4.5：全部書', () => {
  ok(stops.length === 2 && toneK !== null, '色標格式不符，無法計算');
  const bad = books.map((b) => [b.id, white(mix(tone(b.c), ground, stops[1]))]).filter(([, r]) => r < 4.5).map(([id, r]) => id + '=' + r.toFixed(2));
  ok(!bad.length, bad.length + ' 本不足：' + bad.slice(0, 8).join(', '));
});
test('小字不可用 opacity 降低對比（.bc-author／.bc-genre／.bc-num）', () => {
  for (const s of ['.bc-author', '.bc-genre', '.bc-num']) {
    const r = rule(s);
    ok(r, '找不到 ' + s + ' 規則');
    const o = r.match(/opacity\s*:\s*([\d.]+)/);
    ok(!o || Number(o[1]) >= 1, s + ' 仍有 opacity ' + (o && o[1]));
  }
});
test('.bc-num 在上半部是小字，要有深色底襯（background）', () => {
  const r = rule('.bc-num');
  ok(r && /background\s*:/.test(r), '.bc-num 缺少 background');
});
test('首頁 hero 有左右留白（.hero 規則的左右 padding 不可為 0）', () => {
  const r = rule('.hero');
  ok(r, '找不到 .hero 規則');
  const p = r.match(/padding\s*:\s*([^;]+);/);
  const inline = r.match(/padding-inline\s*:\s*([^;]+);/);
  const parts = p ? p[1].trim().split(/\s+/) : [];
  const side = inline ? inline[1].trim() : (parts.length >= 2 ? parts[1] : parts[0]);
  ok(side && !/^0(px)?$/.test(side), '.hero 左右 padding 為 ' + JSON.stringify(side));
});

console.log(failed ? `\n${failed} FAIL` : '\nALL PASS');
process.exit(failed ? 1 : 0);
