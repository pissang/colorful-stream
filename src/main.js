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

import * as colorBrewer from 'd3-scale-chromatic';

var brewerMethods = [
    'BrBG', 'PRGn', 'PiYG', 'PuOr', 'RdBu', 'RdGy', 'RdYlBu', 'RdYlGn', 'Spectral',
    'Viridis', 'Inferno', 'Magma', 'Plasma', 'Warm', 'Cool', 'Rainbow', 'YlGnBu', 'RdPu', 'PuRd',
    'Rainbow'
].map(function (a) {
    return 'interpolate' + a;
});

var M = 200;

var renderer = new Renderer({
    canvas: document.getElementById('main')
});
var timeline = new Timeline();
timeline.start();

var config = {
    seed: Math.random(),
    scale: 1,
    particleType: 'line',
    supersampling: 2,
    particleSize: 3,
    particleDensity: 128,
    particleSpeed: 1
};

function generateSimplexField() {
    var simplex = new SimplexNoise(Math.random);
    var simplex2 = new SimplexNoise(Math.random);
    var scale = Math.max(config.scale, 1);
    var values = new Float32Array(M * M * 4);
    var i = 0;
    for (var x = 0; x < M; x++) {
        for (var y = 0; y < M; y++) {
            var m = x / M * scale;
            var n = y / M * scale;
            values[i++] = simplex.noise2D(m, n);
            values[i++] = 0.0;
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
    var method = colorBrewer[brewerMethods[Math.round(Math.random() * (brewerMethods.length - 1))]];
    for (var i = 0; i < 10; i++) {
        colorList.push(method(i / 9));
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

var gradientTexture = new Texture2D({
    image: generateGradientImage()
});
var streamSurface = new VectorFieldSurface();
var shadowSurface = new DropShadowSurface();
streamSurface.setSupersampling(config.supersampling);
streamSurface.setParticleType(config.particleType);
streamSurface.setParticleSize(config.particleSize);
streamSurface.particleSpeedScaling = config.particleSpeed;
// streamSurface.noiseTexture.pixels = generateSimplexField();
// streamSurface.noiseTexture.width = streamSurface.noiseTexture.height = M;
streamSurface.particleLife = 5;

streamSurface.setParticleDensity(config.particleDensity, config.particleDensity);
streamSurface.setGradientTexture(gradientTexture);
streamSurface.generateSpawnTexture(128, 128);

var backgroundQuad = new Mesh({
    material: createMaterial(),
    geometry: planeGeo
});
backgroundQuad.material.transparent = false;
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
    frameTime = Math.min(frameTime, 50);
    // if (streamSurface.particleSpeedScaling < 0.1) {
    //     return;
    // }
    if (elpasedTime > 5000) {
        streamSurface.generateSpawnTexture(128, 128);
        streamSurface.particleSpeedScaling = config.particleSpeed * (Math.random() + 0.2);
        // streamSurface.particleSpeedScaling /= 1.2;
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
    // backgroundQuad.material.set('texture', forceFieldTexture);

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