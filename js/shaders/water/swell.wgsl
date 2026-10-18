// Swell: big travelling waves, shared by the water's vertex shader (height) and fragment shader (normal).
// Mirrored in JS by waveHeightAt() in js/objects/water.js (the ship floats on it), keep the two in sync.
// Three sine waves around waveDirection (radians), the longest waveLength long, sharpened toward the crests.
// Returns (height, dh/dx, dh/dz); waveHeight 0 = flat water. Fades out with distance from the camera.
fn swell(
  p: vec2f,
  camXZ: vec2f,
  t: f32,
  waveHeight: f32,
  waveDirection: f32,
  waveLength: f32,
  waveSpeed: f32,
  waveSharpness: f32,
  waveFadeDistance: f32,
) -> vec3f {
  var sum = swellWave(p, t, waveDirection, waveLength, 0.0, waveSpeed, waveSharpness) * 1.0;
  sum += swellWave(p, t, waveDirection + 0.44, waveLength * 0.62, 1.7, waveSpeed, waveSharpness) * 0.45;
  sum += swellWave(p, t, waveDirection - 0.61, waveLength * 0.37, 4.1, waveSpeed, waveSharpness) * 0.25;
  // weights add up to 1.7: divide so the highest crests reach about waveHeight
  let fade = exp(-length(p - camXZ) / waveFadeDistance);
  return sum * (waveHeight * fade / 1.7);
}

// one wave: (height, slope x, slope z). Deep-water speed: longer waves travel faster (w = sqrt(g k))
fn swellWave(p: vec2f, t: f32, angle: f32, lambda: f32, phase: f32, speed: f32, sharpness: f32) -> vec3f {
  let dir = vec2f(cos(angle), sin(angle));
  let k = 6.2831853 / lambda;
  let w = sqrt(9.81 * k) * speed;
  let x = dot(dir, p) * k - w * t + phase;
  // sin remapped to 0..1, raised to a power (sharper crests, flatter troughs), back to -1..1
  let s = max((1.0 + sin(x)) * 0.5, 0.0001);
  let h = 2.0 * pow(s, sharpness) - 1.0;
  let dhdx = sharpness * pow(s, sharpness - 1.0) * cos(x);
  return vec3f(h, dir * (dhdx * k));
}
