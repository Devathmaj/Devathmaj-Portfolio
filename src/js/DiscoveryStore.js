export const DISCOVERY_KEY = 'portfolio:hidden-routes:v1';
export const HIDDEN_ROUTES = Object.freeze([
  { id: 'now', path: '/now', label: 'Now' },
  { id: 'links', path: '/links', label: 'Links' },
]);

export const routeDiscoveryId = (pathname) => {
  const path = pathname.replace(/\/+$/, '') || '/';
  return HIDDEN_ROUTES.find((route) => route.path === path)?.id;
};

export function parseDiscoveries(raw) {
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    return HIDDEN_ROUTES.filter(({ id }) => value.includes(id)).map(({ id }) => id);
  } catch {
    return null;
  }
}

// One application-lifetime store, shared by the persistent shell and Taxi views.
export class DiscoveryStore {
  constructor(browser = window) {
    this.browser = browser;
    this.listeners = new Set();
    this.notices = [];
    this.routes = this.read() ?? [];
    this.onStorage = (event) => {
      if (event.key !== DISCOVERY_KEY && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== browser.localStorage) return;
      } catch { return; }
      // Read the latest value: queued events may describe an older write.
      const saved = this.read();
      if (!saved) return;
      if (!saved.length) {
        this.notices = [];
        this.setRoutes([]);
        return;
      }
      const merged = this.merge(saved, this.routes);
      // Repair only a competing, incomplete write in browsers without Web Locks.
      if (merged.length > saved.length) this.persist(merged);
      this.setRoutes(merged);
    };
    this.onPageShow = () => {
      const saved = this.read();
      if (saved) this.setRoutes(saved);
    };
    browser.addEventListener('storage', this.onStorage);
    browser.addEventListener('pageshow', this.onPageShow);
  }

  read() {
    if (this.storageUnavailable) return null;
    try {
      const raw = this.browser.localStorage.getItem(DISCOVERY_KEY);
      return raw === null ? [] : parseDiscoveries(raw);
    } catch {
      this.storageUnavailable = true;
      return null;
    }
  }

  persist(routes) {
    try {
      this.browser.localStorage.setItem(DISCOVERY_KEY, JSON.stringify(routes));
    } catch {
      // The same store continues to work in memory if storage is blocked/full.
      this.storageUnavailable = true;
    }
  }

  merge(...lists) {
    return HIDDEN_ROUTES.filter(({ id }) => lists.some((list) => list.includes(id)))
      .map(({ id }) => id);
  }

  get discoveredRoutes() { return [...this.routes]; }
  get discoveredCount() { return this.routes.length; }
  get discoveryNotice() { return this.notices[0] ?? null; }
  isDiscovered(id) { return this.routes.includes(id); }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this);
    return () => this.listeners.delete(listener);
  }

  emit() { this.listeners.forEach((listener) => listener(this)); }

  setRoutes(routes) {
    if (JSON.stringify(routes) === JSON.stringify(this.routes)) return;
    this.routes = routes;
    this.emit();
  }

  discoverRoute(id) {
    if (!HIDDEN_ROUTES.some((route) => route.id === id)) return Promise.resolve(false);
    const register = () => {
      const routes = this.merge(this.routes, this.read() ?? []);
      if (routes.includes(id)) {
        this.setRoutes(routes);
        return false;
      }
      const next = this.merge(routes, [id]);
      this.persist(next);
      this.notices.push({ id, count: next.length });
      this.setRoutes(next);
      return true;
    };
    // Serialize registrations across tabs, including simultaneous first visits.
    const locks = this.browser.navigator?.locks;
    if (locks) return locks.request(DISCOVERY_KEY, register).catch(() => register());
    return Promise.resolve(register());
  }

  trackPathname(pathname = this.browser.location.pathname) {
    return this.discoverRoute(routeDiscoveryId(pathname));
  }

  dismissDiscoveryNotice() {
    if (!this.notices.length) return;
    this.notices.shift();
    this.emit();
  }

  destroy() {
    this.browser.removeEventListener('storage', this.onStorage);
    this.browser.removeEventListener('pageshow', this.onPageShow);
    this.listeners.clear();
  }
}
