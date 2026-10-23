/* 园图里的细雪。启停由季节决定，可见性与尺寸由模块维护。 */
interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  sway: number;
  frequency: number;
  phase: number;
  tone: number;
}

interface SnowLayer {
  areaPerFlake: number;
  limit: number;
  radius: [number, number];
  speed: [number, number];
  sway: [number, number];
  wind: number;
  opacity: [number, number, number];
  color: string;
  soft: boolean;
  flakes: Snowflake[];
}

export function createGardenSnow(canvas: HTMLCanvasElement, container: HTMLElement, reducedMotion: boolean) {
  const context = canvas.getContext('2d')!;
  canvas.style.pointerEvents = 'none';
  const layers: SnowLayer[] = [
    { areaPerFlake: 1900, limit: 240, radius: [.3, .7], speed: [7, 13], sway: [2, 5], wind: .22, opacity: [.17, .25, .32], color: '#edf2f2', soft: false, flakes: [] },
    { areaPerFlake: 6700, limit: 88, radius: [.55, 1.05], speed: [14, 23], sway: [4, 9], wind: .5, opacity: [.28, .39, .5], color: '#f8faf8', soft: false, flakes: [] },
    { areaPerFlake: 24000, limit: 18, radius: [.95, 1.65], speed: [24, 37], sway: [7, 14], wind: .8, opacity: [.46, .58, .7], color: '#ffffff', soft: true, flakes: [] }
  ];

  /* 近景的柔光只画一次。每帧复用这张小纹理，不逐粒做阴影或模糊。 */
  const glow = document.createElement('canvas');
  glow.width = glow.height = 32;
  const glowContext = glow.getContext('2d')!;
  const light = glowContext.createRadialGradient(16, 16, 0, 16, 16, 16);
  light.addColorStop(0, 'rgba(255,255,251,.96)');
  light.addColorStop(.22, 'rgba(255,255,251,.82)');
  light.addColorStop(.42, 'rgba(247,250,251,.24)');
  light.addColorStop(.68, 'rgba(151,171,183,.08)');
  light.addColorStop(1, 'rgba(151,171,183,0)');
  glowContext.fillStyle = light;
  glowContext.fillRect(0, 0, 32, 32);

  let width = 0, height = 0, density = 1;
  let requested = false, visible = false;
  let frame = 0, previousTime = 0, elapsed = 0;
  const random = (a: number, b: number) => a + Math.random() * (b - a);
  const makeFlake = (layer: SnowLayer): Snowflake => ({
    x: random(-20, width + 20),
    y: random(-12, height + 12),
    radius: random(...layer.radius),
    speed: random(...layer.speed),
    sway: random(...layer.sway),
    frequency: random(.38, .78),
    phase: random(0, Math.PI * 2),
    tone: Math.floor(Math.random() * 3)
  });

  function fit() {
    const bounds = container.getBoundingClientRect();
    const nextWidth = bounds.width, nextHeight = bounds.height;
    const nextDensity = Math.min(2, devicePixelRatio || 1);
    if (nextWidth === width && nextHeight === height && nextDensity === density) return;
    const oldWidth = width, oldHeight = height;
    width = nextWidth;
    height = nextHeight;
    density = nextDensity;
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);

    for (const layer of layers) {
      if (oldWidth && oldHeight) {
        for (const flake of layer.flakes) {
          flake.x *= width / oldWidth;
          flake.y *= height / oldHeight;
        }
      }
      const count = reducedMotion && layer.soft ? 0 : Math.min(layer.limit, Math.round(width * height / layer.areaPerFlake * (reducedMotion ? .2 : 1)));
      if (layer.flakes.length > count) layer.flakes.length = count;
      while (layer.flakes.length < count) layer.flakes.push(makeFlake(layer));
    }
  }

  function paint() {
    context.clearRect(0, 0, width, height);
    for (const layer of layers) {
      if (layer.soft) {
        for (const flake of layer.flakes) {
          const x = flake.x + Math.sin(elapsed * flake.frequency + flake.phase) * flake.sway;
          const size = flake.radius * 5;
          const edge = Math.max(0, Math.min(1, flake.y / 24, (height - flake.y) / 36));
          context.globalAlpha = layer.opacity[flake.tone] * edge;
          context.drawImage(glow, x - size / 2, flake.y - size / 2, size, size);
        }
        continue;
      }
      /* 远、中景按明暗分组，一组只填充一次；半径与摆幅仍逐粒不同。 */
      context.fillStyle = layer.color;
      for (let tone = 0; tone < layer.opacity.length; tone++) {
        context.globalAlpha = layer.opacity[tone];
        context.beginPath();
        for (const flake of layer.flakes) {
          if (flake.tone !== tone) continue;
          const x = flake.x + Math.sin(elapsed * flake.frequency + flake.phase) * flake.sway;
          context.moveTo(x + flake.radius, flake.y);
          context.arc(x, flake.y, flake.radius, 0, Math.PI * 2);
        }
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }

  function tick(now: number) {
    const dt = previousTime ? Math.min(.05, (now - previousTime) / 1000) : 0;
    previousTime = now;
    elapsed += dt;
    const wind = Math.sin(elapsed * .19) * 5 + Math.sin(elapsed * .071 + .7) * 9;
    for (const layer of layers) {
      for (const flake of layer.flakes) {
        flake.x += wind * layer.wind * dt;
        flake.y += flake.speed * dt;
        if (flake.y > height + 12) {
          flake.y = -12;
          flake.x = random(-20, width + 20);
        }
        if (flake.x < -24) flake.x += width + 48;
        else if (flake.x > width + 24) flake.x -= width + 48;
      }
    }
    paint();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (!requested || !visible || document.hidden || !width || !height) { pause(); return; }
    if (reducedMotion) { paint(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(container);
  new ResizeObserver(() => { fit(); sync(); }).observe(container);
  document.addEventListener('visibilitychange', sync);
  addEventListener('resize', () => { fit(); sync(); });

  return {
    start() { requested = true; fit(); sync(); },
    stop() { requested = false; pause(); context.clearRect(0, 0, width, height); }
  };
}
