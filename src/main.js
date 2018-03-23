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
import FrameBuffer from 'claygl/src/FrameBuffer';

import { interpolateSpectral } from 'd3-scale-chromatic';

var M = 200;
var N = 200;

var renderer = new Renderer({
    canvas: document.getElementById('main')
});
var timeline = new Timeline();
timeline.start();

var config = {
    seed: Math.random(),
    scale: 2,
    particleType: 'line',
    supersampling: 2,
    particleSize: 3,
    particleDensity: 128,
    particleSpeed: 2
};

function generateSimplexField() {
    var simplex = new SimplexNoise(Math.random);
    var simplex2 = new SimplexNoise(Math.random);
    var scale = Math.max(config.scale, 1);
    var values = new Float32Array(M * N * 4);
    var i = 0;
    for (var x = 0; x < M; x++) {
        for (var y = 0; y < N; y++) {
            var m = x / M * scale;
            var n = y / N * scale;
            // https://gist.github.com/jaycody/9502284
            var angle = simplex.noise2D(m, n) * Math.PI;
            var vx = Math.cos(angle);
            var vy = Math.sin(angle);
            values[i++] = vx;
            values[i++] = vy;
            values[i++] = (simplex2.noise2D(m, n) + 1) * 0.5;
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
        colorList.push(interpolateSpectral(i / 9));
    }
    for (var i = 0; i < colorList.length; i++) {
        gradient.addColorStop(i / (colorList.length - 1), colorList[i]);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

var camera = new OrthoCamera();

var bakedTexture = new Texture2D();
var bakedTexture2 = new Texture2D();

var quadShader = new Shader(
    Shader.source('clay.compositor.vertex'),
    Shader.source('stream.output')
);
var planeGeo = new PlaneGeometry();

function createMaterial() {
    return new Material({
        shader: quadShader,
        transparent: true,
        depthMask: false,
        depthTest: false
    });
}

var vectorFieldTexture = new Texture2D({
    type: Texture.FLOAT,
    flipY: false,
    width: M,
    height: N,
    pixels: generateSimplexField()
});
var gradientTexture = new Texture2D({
    image: generateGradientImage()
});
var streamSurface = new VectorFieldSurface();
var shadowSurface = new DropShadowSurface();
streamSurface.setSupersampling(config.supersampling);
streamSurface.setParticleType(config.particleType);
streamSurface.setParticleSize(config.particleSize);
streamSurface.particleSpeedScaling = config.particleSpeed;
streamSurface.particleLife = [5, 5];

streamSurface.setParticleDensity(config.particleDensity, config.particleDensity);
streamSurface.vectorFieldTexture = vectorFieldTexture;
streamSurface.setGradientTexture(gradientTexture);
streamSurface.generateSpawnTexture(256, 256);

var backgroundQuad = new Mesh({
    material: createMaterial(),
    geometry: planeGeo
});
var shadowQuad = new Mesh({
    material: createMaterial(),
    geometry: planeGeo
});

var streamQuad = new Mesh({
    material: createMaterial(),
    geometry: planeGeo
});

var frame = 0;
var elpasedTime = 0;

var frameBuffer = new FrameBuffer({
    depthBuffer: false
});
function bakeBackground() {
    frameBuffer.bind(renderer);
    frameBuffer.attach(bakedTexture2);
    renderer.renderPass([backgroundQuad, shadowQuad, streamQuad], camera);
    frameBuffer.unbind(renderer);

    var tmp = bakedTexture;
    bakedTexture = bakedTexture2;
    bakedTexture2 = tmp;
}

function reset() {
    frame = 0;
    streamSurface.clearFrame(renderer);
    elpasedTime = 0;
}
var iterate = 0;
function update(frameTime) {
    if (streamSurface.particleSpeedScaling < 0.2) {
        return;
    }
    if (elpasedTime > 5000) {
        streamSurface.generateSpawnTexture(256, 256);
        // streamSurface.particleSpeedScaling = config.particleSpeed * (Math.random() + 0.2);
        streamSurface.particleSpeedScaling /= 1.2;
        streamSurface.colorOffset = Math.random();
        bakeBackground();
        reset();
        iterate++;
    }

    streamSurface.update(renderer, frameTime, frame);
    streamQuad.material.set('texture', streamSurface.getSurfaceTexture());
    shadowSurface.update(renderer, streamSurface.getSurfaceTexture());
    shadowQuad.material.set('texture', shadowSurface.getSurfaceTexture());

    backgroundQuad.material.set('texture', bakedTexture);
    // backgroundQuad.material.set('texture', vectorFieldTexture);

    frame++;

    camera.update(true);
    renderer.renderPass([backgroundQuad, shadowQuad, streamQuad], camera);

    elpasedTime += frameTime;
}

function resize() {
    reset();
    var width = renderer.canvas.clientWidth;
    var height = renderer.canvas.clientHeight;
    renderer.resize(width, height);
    streamSurface.resize(width, height);

    bakedTexture.width = width;
    bakedTexture.height = height;

    bakedTexture2.width = width;
    bakedTexture2.height = height;
}

timeline.on('frame', update);

resize();
window.addEventListener('resize', resize);

var loadingEl = document.getElementById('loading');
loadingEl.parentNode.removeChild(loadingEl);