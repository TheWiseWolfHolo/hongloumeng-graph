/* 贾府世系。g 性别 m/f；grp 分组配色；x 不在人物库，不可点；
   sp 配偶，t: w 正妻 / c 妾 / l 情缘或外室；k 头上标字，不写就按 t 推。 */
export interface TreeNode { n: string; s: string; g: 'm' | 'f'; grp: string; x?: 1; t?: 'w' | 'c' | 'l'; k?: string; sp?: TreeNode[]; ch?: TreeNode[] }

export const TREE_NING: TreeNode = {
  n: '贾演',
  s: '宁国公',
  g: 'm',
  grp: 'ning',
  ch: [
    {
      n: '贾代化',
      s: '袭宁国公',
      g: 'm',
      grp: 'ning',
      ch: [
        { n: '贾敷', s: '八九岁上便死', g: 'm', grp: 'ning', x: 1 },
        {
          n: '贾敬',
          s: '修道炼丹',
          g: 'm',
          grp: 'ning',
          ch: [
            {
              n: '贾珍',
              s: '宁府族长',
              g: 'm',
              grp: 'ning',
              sp: [
                { n: '尤氏', s: '继室', t: 'w', g: 'f', grp: 'ning' },
                { n: '佩凤', s: '妾', t: 'c', g: 'f', grp: 'ning', x: 1 },
                { n: '偕鸳', s: '妾', t: 'c', g: 'f', grp: 'ning', x: 1 },
                { n: '文花', s: '妾', t: 'c', g: 'f', grp: 'ning', x: 1 }
              ],
              ch: [
                { n: '贾蓉', s: '', g: 'm', grp: 'ning', sp: [
                    { n: '秦可卿', s: '第十三回亡故', t: 'w', g: 'f', grp: 'ning' }
                  ] }
              ]
            },
            { n: '贾惜春', s: '出家', g: 'f', grp: 'ning' }
          ]
        }
      ]
    }
  ]
};

export const TREE_RONG: TreeNode = {
  n: '贾源',
  s: '荣国公',
  g: 'm',
  grp: 'rong',
  ch: [
    {
      n: '贾代善',
      s: '袭荣国公',
      g: 'm',
      grp: 'rong',
      sp: [
        { n: '贾母', s: '史氏', t: 'w', g: 'f', grp: 'rong' }
      ],
      ch: [
        {
          n: '贾赦',
          s: '袭一等将军',
          g: 'm',
          grp: 'rong',
          sp: [
            { n: '邢夫人', s: '继室', t: 'w', g: 'f', grp: 'rong' },
            { n: '嫣红', s: '八百两买来', t: 'c', g: 'f', grp: 'rong', x: 1 },
            { n: '翠云', s: '妾', t: 'c', g: 'f', grp: 'rong', x: 1 }
          ],
          ch: [
            {
              n: '贾琏',
              s: '同知',
              g: 'm',
              grp: 'rong',
              sp: [
                { n: '王熙凤', s: '正室', t: 'w', g: 'f', grp: 'rong' },
                { n: '平儿', s: '妾', t: 'c', g: 'f', grp: 'rong' },
                { n: '尤二姐', s: '偷娶', t: 'l', k: '外室', g: 'f', grp: 'oth' },
                { n: '秋桐', s: '贾赦所赏', t: 'c', g: 'f', grp: 'rong' }
              ],
              ch: [
                { n: '巧姐', s: '', g: 'f', grp: 'rong' }
              ]
            },
            { n: '贾迎春', s: '妾出', g: 'f', grp: 'rong', sp: [
                { n: '孙绍祖', s: '中山狼', t: 'w', g: 'm', grp: 'out' }
              ] },
            { n: '贾琮', s: '随邢夫人', g: 'm', grp: 'rong', x: 1 }
          ]
        },
        {
          n: '贾政',
          s: '工部员外郎',
          g: 'm',
          grp: 'rong',
          sp: [
            { n: '王夫人', s: '正室', t: 'w', g: 'f', grp: 'rong' },
            { n: '赵姨娘', s: '妾', t: 'c', g: 'f', grp: 'rong' },
            { n: '周姨娘', s: '妾', t: 'c', g: 'f', grp: 'rong' }
          ],
          ch: [
            {
              n: '贾珠',
              s: '早亡',
              g: 'm',
              grp: 'rong',
              sp: [
                { n: '李纨', s: '守寡', t: 'w', g: 'f', grp: 'rong' }
              ],
              ch: [
                { n: '贾兰', s: '', g: 'm', grp: 'rong' }
              ]
            },
            { n: '贾元春', s: '贤德妃', g: 'f', grp: 'rong', sp: [
                { n: '当今', s: '入宫', t: 'w', g: 'm', grp: 'out', x: 1 }
              ] },
            {
              n: '贾宝玉',
              s: '怡红公子',
              g: 'm',
              grp: 'rong',
              sp: [
                { n: '薛宝钗', s: '续书成婚', t: 'w', g: 'f', grp: 'xue' },
                { n: '林黛玉', s: '木石前盟', t: 'l', g: 'f', grp: 'lin' }
              ]
            },
            { n: '贾探春', s: '庶出', g: 'f', grp: 'rong' },
            { n: '贾环', s: '庶出', g: 'm', grp: 'rong' }
          ]
        },
        {
          n: '贾敏',
          s: '嫁林家',
          g: 'f',
          grp: 'lin',
          sp: [
            { n: '林如海', s: '巡盐御史', t: 'w', g: 'm', grp: 'lin' }
          ],
          ch: [
            { n: '林黛玉', s: '', g: 'f', grp: 'lin' }
          ]
        }
      ]
    }
  ]
};

