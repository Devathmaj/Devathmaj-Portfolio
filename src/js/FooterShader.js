import vert from './shaders/vert.glsl';
import frag from './shaders/frag.glsl';
import createShader from './utils/createShader';

export default class FooterShader {
  constructor() {
    this.destroyed = false;
    this.frame = 0;
    this.canvas = null;
    this.render = null;
    this.image = null;
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
    const resize = (cssWidth) => {
      const displayWidth = Math.round(cssWidth * 3);
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
        if (width) resize(width);
      });
      this.resizeObserver.observe(canvas);
    }
    resize(canvas.clientWidth);

    const render = (currentTime) => {
      if (this.destroyed) return;

      gl.uniform1f(uniforms.time, (currentTime - startTime) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!prefersReducedMotion) this.frame = requestAnimationFrame(render);
    };

    this.render = render;
    if (prefersReducedMotion) render(startTime);
    else this.frame = requestAnimationFrame(render);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.canvas?.remove();
    this.canvas = null;
    this.render = null;
    this.image = null;
  }
}
