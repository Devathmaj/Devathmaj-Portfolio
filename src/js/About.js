const initLayers = (root) => {
  const tablist = root.querySelector('[data-layer-tabs]');
  const tabs = [...root.querySelectorAll('[data-layer-tab]')];
  const panels = [...root.querySelectorAll('[data-layer-panel]')];
  const drawing = root.querySelector('[data-active-layer]');
  if (!tablist || !tabs.length || !drawing) return;

  tablist.setAttribute('role', 'tablist');
  tablist.hidden = false;
  const select = (index, focus = false) => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    drawing.dataset.activeLayer = String(index);
    if (focus) tabs[index].focus();
  };

  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].tabIndex = 0;
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next, true);
    });
  });
  select(0);
  root.querySelector('[data-layer-hint]').hidden = false;
};

const initToolkit = (root) => {
  root.querySelectorAll('.about-toolkit__group').forEach((group) => {
    const map = group.querySelector('[data-tool-map]');
    const tabs = [...group.querySelectorAll('[data-tool-tab]')];
    const notes = [...group.querySelectorAll('[data-tool-note]')];
    if (!map || !tabs.length || tabs.length !== notes.length) return;

    const select = (index, focus = false) => {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        notes[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
    };

    map.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab');
      notes[index].setAttribute('role', 'tabpanel');
      notes[index].setAttribute('aria-labelledby', tab.id);
      notes[index].tabIndex = 0;
      tab.addEventListener('click', () => select(index));
      tab.addEventListener('keydown', (event) => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    select(0);
    map.hidden = false;
    group.classList.add('is-interactive');
  });
};

export default function initAbout() {
  // Taxi can re-enter a cached page; each DOM instance is enhanced only once.
  document.querySelectorAll('.about-page').forEach((root) => {
    if (root.dataset.aboutReady) return;
    root.dataset.aboutReady = 'true';
    initLayers(root);
    initToolkit(root);
  });
}
