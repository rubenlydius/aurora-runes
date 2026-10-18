// "Auroras" by nimitz 2017 (twitter: @stormoid) — https://www.shadertoy.com/view/XtGGRt
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// WGSL port of reference/aurora.glsl. Main function first (wgslFn reads its signature), helpers below.
// rayDir: world-space view direction of this fragment on the sky sphere (replaces the screen-based
// ray and the iMouse/time rotation of the original). fragCoord is only used to seed the dither.
// pointer*: while pressed, the aurora gathers and brightens around pointerPoint (in the loop's
// noise coordinates, computed in js/interaction/auroraPointer.js with the same formula as aurora()).
// pointerTrailPoints: the glow's recent path, one texel per point (xy = position, z = age 0..1),
// newest first; pointerTrailCount says how many texels are in use.
// radius and core size arrive already scaled for the pointer's distance, so they look similar everywhere
// mood (shared with the water, animated by the rune effects): skyBrightness and skyTint multiply the final
// color, auroraSpeed scales the aurora's animation time; the defaults 1, white, 1 leave the look unchanged
// day (midnight sun): dayAmount 0..1 blends the night background toward a dawn gradient (dawnHorizonColor
// -> dawnZenithColor, sRGB) and fades the aurora and stars out; a warm glow of size sunGlowSize (radians)
// sits around sunDirection. dayAmount 0 leaves the night exactly as it was
// flashAmount (lightning, 0 = none): lifts the whole sky toward a cold white for the length of a flash
fn auroraShader(
  rayDir: vec3f,
  fragCoord: vec2f,
  iTime: f32,
  iResolution: vec2f,
  pointerPoint: vec2f,
  pointerStrength: f32,
  pointerRadius: f32,
  pointerBoost: f32,
  pointerPull: f32,
  pointerCore: f32,
  pointerCoreSize: f32,
  pointerCreate: f32,
  pointerTrail: f32,
  pointerTrailPoints: texture_2d<f32>,
  pointerTrailCount: f32,
  skyBrightness: f32,
  skyTint: vec3f,
  auroraSpeed: f32,
  dayAmount: f32,
  sunDirection: vec3f,
  dawnHorizonColor: vec3f,
  dawnZenithColor: vec3f,
  sunGlowSize: f32,
  flashAmount: f32,
) -> vec4f {
  let auroraTime = iTime * auroraSpeed;
  let ro = vec3f(0.0, 0.0, -6.7);
  let viewDir = normalize(rayDir);
  var rd = viewDir;
  // the water plane ends about 0.25° below the horizon (where it meets the sky sphere): just below the
  // horizon, draw the horizon sky instead of the darker reflection, so it meets the far (fogged) water flush
  let skyBand = rd.y > -0.02;
  if (skyBand) {
    rd = normalize(vec3f(rd.x, max(rd.y, 0.0), rd.z));
  }

  let fade = smoothstep(0.0, 0.01, abs(rd.y)) * 0.1 + 0.9;
  // how much night is left: the aurora and stars fade with it
  let day = clamp(dayAmount, 0.0, 1.0);
  let night = 1.0 - day;
  var col = bg(rd) * fade;

  if (skyBand) {
    let result = aurora(
      ro, rd, fragCoord, auroraTime,
      pointerPoint, pointerStrength, pointerRadius, pointerPull, pointerCore, pointerCoreSize,
      pointerCreate, pointerTrail, pointerTrailPoints, pointerTrailCount,
    );
    let aur = smoothstep(vec4f(0.0), vec4f(1.5), result.col) * fade * night;
    col = mix(col, dawnSky(rd, dawnHorizonColor, dawnZenithColor), day);
    col += stars(viewDir, iResolution) * night;
    // boost after the smoothstep above, which would otherwise cap the extra brightness at 1
    col = col * (1.0 - aur.a) + aur.rgb * (1.0 + pointerBoost * result.glow);
  } else {
    // reflections
    rd.y = abs(rd.y);
    col = mix(bg(rd) * fade, dawnSky(rd, dawnHorizonColor, dawnZenithColor), day) * 0.6;
    let result = aurora(
      ro, rd, fragCoord, auroraTime,
      pointerPoint, pointerStrength, pointerRadius, pointerPull, pointerCore, pointerCoreSize,
      pointerCreate, pointerTrail, pointerTrailPoints, pointerTrailCount,
    );
    let aur = smoothstep(vec4f(0.0), vec4f(2.5), result.col) * night;
    col += stars(rd, iResolution) * 0.1 * night;
    col = col * (1.0 - aur.a) + aur.rgb * (1.0 + pointerBoost * result.glow);
    let pos = ro + ((0.5 - ro.y) / rd.y) * rd;
    let nz2 = triNoise2d(pos.xz * vec2f(0.5, 0.7), 0.0, auroraTime);
    col += mix(vec3f(0.2, 0.25, 0.5) * 0.08, vec3f(0.3, 0.3, 0.5) * 0.7, nz2 * 0.4) * night;
  }

  // the sun, on top of the dawn gradient (rd is mirrored below the horizon, so it reflects too)
  col += sunGlow(rd, sunDirection, sunGlowSize, dawnHorizonColor) * day;

  // lightning lights up the sky (and, through the water shader, its reflection)
  col += vec3f(0.55, 0.6, 0.75) * 0.35 * flashAmount;

  // mood, before the soft clip so a brighter sky still rolls off smoothly
  col *= skyTint * skyBrightness;

  return vec4f(softClip(col), 1.0);
}

