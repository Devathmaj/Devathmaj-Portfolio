import vert from './shaders/vert.glsl';
import frag from './shaders/frag.glsl';
import createShader from './utils/createShader';

export default class FooterShader {
  constructor() {
    this.destroyed = false;
    this.frame = 0;
    this.canvas = null;
    this.gl = null;
    this.render = null;
    this.image = null;
    this.running = false;
    this.pausedAt = 0;
    this.pausedTotal = 0;
    this.events = null;
    this.observer = null;
    this.start();
  }

  /**
   * The footer image is already a lazy, responsive <img>. Reuse it as the
   * texture instead of downloading the full-size original a second time, and
   * wait until it is decoded so the first frame does not block on decode work.
   */
  async start() {
    const footer = document.querySelector('.footer-border');
    if (!footer || !footer.parentElement) return;
    this.image = footer;

    try {
      if (typeof footer.decode === 'function') await footer.decode();
      else {
        await new Promise((resolve) => {
          if (footer.complete && footer.naturalWidth) resolve();
          else {
            footer.addEventListener('load', resolve, { once: true });
            footer.addEventListener('error', resolve, { once: true });
          }
        });
      }
    } catch {
      return;
    }
    if (this.destroyed || !footer.isConnected || !footer.naturalWidth) return;

    const shaderProps = {
      WIND_SCALE: 3.0,
      WIND_SPEED: 0.2,
      WIND_AMPLITUDE_X: 0.001,
      WIND_AMPLITUDE_Y: 0.004,
      COLOR_SHIFT: 0.0,
      JITTER_INTENSITY: 0.001,
      DRIFT_SCALE: 5.0,
      DRIFT_INTENSITY: 0.001,
      VERTICAL_BIAS: 0.01,
    };

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const canvas = document.createElement('canvas');
    this.canvas = canvas;
    footer.parentElement.insertBefore(canvas, footer);

    const gl = canvas.getContext('webgl');

    if (!gl) {
      console.error('WebGL not supported');
      canvas.remove();
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    const vertexShaderSource = vert;

    const fragmentShaderSource = frag;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      canvas.remove();
      throw new Error('Failed to link program');
    }

    const positionBuffer = gl.createBuffer();
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      footer
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    const startTime = performance.now();

    // Resolve program locations once. Looking them up every frame re-runs
    // shader reflection on the main thread and was a measurable cost.
    const uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      windScale: gl.getUniformLocation(program, 'WIND_SCALE'),
      windSpeed: gl.getUniformLocation(program, 'WIND_SPEED'),
      windAmplitude: gl.getUniformLocation(program, 'WIND_AMPLITUDE'),
      colorShift: gl.getUniformLocation(program, 'COLOR_SHIFT'),
      jitter: gl.getUniformLocation(program, 'JITTER_INTENSITY'),
      driftScale: gl.getUniformLocation(program, 'DRIFT_SCALE'),
      driftIntensity: gl.getUniformLocation(program, 'DRIFT_INTENSITY'),
      verticalBias: gl.getUniformLocation(program, 'VERTICAL_BIAS'),
    };

    gl.useProgram(program);

