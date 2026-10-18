// Water vertex shader: lifts the flat water plane by the swell (js/objects/water.js appends swell.wgsl).
// localPos: the plane's local position, already lying flat (xz = world xz, the mesh only moves it in y)
fn waterVertex(
  localPos: vec3f,
  camPos: vec3f,
  iTime: f32,
  waveHeight: f32,
  waveDirection: f32,
  waveLength: f32,
  waveSpeed: f32,
  waveSharpness: f32,
  waveFadeDistance: f32,
) -> vec3f {
  let s = swell(localPos.xz, camPos.xz, iTime, waveHeight, waveDirection, waveLength, waveSpeed, waveSharpness, waveFadeDistance);
  return vec3f(localPos.x, localPos.y + s.x, localPos.z);
}
