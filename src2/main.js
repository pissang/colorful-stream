import VectorFieldSurface from './VectorFieldSurface';
import DropShadowSurface from './DropShadowSurface';
import SimplexNoise from 'simplex-noise';
import Timeline from 'claygl/src/Timeline';
import Renderer from 'claygl/src/Renderer';
import Texture2D from 'claygl/src/Texture2D';
import Texture from 'claygl/src/Texture';
import OrthoCamera from 'claygl/src/camera/Orthographic';
import Shader from 'claygl/src/Shader';
import PlaneGeometry from 'claygl/src/geometry/Plane';
import Mesh from 'claygl/src/Mesh';
import Material from 'claygl/src/Material';

import { interpolatePlasma } from 'd3-scale-chromatic';

var M = 200;
var N = 200;

var renderer = new Renderer({
    canvas: document.getElementById('main')
});
var timeline = new Timeline();
timeline.start();

var config = {
    seed: Math.random(),
    scale: 0.2,
    particleType: 'line',
    supersampling: 2,
    particleSize: 3,
    particleDensity: 128,
    particleSpeed: 1
};

function generateSimplexField() {
    var simplex = new SimplexNoise(function () {
        return config.seed;
    });
    var simplex2 = new SimplexNoise(function () {
        return config.seed + 0.5;
    });
    var simplex3 = new SimplexNoise(function () {
        return config.seed2 + 0.8;
    });
    var scale = Math.max(config.scale, 1);
    var values = new Float32Array(M * N * 4);
    var i = 0;
    for (var x = 0; x < M; x++) {
        for (var y = 0; y < N; y++) {
            var m = x / M * scale;
            var n = y / N * scale;
            values[i++] = simplex.noise2D(m, n);
            values[i++] = simplex2.noise2D(m, n);
            values[i++] = (simplex3.noise2D(m, n) + 1) * 0.5;
            values[i++] = 1;
        }
    }

    return values;
}

function randomColor() {
    return 'rgb(' + [0, 0, 0].map(function () {
        return Math.round(Math.random() * 255);
    }).join(',') + ')';
}

function generateGradientImage() {
    var canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 6;
    var ctx = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2);

    var colorList = [];
    for (var i = 0; i < 10; i++) {
        colorList.push(interpolatePlasma(i / 9));
    }
    for (var i = 0; i < colorList.length; i++) {
        gradient.addColorStop(i / (colorList.length - 1), colorList[i]);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

var camera = new OrthoCamera();

var quadShader = new Shader(
    Shader.source('clay.compositor.vertex'),
    Shader.source('stream.output')
);
var quads = [];
var streamQuads = [];
var shadowQuads = [];
var planeGeo = new PlaneGeometry();

function createMaterial() {
    return new Material({
        shader: quadShader,
        transparent: true,
        depthMask: false,
        depthTest: false
    });
}

var forceFieldTexture = new Texture2D({
    type: Texture.FLOAT,
    flipY: false,
    width: M,
    height: N,
    pixels: generateSimplexField()
});
var gradientTexture = new Texture2D({
    image: generateGradientImage()
});
// TODO texture pool.
for (var i = 0; i < 10; i++) {
    var streamSurface = new VectorFieldSurface();
    var shadowSurface = new DropShadowSurface();
    streamSurface.setSupersampling(config.supersampling);
    streamSurface.setParticleType(config.particleType);
    streamSurface.setParticleSize(config.particleSize);
    streamSurface.particleSpeedScaling = config.particleSpeed;
    streamSurface.particleLife = 10;

    streamSurface.setParticleDensity(config.particleDensity, config.particleDensity);
    streamSurface.forceFieldTexture = forceFieldTexture;
    streamSurface.setGradientTexture(gradientTexture);
    streamSurface.generateSpawnTexture(256, 256);

    var shadowQuad = new Mesh({
        material: createMaterial(),
        geometry: planeGeo
    });
    shadowQuad.surface = shadowSurface;

    var streamQuad = new Mesh({
        material: createMaterial(),
        geometry: planeGeo
    });
    streamQuad.surface = streamSurface;

    quads.push(shadowQuad);
    quads.push(streamQuad);

    shadowQuads.push(shadowQuad);
    streamQuads.push(streamQuad);
}

var frame = 0;
var elpasedTime = 0;
function update(frameTime) {
    var idx = Math.floor(elpasedTime / 5000);
    var streamQuad = streamQuads[idx];
    var shadowQuad = shadowQuads[idx];
    if (!streamQuad) {
        renderer.renderPass(quads, camera);
        return;
    }

    streamQuad.surface.update(renderer, frameTime, frame);
    streamQuad.material.set('texture', streamQuad.surface.getSurfaceTexture());
    shadowQuad.surface.update(renderer, streamQuad.surface.getSurfaceTexture());
    shadowQuad.material.set('texture', shadowQuad.surface.getSurfaceTexture());

    frame++;

    camera.update(true);
    renderer.renderPass(quads, camera);

    elpasedTime += frameTime;
}

function resize() {
    renderer.resize(renderer.canvas.clientWidth, renderer.canvas.clientHeight);
    streamQuads.forEach(function (quad) {
        quad.surface.clearFrame(renderer);
        quad.surface.resize(renderer.getWidth(), renderer.getHeight());
    });
}

timeline.on('frame', update);

resize();
window.addEventListener('resize', resize);

var loadingEl = document.getElementById('loading');
loadingEl.parentNode.removeChild(loadingEl);