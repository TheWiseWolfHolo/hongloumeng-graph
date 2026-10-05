/* 人物搜索共用同一份别称表。别称只帮助查找，不代替原书姓名。 */
const PERSON_ALIASES = {
  贾宝玉: ['宝玉', '宝二爷', '宝二哥', '怡红公子', '绛洞花主'],
  林黛玉: ['黛玉', '林妹妹', '林姑娘', '颦儿', '潇湘妃子'],
  薛宝钗: ['宝钗', '宝姐姐', '宝姑娘', '蘅芜君'],
  王熙凤: ['凤姐', '凤姐儿', '凤辣子', '琏二奶奶', '凤丫头'],
  贾母: ['老太太', '老祖宗', '史太君'],
  王夫人: ['王太太'], 邢夫人: ['邢太太'], 贾琏: ['琏二爷'],
  贾探春: ['探春', '三姑娘', '蕉下客'], 贾迎春: ['迎春', '二姑娘', '二木头'],
  贾惜春: ['惜春', '四姑娘', '藕榭'], 贾元春: ['元春', '元妃', '贤德妃'],
  史湘云: ['湘云', '云妹妹', '枕霞旧友'], 李纨: ['李宫裁', '宫裁', '稻香老农'],
  香菱: ['甄英莲', '英莲', '秋菱'], 小红: ['林红玉', '红玉'],
  袭人: ['花袭人', '珍珠'], 金钏儿: ['金钏'], 玉钏儿: ['玉钏'],
  秦可卿: ['可卿', '蓉大奶奶'], 刘姥姥: ['刘老老'],
  茫茫大士: ['癞头和尚'], 渺渺真人: ['跛足道人']
};

const Catalog = (() => {
  const people = NODES.map(([id, grp, kind, tag, sub, bio, fate]) => ({ id, grp, kind, tag, sub, bio, fate, aliases: PERSON_ALIASES[id] || [] }));
  const relations = EDGES.map(([a, b, type, label, note = '']) => ({ a, b, type, label, note }));
  const normalize = s => String(s || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  const rank = { c: 0, m: 1, o: 2, s: 3 };
  const index = new Map(people.map(p => [p.id, {
    name: normalize(p.id), aliases: p.aliases.map(normalize),
    detail: normalize(p.sub + p.bio)
  }]));
  function search(value, limit = Infinity) {
    const q = normalize(value);
    if (!q) return people.slice(0, limit);
    return people.map(person => {
      const p = index.get(person.id);
      const score = p.name === q ? 0 : p.aliases.includes(q) ? 1 : p.name.includes(q) ? 2
        : p.aliases.some(a => a.includes(q)) ? 3 : p.detail.includes(q) ? 4 : Infinity;
      return { person, score };
    }).filter(x => Number.isFinite(x.score))
      .sort((a, b) => a.score - b.score || rank[a.person.kind] - rank[b.person.kind])
      .slice(0, limit).map(x => x.person);
  }
  return { people, relations, search };
})();
