// Calm fjord water that mirrors the aurora sky.
// js/objects/water.js appends swell.wgsl and ../aurora/fragment.wgsl to this file, so swell(), auroraShader()
// and their helpers are available here. Main function first (wgslFn reads its signature), helpers below.
// (no comments inside the parameter list: wgslFn parses it as text)
// rippleTime: ripple animation time, summed up in JS from the ripple speed every frame (no jumps when it changes)
// swellTime: the swell's own time, summed up in JS; it stops while the ice holds the waves (Isa)
// Ice (Isa), all 0 / off at rest so the water is unchanged:
//   freezeAmount   0 = open water, 1 = frozen as far as iceRadius; drives a ragged front spreading outward
//   iceOrigin      world x/z the ice grows from (the shore by the camera)
//   iceRadius      how far the front has reached at freezeAmount 1 (world units)
//   iceCurve       front radius = iceRadius * freezeAmount^iceCurve: > 1 starts slow near the shore and
//                  speeds up far away, so it doesn't race past the nearby water in the first moment
//   iceNoise       how ragged the front is, as a fraction of its distance from the origin
//   iceFade        1 = ice as far as the front reached, fading to 0 melts it all away at once (the thaw)
//   iceColor       bluish white of the ice (display values like baseColor)
//   iceTint        how much of iceColor shows through the ice's own surface (0..1)
//   iceBlur        frosted reflection: random tilt of the ice's normal per pixel
//   crackStrength  brightness of the cracks, crackScale: how many cracks per world unit
// reflectionSteps: aurora samples for the reflected sky (the sky itself uses 50); the ripples blur it anyway
fn waterShader(
  worldPos: vec3f,
  camPos: vec3f,
  fragCoord: vec2f,
  iTime: f32,
  iResolution: vec2f,
  baseColor: vec3f,
  rippleStrength: f32,
  rippleScale: f32,
  rippleTime: f32,
  rippleFadeDistance: f32,
  swellTime: f32,
  shipPosition: vec3f,
  shipRotation: f32,
  shipReflectionSize: vec2f,
  shipReflectionStrength: f32,
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
  auroraTime: f32,
  dayAmount: f32,
  sunDirection: vec3f,
  dawnHorizonColor: vec3f,
  dawnZenithColor: vec3f,
  sunGlowSize: f32,
  flashAmount: f32,
  auroraIntensity: f32,
  auroraHueShift: f32,
  reflectionSteps: f32,
  waveHeight: f32,
  waveDirection: f32,
  waveLength: f32,
  waveSpeed: f32,
  waveSharpness: f32,
  waveFadeDistance: f32,
  freezeAmount: f32,
  iceOrigin: vec2f,
  iceRadius: f32,
  iceCurve: f32,
  iceNoise: f32,
  iceFade: f32,
  iceColor: vec3f,
  iceTint: f32,
  iceBlur: f32,
  crackStrength: f32,
  crackScale: f32,
) -> vec4f {
  // view direction: from the camera through this point on the water
  let viewDir = normalize(worldPos - camPos);

  // ripple slopes: sample the height field at this point and a small step along x and z (world-fixed)
  let p = worldPos.xz * rippleScale;
  let t = rippleTime;
  let e = 0.05;
  let h = waterHeight(p, t);
  let dhdx = (waterHeight(p + vec2f(e, 0.0), t) - h) / e;
  let dhdz = (waterHeight(p + vec2f(0.0, e), t) - h) / e;

  // calmer with distance, so small ripples don't flicker near the horizon
  let dist = length(worldPos - camPos);

  // --- ice: how frozen this point is (0 = water, 1 = ice) ---
  // skipped entirely while nothing is frozen (freezeAmount is a uniform, so every pixel takes the same branch)
  var ice = 0.0;
  var iceRim = 0.0;
  var cracks = 0.0;
  if (freezeAmount > 0.0) {
    // distance from where the ice starts, along the water
    let iceDist = length(worldPos.xz - iceOrigin);
    // two noise layers (0..1) make the front ragged; the push grows with the distance, so the bumps look
    // about as big near the shore as far away (perspective shrinks the far ones)
    let n = (waterNoise(worldPos.xz * 0.04) + 0.5 * waterNoise(worldPos.xz * 0.15)) / 1.5;
    let raggedDist = iceDist * (1.0 + (n - 0.5) * iceNoise);
    // where the front is now: starts slow, speeds up (see iceCurve)
    let front = iceRadius * pow(freezeAmount, iceCurve);
    // how far the front has passed this point, in world units: frozen over the first 2 units behind it
    let behind = front - raggedDist;
    // the thaw fades all of it out together (ripples return, cracks and tint fade) instead of a front going back
    ice = smoothstep(0.0, 2.0, behind) * iceFade;
    // a thin brighter rim right on the front: fresh, white ice
    iceRim = smoothstep(0.0, 0.5, behind) * (1.0 - smoothstep(0.5, 3.0, behind)) * iceFade;

    // cracks: the borders between random cells (Voronoi), which form a network of straight-ish lines that
    // meet at angles, like ice breaking into plates. crackEdge() is the distance to the nearest border;
    // dividing by fwidth (how much that distance changes over one pixel) keeps the lines about one pixel wide
    // at any distance. A finer, weaker second layer adds smaller cracks; faded with distance, where they'd
    // flicker. (computed here: fwidth only works where all pixels take the same branch, like this uniform one)
    let crackPos = worldPos.xz * crackScale;
    let e1 = crackEdge(crackPos);
    let e2 = crackEdge(mat2x2f(0.8, 0.6, -0.6, 0.8) * crackPos * 2.3 + vec2f(5.2, 1.3));
    let line1 = 1.0 - smoothstep(0.0, 1.0, e1 / max(fwidth(e1), 0.0001));
    let line2 = 1.0 - smoothstep(0.0, 1.0, e2 / max(fwidth(e2), 0.0001));
    cracks = max(line1, line2 * 0.5) * exp(-dist / 60.0);
  }

  // ripples stop under the ice (the swell below keeps lifting it, it's only there during Laguz)
  let strength = rippleStrength * exp(-dist / rippleFadeDistance) * (1.0 - ice);

  // the big swell's slopes (the vertex shader lifts the surface by the same swell)
  let sw = swell(worldPos.xz, camPos.xz, swellTime, waveHeight, waveDirection, waveLength, waveSpeed, waveSharpness, waveFadeDistance);

  // normal of a height field y = h(x, z) is (-dh/dx, 1, -dh/dz), ripple slopes scaled down to a slight tilt
  var normal = normalize(vec3f(-(dhdx * strength + sw.y), 1.0, -(dhdz * strength + sw.z)));

  // frosted ice: tilt the normal a little, randomly per pixel, so neighbouring pixels reflect slightly
  // different bits of sky. Averaged by the eye, the reflection looks blurred (like frosted glass)
  if (ice > 0.0) {
    let jitter = vec2f(waterHash(fragCoord), waterHash(fragCoord + vec2f(17.0, 31.0))) - 0.5;
    normal = normalize(normal + vec3f(jitter.x, 0.0, jitter.y) * iceBlur * ice);
  }

  // bounce the view ray, but never below the horizon (auroraShader normalizes it again)
  let bounced = reflect(viewDir, normal);
  let reflDir = vec3f(bounced.x, max(bounced.y, 0.001), bounced.z);

  // the sky seen along the bounced ray, computed exactly like the sky sphere does
  // the pointer glow shows up in the reflection too
  let sky = auroraShader(
    reflDir, fragCoord, iTime, iResolution,
    pointerPoint, pointerStrength, pointerRadius, pointerBoost, pointerPull, pointerCore, pointerCoreSize,
    pointerCreate, pointerTrail, pointerTrailPoints, pointerTrailCount,
    skyBrightness, skyTint, auroraTime,
    dayAmount, sunDirection, dawnHorizonColor, dawnZenithColor, sunGlowSize,
    flashAmount, auroraIntensity, auroraHueShift, reflectionSteps,
  ).rgb;

  // fake ship reflection: the dark hull blocks the sky, so darken the reflection in a soft patch under it
  let shipShadow = shipPatch(worldPos.xz, shipPosition.xz, shipRotation, shipReflectionSize);
  let reflection = sky * (1.0 - shipReflectionStrength * shipShadow);

  // dark looking straight down, mirror-like toward the horizon
  let cosTheta = max(dot(-viewDir, normal), 0.0);
  let fresnel = fresnelSchlick(cosTheta, 0.02);
  let waterColor = mix(baseColor, reflection, fresnel);
  if (ice <= 0.0) {
    return vec4f(waterColor, 1.0);
  }

  // --- ice surface ---
  // paler reflection: halfway to its own brightness (grey), tinted bluish white
  let luminance = dot(reflection, vec3f(0.2126, 0.7152, 0.0722));
  let paleReflection = mix(reflection, luminance * iceColor, 0.5);
  // ice reflects more than water when you look down at it (f0 0.05 instead of 0.02)
  let iceFresnel = fresnelSchlick(cosTheta, 0.05);
  // the ice's own faint color where it doesn't reflect
  var iceSurface = mix(iceColor * iceTint, paleReflection, iceFresnel);
  // the cracks and the fresh rim on the front show up bright
  iceSurface += iceColor * (cracks * crackStrength + iceRim * 0.15);

  // blend from water to ice across the front
  return vec4f(mix(waterColor, iceSurface, ice), 1.0);
}

