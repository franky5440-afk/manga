// check_pages.mjs — 無瀏覽器渲染冒烟測試（僅本機執行）：
/// 用 node:vm 載入 ranking.js / app.js，stub 最小 DOM + fetch，檢查各頁 render。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rankingSrc = fs.readFileSync(path.join(root, 'assets/js/ranking.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeEls() {
  const els = {};
  const ids = ['dateBadge', 'heroDate', 'shelf', 'rankList', 'fixedList', 'detail',
    'chList', 'chapter', 'chNav', 'crumbTitle', 'crumbCh', 'crumbHome', 'crumbBook'];
  for (const id of ids) els[id] = { textContent: '', innerHTML: '', href: '' };
  return els;
}

async function runCase(name, page, search, check) {
  const els = makeEls();
  const sandbox = {
    console,
    URLSearchParams,
    document: {
      body: { getAttribute: () => page, setAttribute: () => {} },
      getElementById: (id) => els[id] || null,
      querySelectorAll: () => [],
      title: '',
    },
    location: { search, pathname: '/' + page + '.html' },
    fetch: (url) => {
      const p = path.join(root, url);
      return Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(p, 'utf8'))) });
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(rankingSrc + '\n' + appSrc, sandbox);
  await sleep(50);
  check(els);
  console.log('PASS', name);
}

const count = (html, tag) => (html.match(new RegExp('<' + tag, 'g')) || []).length;

await runCase('timeless 列出 18 本', 'timeless', '', (els) => {
  if (count(els.fixedList.innerHTML, 'li') !== 18) throw new Error('fixedList 筆數=' + count(els.fixedList.innerHTML, 'li'));
  if (!els.fixedList.innerHTML.includes('src=classics')) throw new Error('缺少 src=classics 連結');
  if (!els.dateBadge.textContent.includes('18')) throw new Error('badge 未顯示 18 本：' + els.dateBadge.textContent);
});
await runCase('index 維持 10 本', 'index', '', (els) => {
  if (count(els.rankList.innerHTML, 'li') !== 10) throw new Error('rankList 筆數=' + count(els.rankList.innerHTML, 'li'));
});
await runCase('manga 無 src 讀不到 classics 書', 'manga', '?id=berserk', (els) => {
  if (!els.detail.innerHTML.includes('找不到這本漫畫')) throw new Error('預期友善錯誤');
});
await runCase('manga classics 詳情', 'manga', '?id=berserk&src=classics', (els) => {
  if (!els.detail.innerHTML.includes('固定收藏第 2 名')) throw new Error('缺少固定名次：' + els.detail.innerHTML.slice(0, 120));
  if (!els.chList.innerHTML.includes('src=classics')) throw new Error('章節連結未帶 src');
});
await runCase('chapter classics 導覽', 'chapter', '?id=kingdom&src=classics&ch=886', (els) => {
  if (!els.chNav.innerHTML.includes('src=classics')) throw new Error('上下話未帶 src');
  if (!els.chapter.innerHTML.includes('支持正版')) throw new Error('缺少正版聲明');
});
await runCase('chapter 末話下一話置灰', 'chapter', '?id=nana&src=classics&ch=84', (els) => {
  if (!els.chNav.innerHTML.includes('btn off')) throw new Error('末話應置灰');
});
await runCase('無效 id/ch 友善錯誤', 'chapter', '?id=nope&ch=999', (els) => {
  if (!els.chapter.innerHTML.includes('找不到')) throw new Error('預期友善錯誤');
});
console.log('ALL PASS');
