---
name: pixijs-custom-rendering
description: >-
  Write PixiJS v8 custom shaders, Filter.from, GlProgram/GpuProgram, UniformGroup,
  and a 3D LUT palette-snap pass. Use when implementing Corporator day/night LUT
  (lut_phases.png), the final 53-color snap (lut_snap.png), GLSL fragment filters,
  or any Shader.from/Filter.from work.
---

# PixiJS v8 custom rendering (LUT snap)

Corporator’s night/day and palette lock are **custom filters**, not `ColorMatrixFilter`.
`ColorMatrixFilter` cannot snap an RGB frame onto 53 named colours.

## When to use what

| Need | API |
|---|---|
| Recolour a whole `RenderTexture` (phase LUT, palette snap) | `Filter.from({ gl, resources })` on the scene container |
| Per-sprite program | `Shader.from({ gl, gpu, resources })` on a `Mesh` |
| Built-in blur/tint | `pixijs-filters` — not for 53-colour snap |

## Filter.from (WebGL2)

```ts
import { Filter } from "pixi.js";

const snap = Filter.from({
  gl: {
    vertex: /* glsl */ `#version 300 es
      in vec2 aPosition;
      out vec2 vUv;
      uniform vec4 uInputSize;
      uniform vec4 uOutputFrame;
      void main() {
        vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
        gl_Position = vec4((p / uInputSize.xy) * 2.0 - 1.0, 0.0, 1.0);
        vUv = aPosition;
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D uFrame;
      uniform sampler2D uSnap;
      uniform float uSide;
      void main() {
        vec3 c = texture(uFrame, vUv).rgb;
        float s = uSide;
        vec3 t = clamp(c, 0.0, 1.0) * (s - 1.0);
        vec3 i0 = floor(t);
        vec3 f = t - i0;
        // layer-major 3D LUT packed 16 slices per row; nearest on all axes
        vec2 uv = lutNearestUv(i0, s);
        outColor = vec4(texture(uSnap, uv).rgb, texture(uFrame, vUv).a);
      }`,
  },
  resources: {
    uFrame: frameTexture.source,
    uSnap: snapTexture.source,
    uniforms: {
      uSide: { value: 32, type: "f32" },
    },
  },
});

scene.filters = [phaseLut, snap];
```

`uSide` and LUT bytes come from the pack (`render.snap_lut_side`), never a TS literal ≥ 2.

## Phase LUT (index atlas)

Index atlas R = palette index 0..52, G = emissive. Phase shader:

```
idx = floor(texture(uIndex, uv).r * 255.0 + 0.5)
a = texelFetch(uLut, ivec2(idx, phaseA), 0).rgb
b = texelFetch(uLut, ivec2(idx, phaseB), 0).rgb
base = mix(a, b, blend)
```

Mix leaves the 53-set; the **snap filter runs last** and puts every pixel back.

`texelFetch` needs WebGL2. WebGL1 fallback: `texture2D` + `(idx + 0.5) / 64.0`, `nearest`. Both branches must match (existing TZ_RENDER test).

## Rules for this repo

- Time uniform is `city_time` from `clock.ts`, never `Date.now` inside `packages/render`.
- `scaleMode: "nearest"` on atlas, LUT, and snap textures.
- Do not add `pixi-filters` unless `arch.toolchain` records it.
- Full API index: WebFetch `https://pixijs.download/release/docs/llms.txt` then the linked `.html.md`.
