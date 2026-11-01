const orbitModes = [
  { label: 'Elliptic', x: [48, 36, 23], y: [31, 48, 54], rotation: [0, 0, 0] },
  { label: 'Triad', x: [46, 34, 21], y: [46, 34, 21], rotation: [0, 60, 120] },
  { label: 'Resonance', x: [54, 40, 24], y: [22, 35, 52], rotation: [28, -34, 62] },
];

const waveModes = ['Sine', 'Interference', 'Pulse'];
const waveX = [15, 39.5, 64, 88.5, 113];

const smoothPath = (points) => {
  const [first, ...rest] = points;
  let d = `M ${first[0].toFixed(1)} ${first[1].toFixed(1)}`;

  rest.forEach(([x, y], index) => {
    const previous = points[index];
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 2)];
    const dx = x - previous[0];
    const c1y = previous[1] + (y - before[1]) / 6;
    const c2y = y - (after[1] - previous[1]) / 6;
    d += ` C ${(previous[0] + dx / 3).toFixed(1)} ${c1y.toFixed(1)}, ${(x - dx / 3).toFixed(1)} ${c2y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  return d;
};

export default class ProjectSignal {
  constructor(control) {
    this.control = control;
    this.kind = control.dataset.signalKind;
    this.mode = 0;
    this.pointer = { x: 0.5, y: 0.5 };
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onActivate = this.onActivate.bind(this);

    control.addEventListener('pointermove', this.onPointerMove);
    control.addEventListener('pointerleave', this.onPointerLeave);
    control.addEventListener('click', this.onActivate);
    this.updateModeLabel();
    this.render();
  }

  onPointerMove(event) {
    const bounds = this.control.getBoundingClientRect();
    this.pointer = {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
    this.render();
  }

  onPointerLeave() {
    this.pointer = { x: 0.5, y: 0.5 };
    this.render();
  }

  onActivate() {
    const modes = this.kind === 'orbit' ? orbitModes : waveModes;
    this.mode = (this.mode + 1) % modes.length;
    this.updateModeLabel();
    this.render();
  }

  updateModeLabel() {
    const modes = this.kind === 'orbit' ? orbitModes : waveModes;
    const current = modes[this.mode].label;
    const next = modes[(this.mode + 1) % modes.length].label;
    const noun = this.kind === 'orbit' ? 'orbital formation' : 'wave shape';
    this.control.querySelector('[data-signal-mode]').textContent = current;
    this.control.setAttribute('aria-label', `${noun}: ${current}. Move pointer to adjust. Activate to switch to ${next}.`);
  }

  renderOrbit() {
    const formation = orbitModes[this.mode];
    const ellipses = this.control.querySelectorAll('[data-orbit]');
    const nodes = this.control.querySelectorAll('[data-orbit-node]');
    const xScale = 0.78 + this.pointer.x * 0.24;
    const yScale = 0.78 + this.pointer.y * 0.24;
    const phase = this.pointer.x * Math.PI * 2;

    ellipses.forEach((ellipse, index) => {
      ellipse.setAttribute('rx', (formation.x[index] * xScale).toFixed(1));
      ellipse.setAttribute('ry', (formation.y[index] * yScale).toFixed(1));
      const rotation = formation.rotation[index] + (this.pointer.x - 0.5) * 40;
      ellipse.setAttribute('transform', `rotate(${rotation} 64 64)`);
    });

    nodes.forEach((node, index) => {
      const angle = phase + (index * Math.PI * 2) / 3;
      const radiusX = formation.x[index] * xScale;
      const radiusY = formation.y[index] * yScale;
      const rotation = (formation.rotation[index] + (this.pointer.x - 0.5) * 40) * (Math.PI / 180);
      const localX = Math.cos(angle) * radiusX;
      const localY = Math.sin(angle) * radiusY;
      node.setAttribute('cx', (64 + localX * Math.cos(rotation) - localY * Math.sin(rotation)).toFixed(1));
      node.setAttribute('cy', (64 + localX * Math.sin(rotation) + localY * Math.cos(rotation)).toFixed(1));
    });
  }

  renderWave() {
    const mode = waveModes[this.mode].toLowerCase();
    const phase = this.pointer.x * Math.PI * 2;
    const amplitude = 8 + this.pointer.y * 24;
    const paths = this.control.querySelectorAll('[data-wave-path]');

    paths.forEach((path, track) => {
      const points = waveX.map((x, index) => {
        const t = index / (waveX.length - 1);
        const distance = t - this.pointer.x;
        let wave;

        if (mode === 'interference') {
          wave = (Math.sin(t * Math.PI * 2 + phase + track * 0.8) + Math.sin(t * Math.PI * 4 - phase)) * 0.5;
        } else if (mode === 'pulse') {
          wave = Math.exp(-((distance * 4.5) ** 2)) * (track === 1 ? -1 : 1);
        } else {
          wave = Math.sin(t * Math.PI * 2 + phase + track * 0.75);
        }

        return [x, 64 + wave * amplitude];
      });

      path.setAttribute('d', smoothPath(points));
    });

    const marker = this.control.querySelector('.project-header__signal-core');
    const position = this.pointer.x;
    const markerWave =
      mode === 'interference'
        ? (Math.sin(position * Math.PI * 2 + phase) + Math.sin(position * Math.PI * 4 - phase)) * 0.5
        : mode === 'pulse'
          ? 1
          : Math.sin(position * Math.PI * 2 + phase);
    const markerY = 64 + markerWave * amplitude;
    marker.setAttribute('cx', (15 + this.pointer.x * 98).toFixed(1));
    marker.setAttribute('cy', markerY.toFixed(1));
  }

  render() {
    if (this.kind === 'orbit') this.renderOrbit();
    else this.renderWave();
  }

  destroy() {
    this.control.removeEventListener('pointermove', this.onPointerMove);
    this.control.removeEventListener('pointerleave', this.onPointerLeave);
    this.control.removeEventListener('click', this.onActivate);
  }
}
