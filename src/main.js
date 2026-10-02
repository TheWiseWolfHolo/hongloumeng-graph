/* ============ 启动 ============ */
(function boot() {
  $('#stPeople').textContent = PEOPLE.length;
  $('#stRel').textContent = REL.length;
  $('#stEv').textContent = EVENTS.length;
  /* 页面上所有带 data-pick 的按钮都走同一个入口 */
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pick]');
    if (b) pickPerson(b.dataset.pick);
  });
  Theme.init();
  Drawer.init();
  Tabs.init();
})();