// Schlick's approximation: f0 is the reflectance looking straight down (about 0.02 for water)
fn fresnelSchlick(cosTheta: f32, f0: f32) -> f32 {
  // (1 - cosTheta)^5 written out: pow() is undefined for a base of 0 in WGSL
  let m = 1.0 - cosTheta;
  return f0 + (1.0 - f0) * m * m * m * m * m;
}

// 1 under the ship, fading to 0 at the edge of an ellipse aligned with the hull
fn shipPatch(p: vec2f, center: vec2f, rotationY: f32, halfSize: vec2f) -> f32 {
  let d = p - center;
  // the hull's local axes on the water after three.js' rotation.y: x across it, z along its length
  let across = dot(d, vec2f(cos(rotationY), -sin(rotationY)));
  let along = dot(d, vec2f(sin(rotationY), cos(rotationY)));
  // 0 at the center, 1 on the ellipse's edge (max() avoids dividing by 0)
  let e = length(vec2f(across, along) / max(halfSize, vec2f(0.001)));
  return 1.0 - smoothstep(0.3, 1.0, e);
}

// distance from p to the nearest border between Voronoi cells: every grid cell gets one random point, each
// position belongs to its closest point. The border between the two closest points lies halfway between them,
// so (second closest - closest) / 2 is roughly the distance to it (0 on the border)
fn crackEdge(p: vec2f) -> f32 {
  let cell = floor(p);
  var d1 = 8.0;
  var d2 = 8.0;
  // the closest points are always in this cell or one of its 8 neighbours
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbour = cell + vec2f(f32(x), f32(y));
      // this cell's random point, somewhere inside it
      let point = neighbour + vec2f(waterHash(neighbour), waterHash(neighbour + vec2f(7.1, 3.7)));
      let d = length(p - point);
      // keep the two smallest distances
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return (d2 - d1) * 0.5;
}

// three noise layers: bigger and slower first, each one smaller, weaker and drifting another way
fn waterHeight(p: vec2f, t: f32) -> f32 {
  // rotate the finer layers so the noise grids don't line up
  let rot = mat2x2f(0.8, 0.6, -0.6, 0.8);
  let p2 = rot * p;
  let p3 = rot * p2;
  var h = waterNoise(p + vec2f(0.6, 0.3) * t) * 0.5;
  h += waterNoise(p2 * 2.3 + vec2f(-0.4, 0.5) * t) * 0.3;
  h += waterNoise(p3 * 5.1 + vec2f(0.2, -0.7) * t) * 0.2;
  return h;
}

// value noise: random heights on a grid, smoothly blended between the 4 nearest corners
fn waterNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = waterHash(i);
  let b = waterHash(i + vec2f(1.0, 0.0));
  let c = waterHash(i + vec2f(0.0, 1.0));
  let d = waterHash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// "Hash without Sine" by Dave Hoskins: a random 0..1 value per grid cell, stable for large coordinates
fn waterHash(p: vec2f) -> f32 {
  var p3 = fract(p.xyx * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
