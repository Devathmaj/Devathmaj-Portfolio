export default [
  {
    company: 'Kannur Vision — Distribution Management System',
    name: 'Kannur Vision',
    system: 'Distribution Management System',
    slug: 'kannur-vision',
    titleSplitIndex: 13,
    titleDivider: '—',
    titleDividerLength: 3,
    role: 'Freelance Full-Stack Developer',
    period: 'Apr 2026 – Aug 2026',
    location: 'Kerala, India',
    visual: {
      kind: 'distribution',
      roleCount: 8,
      caption: 'A place for every device. A record of every handover.',
      stages: ['Role-based access', 'Distribution & returns', 'Inventory & audit logs'],
    },
    summary:
      'Full-stack platform for managing device distribution, defects, returns and inventory across hierarchical organizational roles.',
    scope:
      'Device distribution, defects, returns and inventory across a hierarchical organization.',
    constraints:
      'Untracked inventory caused device loss; workflows had to stay audit-ready across eight hierarchical roles.',
    decisions:
      'Real-time distribution and returns tracking, complete audit logging, an RBAC matrix of 55+ entries and an idempotent migration system.',
    outcomes: [
      { value: '8 roles', label: 'Audit-ready workflows' },
      { value: '21 tables', label: 'Seven entity domains' },
      { value: '55+', label: 'Permission entries' },
      { value: 'Real time', label: 'Distribution and returns' },
    ],
    build: {
      lead:
        'I built the system end to end: the data model, the approval workflows and the role-scoped interface that keeps every handover accountable.',
      items: [
        {
          title: 'Device registry and history',
          text:
            'Every device is registered with a serial number and tracks its status, location and current holder. Each movement is written to a device history, so the full chain from registration to return stays auditable. Devices and users can also be bulk-imported from CSV, XLSX or XLS.',
        },
        {
          title: 'Distribution lifecycle',
          text:
            'Distribution requests move through a structured approval chain of pending, approved, delivered or rejected, with approver notes attached at each decision. The same lifecycle view shows where a request stands from any role-scoped dashboard.',
        },
        {
          title: 'Defects and returns',
          text:
            'Defects are reported by type and severity and resolved through a history-tracked workflow. Returns are raised with reason categories and approved through the same chain and both sit beside distributions in a single approval queue.',
        },
        {
          title: 'Hierarchical roles',
          text:
            'Access is governed by a hierarchy of eight roles, from system administration through field operations. Each role gets its own dashboard and route access and a permission matrix of more than 55 entries keeps those boundaries explicit rather than implied.',
        },
        {
          title: 'Operational visibility',
          text:
            'Role-specific dashboards show live statistics, activity feeds, charts and system alerts. Notifications carry an unread badge and mark-as-read state and reports cover inventory, distribution, defects, returns, user activity and device utilisation.',
        },
        {
          title: 'Data model and migrations',
          text:
            'The schema spans seven entity domains across 21 MySQL tables. An idempotent migration system keeps environments in sync without manual steps, so the data model can move forward safely as the system grows.',
        },
        {
          title: 'Monitoring',
          text:
            'Prometheus scrapes the backend metrics endpoint every ten seconds while SQLAlchemy engine events record query volume, latency, failures and active connections. Grafana provisions Backend API and Database dashboards on startup.',
        },
      ],
    },
    notes: {
      role: 'Freelance engagement',
      scope: 'Full-stack design and architecture',
      constraints: 'Eight hierarchical roles',
      decisions: 'Audit logging and RBAC',
      outcomes: 'Measured against the resume record',
      stack: 'Full-stack build',
    },
    stack: [
      { name: 'React', icon: 'react' },
      { name: 'FastAPI', icon: 'fastapi' },
      { name: 'Python', icon: 'python' },
      { name: 'MySQL', icon: 'mysql' },
      { name: 'Docker', icon: 'docker' },
      { name: 'JWT', icon: 'jwt' },
      { name: 'RBAC', icon: 'shield-check' },
      { name: 'Prometheus', icon: 'prometheus' },
      { name: 'Grafana', icon: 'grafana' },
      { name: 'Nginx', icon: 'nginx' },
      { name: 'Linux', icon: 'linux' },
    ],
  },
  {
    company: 'Kerala Vision Broadband Limited',
    name: 'Kerala Vision Broadband Limited',
    system: 'Network backup management platform',
    slug: 'kerala-vision-broadband-limited',
    titleSplitIndex: 13,
    role: 'DevOps Intern',
    period: 'May 2025 – Jun 2025',
    location: 'Kerala, India',
    visual: {
      kind: 'backup',
      caption: 'From controlled access to an automated archive.',
      stages: ['SSH jump host', 'Scheduled backups', 'Archival & alerts'],
    },
    summary:
      'Internal network backup management platform that automates device log backups, backup scheduling, config management and log comparison.',
    scope:
      'Network backup management across device logs, schedules, configuration and comparison.',
    constraints:
      'Device access had to be controlled and auditable; backups had to run without manual intervention.',
    decisions:
      'SSH jump-host architecture, RBAC and JWT authentication, Netmiko automation and rclone archival to Google Drive.',
    outcomes: [
      { value: '80%', label: 'Less manual administration' },
      { value: 'SSH', label: 'Jump-host access control' },
      { value: 'Google Drive', label: 'Automated log archival' },
      { value: 'WhatsApp', label: 'Success and failure alerts' },
    ],
    build: {
      lead:
        'I designed and built the platform end to end: the React interface, the FastAPI services and the automation that keeps device configurations archived.',
      items: [
        {
          title: 'Multi-unit operations',
          text:
            'The platform is organised around operational units, so devices, users, backups and logs stay scoped to a location. Users assigned to several units switch context from the navigation bar and every request carries the selected unit so data never crosses a boundary. Head Admins see the whole estate; Admins and Users see only their assigned units.',
        },
        {
          title: 'Access control and encrypted credentials',
          text:
            'Three tiers — User, Admin and Head Admin — separate viewing, operations and system administration. Authentication uses JWTs and bcrypt-hashed passwords, while SSH usernames, passwords and enable secrets are stored with Fernet symmetric encryption instead of plain text.',
        },
        {
          title: 'Device inventory and reachability',
          text:
            'Devices are registered with a hostname, SSH port and type and custom device types carry their own command templates. On-demand or scheduled ping checks update reachability and a mass ping tests the whole estate in a single pass behind a controlled SSH jump host.',
        },
        {
          title: 'Scheduled backups to Google Drive',
          text:
            'Backups run daily, weekly or monthly at a chosen time or on demand for everything or a selected unit. Netmiko connects over SSH to pull each configuration and rclone archives the files to Google Drive through a service account. Each run records its status, message and last successful timestamp alongside historical daily and monthly trends.',
        },
        {
          title: 'Configuration comparison',
          text:
            'A side-by-side diff viewer compares any two archived configurations and highlights additions, deletions and changes. Historical versions can be compared for audit and troubleshooting and individual files or whole ZIP archives can be downloaded directly from Drive.',
        },
        {
          title: 'Alerts and audit trail',
          text:
            'Failed connectivity checks and backup runs trigger WhatsApp alerts to numbers with configurable preferences, whether device, backup or both. A filterable activity log records device, backup, login and administrative events, giving administrators a complete trail of who did what and when.',
        },
        {
          title: 'Operational interface',
          text:
            'The React interface supports dark and light themes, compact and simple view modes and a collapsible sidebar. The same dashboards stay usable on a laptop or a wall display without losing the data-dense layout.',
        },
      ],
    },
    notes: {
      role: 'Internship',
      scope: 'Network operations automation',
      constraints: 'Controlled device access',
      decisions: 'SSH jump-host access control',
      outcomes: 'Measured against the resume record',
      stack: 'Deployed on Linux servers',
    },
    stack: [
      { name: 'React', icon: 'react' },
      { name: 'FastAPI', icon: 'fastapi' },
      { name: 'Python', icon: 'python' },
      { name: 'MongoDB', icon: 'mongodb' },
      { name: 'Docker', icon: 'docker' },
      { name: 'Netmiko', icon: 'network' },
      { name: 'Rclone', icon: 'rclone' },
      { name: 'SSH', icon: 'ssh' },
      { name: 'JWT', icon: 'jwt' },
      { name: 'RBAC', icon: 'shield-check' },
      { name: 'REST APIs', icon: 'openapi' },
      { name: 'Linux', icon: 'linux' },
    ],
  },
];
