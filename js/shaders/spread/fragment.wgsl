// Spreading front: a ragged edge that grows outward from one point across a mesh.
// Kenaz burns the sail with it (discard on), Isa will reuse it for frost (discard off).
//
// It's plugged into a lit material (MeshStandardNodeMaterial), so it returns surface values in linear
// color, not a display-ready picture: the material still does the lighting, fog and tone mapping.
// wgslFn returns one value, so `part` picks what this call returns (the material calls it twice):
//   part 0 -> vec4f(surface color, opacity)   used as colorNode (rgb) and opacityNode (a)
//   part 1 -> vec4f(edge glow, 0)             used as emissiveNode (rgb)
//
// Parameters (no comments allowed inside the list itself, wgslFn can't parse them):
//   localPos        position on the mesh in its own (local) space, so the front moves with the ship
//   baseColor       the mesh's original flat color (linear), shown ahead of the front
//   spreadProgress  0 = nothing reached yet, 1 = the front has passed the whole mesh
//   spreadOrigin    local-space point where the front starts
//   spreadSize      local distance from the origin to the mesh's farthest corner (set in JS),
//                   divides every distance so progress 0..1 fits any mesh size
//   noiseScale      how many noise bumps fit across the mesh (higher = finer, more jagged edge)
//   noiseStrength   how far the noise pushes the edge in and out (fraction of spreadSize)
//   edgeWidth       width of the glowing band on the front (fraction of spreadSize)
//   edgeColor       color of the glow on the front (linear)
//   edgeIntensity   brightness multiplier of that glow
//   charColor       color behind the front (burnt cloth, or frost)
//   discardBurnt    1 = cut away what's behind the front (fire), 0 = keep it as charColor (frost)
//   part            0 = surface color + opacity, 1 = edge glow (see above)
fn spread(
  localPos: vec3f,
  baseColor: vec3f,
  spreadProgress: f32,
  spreadOrigin: vec3f,
  spreadSize: f32,
  noiseScale: f32,
  noiseStrength: f32,
  edgeWidth: f32,
  edgeColor: vec3f,
  edgeIntensity: f32,
  charColor: vec3f,
  discardBurnt: f32,
  part: f32
) -> vec4f {
  // 1. How far is this point from where the front started?
  //    Divided by spreadSize, so 0 = at the origin and 1 = at the farthest corner of the mesh.
  let dist = length(localPos - spreadOrigin) / spreadSize;

  // 2. Noise to make the front ragged instead of a perfect circle.
  //    Sampled on the mesh's local x/y (the flat sides of the sail), also divided by spreadSize so the
  //    pattern has the same number of bumps on any mesh size. fbm() returns 0..1.
  let n = fbm(localPos.xy / spreadSize * noiseScale);

  // 3. Push the distance in and out with the noise: (n - 0.5) is -0.5..0.5, so some points act closer
  //    to the origin (the front reaches them early) and some farther (reached late).
  let raggedDist = dist + (n - 0.5) * noiseStrength;

  // 4. Where the front is right now, in the same 0..1 units.
  //    The ragged distances run from -noiseStrength/2 to 1 + noiseStrength/2, so the front starts before
  //    the closest point, minus the half edge of scorching that runs ahead of it (progress 0: untouched),
  //    and ends past the farthest point plus the edge and char bands (progress 1: fully burnt).
  //    max() keeps the widths above 0, smoothstep() below needs its two edges to differ.
  let edge = max(edgeWidth, 0.0001);
  let frontStart = -0.5 * noiseStrength - 0.5 * edge;
  let frontEnd = 1.0 + 0.5 * noiseStrength + 2.0 * edge;
  let front = mix(frontStart, frontEnd, spreadProgress);

  // 5. How far the front has already passed this point:
  //    < 0             the front hasn't arrived yet  -> base color
  //    0 .. edge       the point is on the front     -> glowing edge
  //    edge .. 2*edge  just behind the front         -> char color
  //    > 2*edge        well behind the front         -> char color, or cut away in discard mode
  let behind = front - raggedDist;

  // 6. Surface color: base -> char. The darkening starts half an edge ahead of the front (the cloth
  //    scorches before the flame arrives) and is complete one edge behind it.
  let charAmount = smoothstep(-0.5 * edge, edge, behind);
  let color = mix(baseColor, charColor, charAmount);

  // 7. Opacity: 0 where the point is well behind the front and discard mode is on, 1 everywhere else.
  //    step(2*edge, behind) is 1 behind the char band. The material's alphaTest cuts out opacity 0
  //    (a hard, ragged hole: the noise from step 2 shapes it).
  let cut = step(2.0 * edge, behind) * discardBurnt;
  let opacity = 1.0 - cut;

  // 8. Glow on the front: rises quickly as the front arrives (first quarter of the band), fades out
  //    toward the back of the band. 0 ahead of the front and behind the band.
  let glowIn = smoothstep(0.0, 0.25 * edge, behind);
  let glowOut = 1.0 - smoothstep(0.5 * edge, edge, behind);
  let glow = edgeColor * edgeIntensity * glowIn * glowOut;

  // 9. Return the part the material asked for (select(a, b, condition) = condition ? b : a).
  return select(vec4f(color, opacity), vec4f(glow, 0.0), part > 0.5);
}

// hash21 copied from the aurora shader (js/shaders/aurora/fragment.wgsl):
// a pseudo-random 0..1 value for each 2D point, the same point always gives the same value
fn hash21(n: vec2f) -> f32 {
  return fract(sin(dot(n, vec2f(12.9898, 4.1414))) * 43758.5453);
}

// value noise built on hash21: a random value at every whole-number grid corner, smoothly blended
// in between, so it varies softly instead of jumping from pixel to pixel. Returns 0..1
fn valueNoise(p: vec2f) -> f32 {
  // the grid cell this point is in (its lower-left corner) and where it is inside that cell (0..1)
  let cell = floor(p);
  let f = fract(p);
  // smoothstep curve 3f² - 2f³: blends without visible creases at the cell borders
  let u = f * f * (3.0 - 2.0 * f);
  // random values at the cell's four corners
  let a = hash21(cell);
  let b = hash21(cell + vec2f(1.0, 0.0));
  let c = hash21(cell + vec2f(0.0, 1.0));
  let d = hash21(cell + vec2f(1.0, 1.0));
  // blend along x on the bottom and top edges, then along y between them
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// fractal noise: three layers of value noise, each twice as fine and half as strong as the one
// before, so the edge has big bumps with smaller jags on them. Returns 0..1
fn fbm(p: vec2f) -> f32 {
  var sum = 0.0;
  var amplitude = 0.5;
  var q = p;
  for (var i = 0; i < 3; i++) {
    sum += valueNoise(q) * amplitude;
    // the + offset keeps the layers from lining up at the origin
    q = q * 2.0 + vec2f(17.3, 9.1);
    amplitude *= 0.5;
  }
  // the amplitudes add up to 0.875, divide so the result still spans 0..1
  return sum / 0.875;
}
