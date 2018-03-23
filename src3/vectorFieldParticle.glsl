@export stream.particle.fragment

uniform sampler2D particleTexture;
uniform sampler2D spawnTexture;
uniform sampler2D velocityTexture;

uniform float deltaTime;
uniform float elapsedTime;

uniform float speedScaling = 1.0;

uniform vec2 textureSize;
uniform vec4 region = vec4(0, 0, 1, 1);
uniform bool firstFrame;

varying vec2 v_Texcoord;

highp float rand(vec2 uv) {
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot(uv.xy, vec2(a,b)), sn = mod(dt, 3.141592653589793);
    return fract(sin(sn) * c);
}

void main()
{
    vec4 p = texture2D(particleTexture, v_Texcoord);
    bool spawn = false;
    if (p.w <= 0.0 || firstFrame) {
        p = texture2D(spawnTexture, fract(v_Texcoord * region.zw + region.xy + elapsedTime));
        p.xy = p.xy * 0.5 + 0.5;
        spawn = true;
        // if (firstFrame) {
        //     p.w -= rand(v_Texcoord) * 5.0;
        // }
    }
    vec2 jitter = (vec2(
        rand(v_Texcoord + elapsedTime),
        rand(v_Texcoord + elapsedTime + 0.2)
    ) * 2.0 - 1.0) / 200.0 * p.w;
    vec4 tmp = texture2D(velocityTexture, p.xy);

    vec2 v = tmp.xy;
    p.xy += v * deltaTime / 10.0 * speedScaling;
    p.w -= deltaTime;

    if (spawn) {
        // Not show spawn particle
        p.z = -(dot(normalize(v.xy), vec2(0.0, 1.0)) + 1.0) * 0.5;
    }
    else {
        p.z = abs(p.z);
    }

    gl_FragColor = p;
}
@end

@export stream.renderPoints.vertex

#define PI 3.1415926

attribute vec2 texcoord : TEXCOORD_0;

uniform sampler2D particleTexture;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

uniform float size = 1.0;

varying float v_Mag;

void main()
{
    vec4 p = texture2D(particleTexture, texcoord);

    // PENDING If ignore 0 length vector
    if (p.w > 0.0 && p.z > 1e-5) {
        gl_Position = worldViewProjection * vec4(p.xy * 2.0 - 1.0, 0.0, 1.0);
    }
    else {
        gl_Position = vec4(100000.0, 100000.0, 100000.0, 1.0);
    }

    v_Mag = p.z;

    gl_PointSize = size;
}

@end

@export stream.renderPoints.fragment

uniform vec4 color = vec4(1.0, 1.0, 1.0, 1.0);
uniform sampler2D gradientTexture;
uniform sampler2D spriteTexture;

varying float v_Mag;
uniform float colorOffset = 0;

void main()
{
    gl_FragColor = color;
#ifdef SPRITETEXTURE_ENABLED
    gl_FragColor *= texture2D(spriteTexture, gl_PointCoord);
    if (color.a == 0.0) {
        discard;
    }
#endif
#ifdef GRADIENTTEXTURE_ENABLED
    gl_FragColor *= texture2D(gradientTexture, vec2(fract(v_Mag + colorOffset), 0.5));
#endif
}

@end

@export stream.renderLines.vertex

#define PI 3.1415926

attribute vec3 position : POSITION;

uniform sampler2D particleTexture;
uniform sampler2D prevParticleTexture;

uniform float size = 1.0;
uniform vec4 vp: VIEWPORT;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

varying float v_Mag;

void main()
{
    vec4 p = texture2D(particleTexture, position.xy);
    vec4 p2 = texture2D(prevParticleTexture, position.xy);

    p.xy = p.xy * 2.0 - 1.0;
    p2.xy = p2.xy * 2.0 - 1.0;

    // PENDING If ignore 0 length vector
    if (p.w > 0.0 && p.z > 1e-5) {
        vec2 dir = normalize(p.xy - p2.xy);
        vec2 norm = vec2(dir.y / vp.z, -dir.x / vp.w) * sign(position.z) * size;
        if (abs(position.z) == 2.0) {
            gl_Position = vec4(p.xy + norm, 0.0, 1.0);
            v_Mag = p.z;
        }
        else {
            gl_Position = vec4(p2.xy + norm, 0.0, 1.0);
            v_Mag = p2.z;
        }
        gl_Position = worldViewProjection * gl_Position;
    }
    else {
        gl_Position = vec4(100000.0, 100000.0, 100000.0, 1.0);
    }
}

@end

@export stream.renderLines.fragment

uniform vec4 color = vec4(1.0, 1.0, 1.0, 1.0);
uniform sampler2D gradientTexture;
uniform float colorOffset = 0;

varying float v_Mag;

void main()
{
    gl_FragColor = color;
#ifdef GRADIENTTEXTURE_ENABLED
    gl_FragColor *= texture2D(gradientTexture, vec2(fract(v_Mag + colorOffset), 0.5));
#endif
}

@end

@export stream.downsample

uniform sampler2D texture;
uniform vec2 textureSize = vec2(512, 512);

varying vec2 v_Texcoord;

void main()
{
    vec4 d = vec4(-1.0, -1.0, 1.0, 1.0) / textureSize.xyxy;

    vec4 color = texture2D(texture, v_Texcoord + d.xy);
    color += texture2D(texture, v_Texcoord + d.zy);
    color += texture2D(texture, v_Texcoord + d.xw);
    color += texture2D(texture, v_Texcoord + d.zw);
    color *= 0.25;

    gl_FragColor = color;
}

@end

@export stream.output

varying vec2 v_Texcoord;

uniform sampler2D texture;
uniform vec4 color = vec4(1, 1, 1, 1);

void main() {
    gl_FragColor = texture2D(texture, v_Texcoord);
    gl_FragColor *= color;
}
@end

@export stream.extract

uniform sampler2D texture;
varying vec2 v_Texcoord;

uniform vec4 color = vec4(0.0, 0.0, 0.0, 0.5);

void main() {
    vec4 texel = texture2D(texture, v_Texcoord);
    if (texel.a > 0.1) {
        gl_FragColor = color;
    }
    else {
        gl_FragColor = vec4(0.0);
    }
}

@end


@export stream.gaussian_blur

uniform sampler2D texture;
varying vec2 v_Texcoord;

uniform float blurSize = 2.0;
uniform vec2 textureSize = vec2(512.0, 512.0);
uniform float blurDir = 0.0;

void main (void)
{
    float kernel[9];
    kernel[0] = 0.07;
    kernel[1] = 0.09;
    kernel[2] = 0.12;
    kernel[3] = 0.14;
    kernel[4] = 0.16;
    kernel[5] = 0.14;
    kernel[6] = 0.12;
    kernel[7] = 0.09;
    kernel[8] = 0.07;

    vec2 off = blurSize / textureSize;
    off *= vec2(1.0 - blurDir, blurDir);

    vec4 sum = vec4(0.0);
    float weightAll = 0.0;

    // blur in y (horizontal)
    for (int i = 0; i < 9; i++) {
        float w = kernel[i];
        // Premultiplied Alpha
        vec4 texel = texture2D(texture, v_Texcoord + float(i - 4) * off);
        // TODO alpha blend?
        sum += texel * w;
        weightAll += w;
    }
    gl_FragColor = sum / max(weightAll, 0.01);
}

@end
