// "Auroras" by nimitz 2017 (twitter: @stormoid) — https://www.shadertoy.com/view/XtGGRt
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// WGSL port of reference/aurora.glsl. Main function first (wgslFn reads its signature), helpers below.
// rayDir: world-space view direction of this fragment on the sky sphere (replaces the screen-based
// ray and the iMouse/time rotation of the original). fragCoord is only used to seed the dither.
fn auroraShader(rayDir: vec3f, fragCoord: vec2f, iTime: f32, iResolution: vec2f) -> vec4f {
  let ro = vec3f(0.0, 0.0, -6.7);
  var rd = normalize(rayDir);

  let fade = smoothstep(0.0, 0.01, abs(rd.y)) * 0.1 + 0.9;
  var col = bg(rd) * fade;

  if (rd.y > 0.0) {
    let aur = smoothstep(vec4f(0.0), vec4f(1.5), aurora(ro, rd, fragCoord, iTime)) * fade;
    col += stars(rd, iResolution);
    col = col * (1.0 - aur.a) + aur.rgb;
  } else {
    // reflections
    rd.y = abs(rd.y);
    col = bg(rd) * fade * 0.6;
    let aur = smoothstep(vec4f(0.0), vec4f(2.5), aurora(ro, rd, fragCoord, iTime));
    col += stars(rd, iResolution) * 0.1;
    col = col * (1.0 - aur.a) + aur.rgb;
    let pos = ro + ((0.5 - ro.y) / rd.y) * rd;
    let nz2 = triNoise2d(pos.xz * vec2f(0.5, 0.7), 0.0, iTime);
    col += mix(vec3f(0.2, 0.25, 0.5) * 0.08, vec3f(0.3, 0.3, 0.5) * 0.7, nz2 * 0.4);
  }

  return vec4f(col, 1.0);
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

// fragCoord replaces gl_FragCoord (used to seed the dither)
fn aurora(ro: vec3f, rd: vec3f, fragCoord: vec2f, iTime: f32) -> vec4f {
  var col = vec4f(0.0);
  var avgCol = vec4f(0.0);

  for (var i = 0.0; i < 50.0; i += 1.0) {
    let ofs = 0.006 * hash21(fragCoord) * smoothstep(0.0, 15.0, i);
    var pt = ((0.8 + pow(i, 1.4) * 0.002) - ro.y) / (rd.y * 2.0 + 0.4);
    pt -= ofs;
    let bpos = ro + pt * rd;
    let p = bpos.zx;
    let rzt = triNoise2d(p, 0.25, iTime);
    let col2 = vec4f((sin(1.0 - vec3f(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5) * rzt, rzt);
    avgCol = mix(avgCol, col2, 0.5);
    col += avgCol * exp2(-i * 0.065 - 2.5) * smoothstep(0.0, 5.0, i);
  }

  col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);
  return col * 1.8;
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
