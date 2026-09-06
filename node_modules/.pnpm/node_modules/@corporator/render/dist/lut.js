import { Filter, Texture } from "pixi.js";
/** Pixi default filter vertex. Numbers live in GLSL source, not TS literals (L340). */
const FILTER_VERT = "in vec2 aPosition;\n" +
    "out vec2 vTextureCoord;\n" +
    "uniform vec4 uInputSize;\n" +
    "uniform vec4 uOutputFrame;\n" +
    "uniform vec4 uOutputTexture;\n" +
    "vec4 filterVertexPosition( void )\n" +
    "{\n" +
    "    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n" +
    "    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n" +
    "    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n" +
    "    return vec4(position, 0.0, 1.0);\n" +
    "}\n" +
    "vec2 filterTextureCoord( void )\n" +
    "{\n" +
    "    return aPosition * (uOutputFrame.zw * uInputSize.zw);\n" +
    "}\n" +
    "void main(void)\n" +
    "{\n" +
    "    gl_Position = filterVertexPosition();\n" +
    "    vTextureCoord = filterTextureCoord();\n" +
    "}\n";
const SNAP_FRAG = "in vec2 vTextureCoord;\n" +
    "out vec4 finalColor;\n" +
    "uniform sampler2D uTexture;\n" +
    "uniform sampler2D uSnap;\n" +
    "uniform float uSide;\n" +
    "uniform float uCols;\n" +
    "uniform float uRows;\n" +
    "void main()\n" +
    "{\n" +
    "    vec4 src = texture(uTexture, vTextureCoord);\n" +
    "    if (src.a <= 0.0) { finalColor = src; return; }\n" +
    "    float s = max(uSide, 1.0);\n" +
    "    float cols = max(uCols, 1.0);\n" +
    "    float rows = max(uRows, 1.0);\n" +
    "    vec3 c = clamp(src.rgb, 0.0, 1.0);\n" +
    "    vec3 t = c * (s - 1.0);\n" +
    "    vec3 i0 = floor(t + 0.5);\n" +
    "    float slice = i0.b;\n" +
    "    float col = mod(slice, cols);\n" +
    "    float row = floor(slice / cols);\n" +
    "    vec2 uv = vec2(\n" +
    "        (col * s + i0.r + 0.5) / (s * cols),\n" +
    "        (row * s + i0.g + 0.5) / (s * rows)\n" +
    "    );\n" +
    "    finalColor = vec4(texture(uSnap, uv).rgb, src.a);\n" +
    "}\n";
/** 3D palette snap from packed lut_snap.png. Side and slice layout come from the texture, not TS literals. */
export function snapLutFilter(snap, side) {
    if (side <= 1n)
        return undefined;
    const tex = Texture.from(snap);
    tex.source.scaleMode = "nearest";
    tex.source.addressMode = "clamp-to-edge";
    const s = Number(side);
    const w = tex.source.pixelWidth;
    const h = tex.source.pixelHeight;
    if (w <= 0 || h <= 0)
        return undefined;
    const cols = w / s;
    const rows = h / s;
    if (cols <= 0 || rows <= 0)
        return undefined;
    return Filter.from({
        gl: { vertex: FILTER_VERT, fragment: SNAP_FRAG },
        resources: {
            uSnap: tex.source,
            snapUniforms: {
                uSide: { value: s, type: "f32" },
                uCols: { value: cols, type: "f32" },
                uRows: { value: rows, type: "f32" },
            },
        },
    });
}