// dawn sky: horizon color low down, easing into the zenith color higher up
fn dawnSky(rd: vec3f, horizon: vec3f, zenith: vec3f) -> vec3f {
  return mix(horizon, zenith, smoothstep(0.0, 0.5, max(rd.y, 0.0)));
}

// soft sun: a bright core of about `size` radians plus a wide faint halo; softClip turns the core warm white
fn sunGlow(rd: vec3f, sunDir: vec3f, size: f32, color: vec3f) -> vec3f {
  let angle = acos(clamp(dot(rd, normalize(sunDir)), -1.0, 1.0));
  let core = exp(-(angle * angle) / (size * size));
  let halo = exp(-angle / (size * 4.0)) * 0.35;
  return color * (core * 1.5 + halo);
}

// soft roll-off: unchanged below the knee, above it each channel eases toward 1 instead of clipping.
// very bright (boosted) areas end up with all channels near 1, so they glow toward white
fn softClip(c: vec3f) -> vec3f {
  let knee = 0.85;
  let rolled = knee + (1.0 - knee) * (1.0 - exp(-(c - knee) / (1.0 - knee)));
  return select(c, rolled, c > vec3f(knee));
}

fn mm2(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

fn tri(x: f32) -> f32 {
  return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
}

fn tri2(p: vec2f) -> vec2f {
  return vec2f(tri(p.x) + tri(p.y), tri(p.y + tri(p.x)));
}

// time is passed in: WGSL has no global iTime like the GLSL #define
fn triNoise2d(pIn: vec2f, spd: f32, iTime: f32) -> f32 {
  let m2 = mat2x2f(0.95534, 0.29552, -0.29552, 0.95534);
  var z = 1.8;
  var z2 = 2.5;
  var rz = 0.0;
  var p = pIn * mm2(pIn.x * 0.06);
  var bp = p;
  for (var i = 0.0; i < 5.0; i += 1.0) {
    var dg = tri2(bp * 1.85) * 0.75;
    dg *= mm2(iTime * spd);
    p -= dg / z2;

    bp *= 1.3;
    z2 *= 0.45;
    z *= 0.42;
    p *= 1.21 + (rz - 1.0) * 0.02;

    rz += tri(p.x + tri(p.y)) * z;
    // p *= -m2 — WGSL can't negate a matrix, so negate the result instead
    p = -(p * m2);
  }
  return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
}

fn hash21(n: vec2f) -> f32 {
  return fract(sin(dot(n, vec2f(12.9898, 4.1414))) * 43758.5453);
}

// aurora() returns its color plus how close its samples were to the pointer (0..1)
struct AuroraResult {
  col: vec4f,
  glow: f32,
}

// fragCoord replaces gl_FragCoord (used to seed the dither)
fn aurora(
  ro: vec3f,
  rd: vec3f,
  fragCoord: vec2f,
  iTime: f32,
  pointerPoint: vec2f,
  pointerStrength: f32,
  pointerRadius: f32,
  pointerPull: f32,
  pointerCore: f32,
  pointerCoreSize: f32,
  pointerCreate: f32,
  pointerTrail: f32,
  pointerTrailPoints: texture_2d<f32>,
  pointerTrailCount: f32,
) -> AuroraResult {
  var col = vec4f(0.0);
  var avgCol = vec4f(0.0);
  var glow = 0.0;
  var weightSum = 0.0;

  // trail: computed once per pixel at the layer height the pointer is mapped to (0.85, see
  // js/constants/aurora.js) instead of in all 50 samples; it follows the glow's recorded path
  let pTrail = (ro + ((0.85 - ro.y) / (rd.y * 2.0 + 0.4)) * rd).zx;
  let trail = pointerStrength * trailDensity(pTrail, pointerTrailPoints, pointerTrailCount, pointerCoreSize * 1.5);

  for (var i = 0.0; i < 50.0; i += 1.0) {
    let ofs = 0.006 * hash21(fragCoord) * smoothstep(0.0, 15.0, i);
    var pt = ((0.8 + pow(i, 1.4) * 0.002) - ro.y) / (rd.y * 2.0 + 0.4);
    pt -= ofs;
    let bpos = ro + pt * rd;
    // p0: where this sample really is, p: where it looks up the noise (moved by the magnet)
    let p0 = bpos.zx;
    var p = p0;

    // distance from the pointer (max() avoids dividing by 0 right at the point)
    let fromPointer = p0 - pointerPoint;
    let r = max(length(fromPointer), 0.0001);

    // magnet: inside pointerRadius, a sample at distance r looks up the pattern at R * (r / R)^gamma.
    // gamma < 1 makes that further out, so everything inside the radius is squeezed into the cursor;
    // the closer to the center, the stronger the squeeze. strength 0 gives gamma 1: no change
    let gamma = 1.0 / (1.0 + pointerPull * pointerStrength);
    let pulledR = pointerRadius * pow(min(r / pointerRadius, 1.0), gamma);
    p = select(p, pointerPoint + fromPointer / r * pulledR, r < pointerRadius);

    // bright core: a small, sharp bump added to the aurora's density right at the cursor,
    // so it gets the aurora's own colors and blends with the gathered curtains
    let core = pointerStrength * exp(-(r * r) / (pointerCoreSize * pointerCoreSize));

    // new aurora: a wider soft area around the cursor that adds density, even where there was none
    let haloSize = pointerRadius * 0.45;
    let halo = pointerStrength * exp(-(r * r) / (haloSize * haloSize));

    let noise = triNoise2d(p, 0.25, iTime);
    // the created aurora and the trail follow the noise pattern (0.3 + noise), so they look like
    // aurora rather than a flat smudge; the core is added flat so the center is always bright
    let rzt = noise + core * pointerCore + (halo * pointerCreate + trail * pointerTrail) * (0.3 + noise);

    // closeness for the brightness boost, squared so it concentrates toward the center
    let falloff = 1.0 - smoothstep(0.0, pointerRadius, r);
    let near = pointerStrength * falloff * falloff;
    let col2 = vec4f((sin(1.0 - vec3f(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5) * rzt, rzt);
    avgCol = mix(avgCol, col2, 0.5);
    let weight = exp2(-i * 0.065 - 2.5) * smoothstep(0.0, 5.0, i);
    col += avgCol * weight;
    // average closeness over all samples, weighted like the color
    glow += near * weight;
    weightSum += weight;
  }

  col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);
  return AuroraResult(col * 1.8, glow / weightSum);
}

// 1 on the recorded path, fading with distance from it and with the age of that part of the path
fn trailDensity(p: vec2f, points: texture_2d<f32>, count: f32, width: f32) -> f32 {
  var density = 0.0;
  // walk the path segment by segment: point k-1 -> point k
  // (texel xy = position, z = age 0..1, w = 1 if point k ends an older trail)
  var a = textureLoad(points, vec2i(0, 0), 0);
  for (var k = 1; k < i32(count); k++) {
    let b = textureLoad(points, vec2i(k, 0), 0);
    // b belongs to a previous stroke: don't connect it to the newer trail
    if (b.w < 0.5) {
      let s = segment(p, a.xy, b.xy);
      // age at the closest point on this segment: 0 = just drawn, 1 = about to disappear
      let fade = 1.0 - mix(a.z, b.z, s.y);
      // older parts also get thinner
      let w = width * (0.4 + 0.6 * fade);
      density = max(density, exp(-(s.x * s.x) / (w * w)) * fade);
    }
    a = b;
  }
  return density;
}

// distance from p to the segment a-b (.x), and how far along it the closest point lies, 0..1 (.y)
fn segment(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
  let pa = p - a;
  let ba = b - a;
  // max() avoids dividing by 0 when the trail has caught up and the segment has no length
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return vec2f(length(pa - ba * h), h);
}

//-------------------Background and Stars--------------------

fn nmzHash33(q: vec3f) -> vec3f {
  // u32 multiplication wraps, like GLSL uint
  var p = vec3u(vec3i(q));
  p = p * vec3u(374761393u, 1103515245u, 668265263u) + p.zxy + p.yzx;
  p = p.yzx * (p.zxy ^ (p >> vec3u(3u)));
  return vec3f(p ^ (p >> vec3u(16u))) * (1.0 / 4294967295.0);
}

fn stars(pIn: vec3f, iResolution: vec2f) -> vec3f {
  var c = vec3f(0.0);
  var p = pIn;
  let res = iResolution.x * 1.0;

  for (var i = 0.0; i < 4.0; i += 1.0) {
    let q = fract(p * (0.15 * res)) - 0.5;
    let id = floor(p * (0.15 * res));
    let rn = nmzHash33(id).xy;
    var c2 = 1.0 - smoothstep(0.0, 0.6, length(q));
    c2 *= step(rn.x, 0.0005 + i * i * 0.001);
    c += c2 * (mix(vec3f(1.0, 0.49, 0.1), vec3f(0.75, 0.9, 1.0), rn.y) * 0.1 + 0.9);
    p *= 1.3;
  }
  return c * c * 0.8;
}

fn bg(rd: vec3f) -> vec3f {
  var sd = dot(normalize(vec3f(-0.5, -0.6, 0.9)), rd) * 0.5 + 0.5;
  sd = pow(sd, 5.0);
  let col = mix(vec3f(0.05, 0.1, 0.2), vec3f(0.1, 0.05, 0.2), sd);
  return col * 0.63;
}
