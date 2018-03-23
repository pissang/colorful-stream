import Pass from 'claygl/src/compositor/Pass';
import Shader from 'claygl/src/Shader';
import FrameBuffer from 'claygl/src/FrameBuffer';
import Texture2D from 'claygl/src/Texture2D';

function DropShadowSurface() {

    this._extractPass = new Pass({
        fragment: Shader.source('stream.extract')
    });

    this._blurPass1 = new Pass({
        fragment: Shader.source('stream.gaussian_blur')
    });
    this._blurPass2 = new Pass({
        fragment: Shader.source('stream.gaussian_blur')
    });
    this._blurPass2.setUniform('blurDir', 1);

    this._framebuffer = new FrameBuffer({
        depthBuffer: false
    });

    this._bwTexture = new Texture2D();
    this._blurTexture = new Texture2D();
}

DropShadowSurface.prototype.update = function (renderer, sourceTexture) {
    var width = sourceTexture.width;
    var height = sourceTexture.height;

    this._bwTexture.width = width / 4;
    this._bwTexture.height = height / 4;
    this._blurTexture.width = width / 4;
    this._blurTexture.height = height / 4;

    var framebuffer = this._framebuffer;
    framebuffer.bind(renderer);

    framebuffer.attach(this._bwTexture);
    this._extractPass.setUniform('texture', sourceTexture);
    this._extractPass.setUniform('textureSize', [width, height]);
    this._extractPass.render(renderer);

    framebuffer.attach(this._blurTexture);
    this._blurPass1.setUniform('texture', this._bwTexture);
    this._blurPass1.setUniform('textureSize', [width / 4, height / 4]);
    this._blurPass1.render(renderer);


    framebuffer.attach(this._bwTexture);
    this._blurPass2.setUniform('texture', this._blurTexture);
    this._blurPass2.setUniform('textureSize', [width / 4, height / 4]);
    this._blurPass2.render(renderer);

    framebuffer.unbind(renderer);
};

DropShadowSurface.prototype.getSurfaceTexture = function () {
    return this._bwTexture;
};


export default DropShadowSurface;