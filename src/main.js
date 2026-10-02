/* ============ 启动 ============ */
(function boot() {
  $('#stPeople').textContent = PEOPLE.length;
  $('#stRel').textContent = REL.length;
  $('#stEv').textContent = EVENTS.length;
  /* 页面上所有带 data-pick 的按钮都走同一个入口；卡片外再点一次正在看的那个人，就收起卡片 */
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pick]');
    if (!b) return;
    if (Drawer.cur === b.dataset.pick && !b.closest('#drawer')) Tabs.closeDrawerAndClear();
    else pickPerson(b.dataset.pick);
  });
  Theme.init();
  Drawer.init();
  Tabs.init();
})();