/* 字辈：演、源从水，敬、赦、政、敏从文，珍、琏、珠、环从玉，蓉、兰、蔷从草 */
export const GENERATIONS = [
  {
    label: '水字辈',
    ch: '水',
    nth: '一世',
    note: '宁荣二公'
  },
  {
    label: '代字辈',
    ch: '代',
    nth: '二世',
    note: '袭爵一代'
  },
  {
    label: '文字辈',
    ch: '文',
    nth: '三世',
    note: '敬、赦、政、敏'
  },
  {
    label: '玉字辈',
    ch: '玉',
    nth: '四世',
    note: '珍、琏、珠、宝玉与四春'
  },
  {
    label: '草字辈',
    ch: '草',
    nth: '五世',
    note: '蓉、兰与巧姐'
  }
];

/* 族中旁支：书里提到名字、但说不清是哪一房所出的族人，按字辈列，注明出处。
   这些人大多只在吊丧、祭祖的名单里出现，不硬挂进上面的树。 */
export interface ClanMember { n: string; s: string; hui: number[] }
export const CLAN: { ch: string; label: string; ms: ClanMember[] }[] = [
  { ch: '代', label: '代字辈', ms: [
    { n: '贾代儒', s: '族中老儒，掌家塾；贾瑞的祖父', hui: [9, 12] }
  ] },
  { ch: '文', label: '文字辈', ms: [
    { n: '贾敕', s: '秦可卿丧事随代儒来吊', hui: [13] },
    { n: '贾效', s: '同上', hui: [13] },
    { n: '贾敦', s: '同上', hui: [13] }
  ] },
  { ch: '玉', label: '玉字辈', ms: [
    { n: '贾瑞', s: '代儒之孙，父母早亡；死于风月宝鉴', hui: [11, 12] },
    { n: '贾璜', s: '住东胡同，妻金氏即“璜大奶奶”，金荣是她侄儿', hui: [9, 10] },
    { n: '贾㻞', s: '宁府管事；母亲带妹妹喜鸾来贺寿', hui: [13, 63, 71] },
    { n: '贾琼', s: '母亲带妹妹四姐儿来贺寿', hui: [13, 29, 71] },
    { n: '贾珩', s: '宁府二等管事', hui: [13, 63] },
    { n: '贾珖', s: '宁府二等管事，贾敬死时领家丁去迎贾珍', hui: [13, 63] },
    { n: '贾璎', s: '宁府二等管事', hui: [63] },
    { n: '贾琛', s: '秦可卿丧事来吊', hui: [13] },
    { n: '贾璘', s: '同上', hui: [13] }
  ] },
  { ch: '草', label: '草字辈', ms: [
    { n: '贾蔷', s: '“宁府中之正派玄孙”，父母早亡，跟贾珍过活；管十二个女戏', hui: [9, 16, 18] },
    { n: '贾芸', s: '后廊上五嫂子的儿子，舅舅卜世仁；管大观园种树', hui: [24, 26] },
    { n: '贾芹', s: '后街周氏之子；管家庙铁槛寺的小沙弥、小道士', hui: [23] },
    { n: '贾菌', s: '“荣府近派的重孙”，母亲娄氏少寡；闹学堂时和贾兰同桌', hui: [9, 53] },
    { n: '贾菖', s: '大观园监工，祭宗祠时展拜垫', hui: [23, 53] },
    { n: '贾菱', s: '同上', hui: [23, 53] },
    { n: '贾萍', s: '大观园刻石监工', hui: [13, 23] },
    { n: '贾荇', s: '祭宗祠时在内仪门传菜', hui: [53] },
    { n: '贾芷', s: '同上', hui: [53] },
    { n: '贾蓁', s: '秦可卿丧事来吊', hui: [13] },
    { n: '贾藻', s: '同上', hui: [13] },
    { n: '贾蘅', s: '同上', hui: [13] },
    { n: '贾芬', s: '同上', hui: [13] },
    { n: '贾芳', s: '同上', hui: [13] },
    { n: '贾芝', s: '同上', hui: [13] },
    { n: '贾蓝', s: '家塾里和贾菌最好', hui: [9] }
  ] }
];