    gl.uniform1f(uniforms.windScale, shaderProps.WIND_SCALE);
    gl.uniform1f(uniforms.windSpeed, shaderProps.WIND_SPEED);
    gl.uniform2f(
      uniforms.windAmplitude,
      shaderProps.WIND_AMPLITUDE_X,
      shaderProps.WIND_AMPLITUDE_Y
    );
    gl.uniform1f(uniforms.colorShift, shaderProps.COLOR_SHIFT);
    gl.uniform1f(uniforms.jitter, shaderProps.JITTER_INTENSITY);
    gl.uniform1f(uniforms.driftScale, shaderProps.DRIFT_SCALE);
    gl.uniform1f(uniforms.driftIntensity, shaderProps.DRIFT_INTENSITY);
    gl.uniform1f(uniforms.verticalBias, shaderProps.VERTICAL_BIAS);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    const aspect = footer.naturalHeight / footer.naturalWidth;
    // This effect is a slow, low-frequency distortion, so rendering above the
    // device pixel ratio adds no visible detail. The old fixed 3x scale drew
    // roughly nine times as many fragments as a 1x display needs, which made
    // this the most expensive thing on the page.
    const MAX_DPR = 2;
    const MAX_WIDTH = 3000;
    let cssWidth = canvas.clientWidth;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const displayWidth = Math.min(MAX_WIDTH, Math.round(cssWidth * dpr));
      if (!displayWidth || canvas.width === displayWidth) return;
      canvas.width = displayWidth;
      canvas.height = Math.round(displayWidth * aspect);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };

    // Reading clientWidth/clientHeight from the render loop forced a style and
    // layout recalculation on every animation frame. ResizeObserver delivers
    // the width without a synchronous layout read.
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        const width = entry?.contentRect?.width;
        if (!width) return;
        cssWidth = width;
        resize();
        // Resizing the backing store clears it; repaint once so a paused
        // canvas never flashes empty when the window changes size.
        if (!this.running && !prefersReducedMotion) {
          this.render?.(performance.now());
        }
      });
      this.resizeObserver.observe(canvas);
    }
    resize();

    const render = (currentTime) => {
      if (this.destroyed) return;
      this.frame = 0;

      gl.uniform1f(
        uniforms.time,
        (currentTime - startTime - this.pausedTotal) / 1000,
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (this.running) this.frame = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (this.destroyed || this.running || prefersReducedMotion) return;
      if (this.pausedAt) {
        this.pausedTotal += performance.now() - this.pausedAt;
        this.pausedAt = 0;
      }
      this.running = true;
      if (!this.frame) this.frame = requestAnimationFrame(render);
    };

    const stopLoop = () => {
      if (!this.running) return;
      this.running = false;
      this.pausedAt = performance.now();
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    };

    this.render = render;

    // Paint one frame right away so the footer is identical to the static
    // image before the observer has fired.
    render(startTime);

    if (!prefersReducedMotion) {
      this.events = new AbortController();

      // The loop used to redraw this multi-megapixel canvas every frame for
      // as long as the homepage was open, even with the footer thousands of
      // pixels off screen. That kept the GPU busy and made the rest of the
      // site stutter. Only animate while the canvas is near the viewport and
      // the tab is visible; the last frame stays on screen otherwise.
      if (typeof IntersectionObserver === 'function') {
        this.observer = new IntersectionObserver(
          (entries) => {
            const isVisible = entries.some((entry) => entry.isIntersecting);
            if (isVisible && !document.hidden) startLoop();
            else stopLoop();
          },
          { rootMargin: '400px 0px' },
        );
        this.observer.observe(canvas);
      } else {
        startLoop();
      }

      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.hidden) {
            stopLoop();
            return;
          }
          // IntersectionObserver does not re-fire on tab switches, so check
          // the canvas position once when the tab becomes visible again.
          const rect = canvas.getBoundingClientRect();
          if (
            !this.observer ||
            (rect.bottom > -400 && rect.top < window.innerHeight + 400)
          ) {
            startLoop();
          }
        },
        { signal: this.events.signal },
      );

      // A zoom change alters the device pixel ratio without changing the CSS
      // width, so ResizeObserver alone would leave the old backing store.
      window.addEventListener(
        'resize',
        () => {
          cssWidth = canvas.clientWidth;
          resize();
          if (!this.running) this.render?.(performance.now());
        },
        { signal: this.events.signal },
      );
    }
  }

  destroy() {
    this.destroyed = true;
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.observer?.disconnect();
    this.observer = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.events?.abort();
    this.events = null;
    // Free the drawing buffer, texture and program now instead of waiting for
    // the context to be garbage collected. Without this, each homepage visit
    // could strand another multi-megapixel WebGL buffer in GPU memory.
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
    this.canvas?.remove();
    this.canvas = null;
    this.render = null;
    this.image = null;
  }
}
