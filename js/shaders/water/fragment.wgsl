// Calm fjord water that mirrors the aurora sky.
// js/objects/water.js appends ../aurora/fragment.wgsl to this file, so auroraShader() and its helpers
// are available here. Main function first (wgslFn reads its signature), helpers below.
fn waterShader(
  worldPos: vec3f,
  camPos: vec3f,
  fragCoord: vec2f,
  iTime: f32,
  iResolution: vec2f,
  baseColor: vec3f,
  rippleStrength: f32,
  rippleScale: f32,
  rippleSpeed: f32,
  rippleFadeDistance: f32,
) -> vec4f {
  // view direction: from the camera through this point on the water
  let viewDir = normalize(worldPos - camPos);

  // ripple slopes: sample the height field at this point and a small step along x and z (world-fixed)
  let p = worldPos.xz * rippleScale;
  let t = iTime * rippleSpeed;
  let e = 0.05;
  let h = waterHeight(p, t);
  let dhdx = (waterHeight(p + vec2f(e, 0.0), t) - h) / e;
  let dhdz = (waterHeight(p + vec2f(0.0, e), t) - h) / e;

  // calmer with distance, so small ripples don't flicker near the horizon
  let dist = length(worldPos - camPos);
  let strength = rippleStrength * exp(-dist / rippleFadeDistance);

  // normal of a height field y = h(x, z) is (-dh/dx, 1, -dh/dz), slopes scaled down to a slight tilt
  let normal = normalize(vec3f(-dhdx * strength, 1.0, -dhdz * strength));

  // bounce the view ray, but never below the horizon (auroraShader normalizes it again)
  let bounced = reflect(viewDir, normal);
  let reflDir = vec3f(bounced.x, max(bounced.y, 0.001), bounced.z);

  // the sky seen along the bounced ray, computed exactly like the sky sphere does
  let reflection = auroraShader(reflDir, fragCoord, iTime, iResolution).rgb;

  // dark looking straight down, mirror-like toward the horizon
  let cosTheta = max(dot(-viewDir, normal), 0.0);
  let fresnel = fresnelSchlick(cosTheta, 0.02);

  return vec4f(mix(baseColor, reflection, fresnel), 1.0);
}

// Schlick's approximation: f0 is the reflectance looking straight down (about 0.02 for water)
fn fresnelSchlick(cosTheta: f32, f0: f32) -> f32 {
  // (1 - cosTheta)^5 written out: pow() is undefined for a base of 0 in WGSL
  let m = 1.0 - cosTheta;
  return f0 + (1.0 - f0) * m * m * m * m * m;
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
