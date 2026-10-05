import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { strict as assert } from 'node:assert';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = ['data-people.js', 'data-extra.js', 'data-events.js', 'catalog.js']
  .map(name => readFileSync(resolve(root, 'src', name), 'utf8')).join('\n');
const data = vm.runInNewContext(source + '\n({ NODES, EDGES, EVENTS, GARDEN, TWELVE, TWELVE_MORE, GROUPS, TYPES, PERSON_ALIASES, Catalog })');
const ids = new Set(data.NODES.map(n => n[0]));
assert.equal(ids.size, data.NODES.length, '人物姓名不能重复');
for (const [id, group] of data.NODES) assert.ok(data.GROUPS[group], `${id}的分组不存在`);
for (const [a, b, type, label] of data.EDGES) {
  assert.ok(ids.has(a) && ids.has(b), `关系端点不存在 ${a} / ${b}`);
  assert.ok(data.TYPES[type], `关系类型不存在 ${type}`);
  assert.ok(label, '关系称谓不能为空');
}
const eventTitles = new Set(data.EVENTS.map(e => e.t));
assert.equal(eventTitles.size, data.EVENTS.length, '事件标题不能重复');
for (const event of data.EVENTS) {
  assert.ok(event.c.length >= 1 && event.c.every(n => Number.isInteger(n) && n >= 1 && n <= 120), `回目无效 ${event.t}`);
  for (const id of event.ids) assert.ok(ids.has(id), `事件人物不存在 ${id}`);
}
for (const place of data.GARDEN) {
  for (const id of place.who || []) assert.ok(ids.has(id), `园中人物不存在 ${id}`);
  for (const title of place.ev || []) assert.ok(eventTitles.has(title), `园中事件不存在 ${title}`);
}
for (const verse of [...data.TWELVE, ...data.TWELVE_MORE]) for (const id of verse.ids) assert.ok(ids.has(id), `判词人物不存在 ${id}`);
for (const id of Object.keys(data.PERSON_ALIASES)) assert.ok(ids.has(id), `别称指向不存在的人物 ${id}`);
for (const [term, expected] of [['宝二爷', '贾宝玉'], [' 林 妹 妹 ', '林黛玉'], ['凤姐', '王熙凤'], ['英莲', '香菱'], ['金钏', '金钏儿'], ['林黛玉', '林黛玉']]) {
  assert.equal(data.Catalog.search(term)[0]?.id, expected, `搜索未命中 ${term}`);
}
assert.equal(data.Catalog.search('不存在的人物xyz').length, 0);
assert.equal(data.Catalog.search('<script>alert(1)</script>').length, 0);
assert.equal(data.Catalog.search('贾', 3).length, 3);
assert.equal(data.Catalog.search('').length, data.NODES.length);
console.log(`数据检查通过，${ids.size} 个人物与信物，${data.EDGES.length} 条关系，${data.EVENTS.length} 件大事；别称搜索通过。`);
