@export stream.noise
uniform float elapsedTime;

uniform vec2 turbulence = vec2(0.01, 0.02);
uniform float persistence = 0.707;

varying vec2 v_Texcoord;

//
// Description : Array and textureless GLSL 2D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : ijm
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
    return mod289(((x*34.0)+1.0)*x);
}

float snoise(vec2 v)
{
    const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                  0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                 -0.577350269189626,  // -1.0 + 2.0 * C.x
                  0.024390243902439); // 1.0 / 41.0
    // First corner
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);

    // Other corners
    vec2 i1;
    //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
    //i1.y = 1.0 - i1.x;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    // x0 = x0 - 0.0 + 0.0 * C.xx ;
    // x1 = x0 - i1 + 1.0 * C.xx ;
    // x2 = x0 - 1.0 + 2.0 * C.xx ;
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    // Permutations
    i = mod289(i); // Avoid truncation effects in permutation
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));

    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;

    // Gradients: 41 points uniformly over a line, mapped onto a diamond.
    // The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    // Normalise gradients implicitly by scaling m
    // Approximation of: m *= inversesqrt( a0*a0 + h*h );
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

    // Compute final noise value at P
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

float fBm_noise(vec2 x){
    float y = snoise(x);
    y += snoise(2.0 * x) * pow(persistence, 2.0);
    y += snoise(4.0 * x) * pow(persistence, 4.0);
    y += snoise(8.0 * x) * pow(persistence, 8.0);
    return y/1.875;
}

void main()
{
    vec2 p = (v_Texcoord * 2.0 - 1.0) * 2.0;
    p.x += sin(elapsedTime * turbulence.x);
    p.y += cos(elapsedTime * turbulence.y);

    vec3 f = vec3(0.0);
    f.x = fBm_noise(p);

    gl_FragColor = vec4(f, 1.0);
}
@end

@export stream.updateParticle

uniform sampler2D posTexture;
uniform sampler2D spawnTexture;
uniform sampler2D noiseTexture;
uniform float noiseTextureSize = 256;

uniform float deltaTime;
uniform bool firstFrame;

uniform float speedScaling = 1.0;
uniform vec4 region = vec4(0, 0, 1, 1);

varying vec2 v_Texcoord;

void main()
{
    vec4 pos = texture2D(posTexture, v_Texcoord);

    if(pos.w > 0.0 && !firstFrame){
        vec2 p = pos.xy * 0.5 + 0.5;
        float d = 1.0 / noiseTextureSize;
        // https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf
        float f = texture2D(noiseTexture, p).x;

        float fdx = texture2D(noiseTexture, p + vec2(d, 0)).x - f;
        float fdy = texture2D(noiseTexture, p + vec2(0, d)).x - f;

        vec2 v = vec2(fdy, -fdx) * 0.01 * speedScaling * noiseTextureSize;

        pos.xy += v * deltaTime;
        pos.w -= deltaTime;

        if (pos.z < 0.0) {
            pos.z = (dot(normalize(v), vec2(0.0, 1.0)) + 1.0) * 0.5;
        }
    }
    else {
        pos = texture2D(spawnTexture, v_Texcoord);
        pos.z = -1.0;
    }

    gl_FragColor = pos;
}
@end

@export stream.renderPoints.vertex

#define PI 3.1415926

attribute vec2 texcoord : TEXCOORD_0;

uniform sampler2D posTexture;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

uniform float size = 1.0;

varying float v_Mag;

void main()
{
    vec4 p = texture2D(posTexture, texcoord);

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
    gl_FragColor *= texture2D(gradientTexture, vec2(fract(colorOffset + v_Mag), 0.5));
#endif
}

@end

@export stream.renderLines.vertex

#define PI 3.1415926

attribute vec3 position : POSITION;

uniform sampler2D posTexture;
uniform sampler2D prevPosTexture;

uniform float size = 1.0;
uniform vec4 vp: VIEWPORT;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

varying float v_Mag;

void main()
{
    vec4 p = texture2D(posTexture, position.xy);
    vec4 p2 = texture2D(prevPosTexture, position.xy);

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
    gl_FragColor *= texture2D(gradientTexture, vec2(fract(colorOffset + v_Mag), 0.5));
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

uniform vec4 color = vec4(0.0, 0.0, 0.0, 1);

void main() {
    vec4 texel = texture2D(texture, v_Texcoord);
    if (texel.a > 0.5) {
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
