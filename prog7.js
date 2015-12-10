/**
* CSC 4356 Project 7
* Matthew Wolff
* Scene with semitransparent minimap
*/

//Containers
var canvas;
var gl;

//Models
var chestModel;
var squareModel;
var markerModel;
var teapotModel;

//Shaders
var lightShader;
var hudShader;
var modelShader;
var appleShader;

//framebuffer  and textures
var colorTexture;
var depthTexture;
var framebuffer;

//minimap's framebuffer and textures
var mColorTexture;
var mDepthTexture;
var mFramebuffer;

/**
*	NOTE: This implementation (at the time of writing this comment)
* disables scene rotation via mouse.
*	This was intentional, the complexity of the mathematics
*	involved for rotating the minimap and/or keeping the marker's movement
*	accurate was too large.
*/

//Tumble variables
var modelRotationX = 0;
var modelRotationY = 0;
var dragging = false;
var lastClientX;
var lastClientY;

//movement variables
var xpos = 0.0;
var zpos = -2.5;

function flatten(a) {
	return a.reduce(function (b,v) { b.push.apply(b,v); return b}, []);
}

function keydown(event) {
	switch (event.keyIdentifier) {
		case "U+0057":
			zpos += .05;
			requestAnimationFrame(draw);
			break;
		case "U+0041":
			xpos += .05;
			requestAnimationFrame(draw);
			break;
		case "U+0053":
			zpos -= .05;
			requestAnimationFrame(draw);
			break;
		case "U+0044":
			xpos -= .05;
			requestAnimationFrame(draw);
			break;
		default:
			console.log("discarding key "+event.keyIdentifier);
	}
	console.log(xpos,zpos);
}

/**
 * An object representing a 3D WebGL Model.
 * @param data the JSON-encoded data needed for the Model
 *
 *
 */
function Model(data) {
	this.positionBuffer = gl.createBuffer();
	this.triangleBuffer = gl.createBuffer();
	this.normalBuffer = gl.createBuffer();
	this.tangentBuffer = gl.createBuffer();
	this.texCoordBuffer = gl.createBuffer();

	var positionArray = new Float32Array(flatten(data.positions));
	gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positionArray, gl.STATIC_DRAW);

	if(data.normals) {
	var normArray = new Float32Array(flatten(data.normals));
	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, normArray, gl.STATIC_DRAW);
}

	var triangleArray = new Uint16Array(flatten(data.triangles));
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleArray, gl.STATIC_DRAW);

	if(data.tangents) {
	var tangentArray = new Float32Array(flatten(data.tangents));
	gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, tangentArray, gl.STATIC_DRAW);
}

	if(data.texCoords) {
		var texCoordArray = new Float32Array(flatten(data.texCoords));
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, texCoordArray, gl.STATIC_DRAW);
	}

	this.triangleArrayLength = triangleArray.length;
}

/**
 * Draw the Model with the provided shader
 * @param shader the shader with which to draw this model.
 */
Model.prototype.draw = function(shader) {

	if(shader.vertexPositionLocation != -1) {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
	gl.vertexAttribPointer(shader.vertexPositionLocation, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.vertexPositionLocation);
}

  if(shader.vertexNormalLocation != -1) {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.vertexAttribPointer(shader.vertexNormalLocation, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.vertexNormalLocation);
}

  if(shader.vertexTexCoordLocation != -1) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.vertexAttribPointer(shader.vertexTexCoordLocation, 2, gl.FLOAT, false,0,0);
		gl.enableVertexAttribArray(shader.vertexTexCoordLocation);
	}

  if(shader.vertexTangentLocation != -1) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
		gl.vertexAttribPointer(shader.vertexTangentLocation, 3, gl.FLOAT, false, 0,0);
		gl.enableVertexAttribArray(shader.vertexTangentLocation);
	}

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleBuffer);
	gl.drawElements(gl.TRIANGLES, this.triangleArrayLength, gl.UNSIGNED_SHORT, 0);

	if(shader.vertexPositionLocation != -1) {
		gl.disableVertexAttribArray(shader.vertexPositionLocation);
	}
	if(shader.vertexNormalLocation != -1) {
		gl.disableVertexAttribArray(shader.vertexNormalLocation);
	}
	if(shader.vertexTexCoordLocation != -1) {
		gl.disableVertexAttribArray(shader.vertexTexCoordLocation);
	}
	if(shader.vertexTangentLocation != -1) {
		gl.disableVertexAttribArray(shader.vertexTangentLocation);
	}
}

/**
 * An object representing a pair of GLSL Shaders embedded within HTML.
 * @param vertexShaderId the DOM element id of the vertex shader.
 * @param fragmentShaderId the DOM element id of the fragment shader.
 */
function Shader(vertexShaderId, fragmentShaderId) {
	var vertexSource = document.getElementById(vertexShaderId).text;
	var fragmentSource = document.getElementById(fragmentShaderId).text;
	this.program = createProgram(gl, vertexSource, fragmentSource);
	gl.useProgram(this.program);

	this.projectionMatrixLocation = gl.getUniformLocation(this.program, "projectionMatrix");
	this.modelMatrixLocation = gl.getUniformLocation(this.program, "modelMatrix");
	this.viewMatrixLocation = gl.getUniformLocation(this.program, "viewMatrix");
	this.lightPositionLocation = gl.getUniformLocation(this.program, "lightPosition");

	this.vertexNormalLocation = gl.getAttribLocation(this.program,'vertexNormal');
	this.vertexPositionLocation = gl.getAttribLocation(this.program,'vertexPosition');
	this.vertexTexCoordLocation = gl.getAttribLocation(this.program, "vertexTexCoord");
	this.vertexTangentLocation = gl.getAttribLocation(this.program, "vertexTangent");

  var diffuseLocation = gl.getUniformLocation(this.program, 'diffuseTexture');

	if(diffuseLocation) {
	gl.uniform1i(gl.getUniformLocation(this.program, 'diffuseTexture'),0);
	gl.uniform1i(gl.getUniformLocation(this.program, 'specularTexture'),1);
	gl.uniform1i(gl.getUniformLocation(this.program, 'normalTexture'),2);
	}

	var colorLocation = gl.getUniformLocation(this.program, 'colorTexture');
	if(colorLocation) {
		gl.uniform1i(gl.getUniformLocation(this.program,'colorTexture'),3);
	}

	var minimapTextureLocation = gl.getUniformLocation(this.program, 'minimapTexture');
	if(minimapTextureLocation) {
		gl.uniform1i(minimapTextureLocation, 5);
	}
}

/**
 * Prepare this shader for rendering.
 * @param projectionMatrix the projection matrix (cuon-matrix.Matrix4) to use when rendering
 * @param viewMatrix the view matrix (cuon-matrix.Matrix4) to use when rendering
 * @param modelMatrix the model matrix (cuon-matrix.Matrix4) to use when rendering
 */
Shader.prototype.setup = function(projectionMatrix, viewMatrix, modelMatrix) {
	gl.useProgram(this.program);

	if(projectionMatrix) {
	gl.uniformMatrix4fv(this.projectionMatrixLocation, false, projectionMatrix.elements);
	gl.uniformMatrix4fv(this.viewMatrixLocation, false, viewMatrix.elements);
	gl.uniform4fv(this.lightPositionLocation, new Float32Array([0.0,0.0,2.0,0.8]));
}
	if(modelMatrix) {
		gl.uniformMatrix4fv(this.modelMatrixLocation, false, modelMatrix.elements);
	}

}

function init() {
	canvas = document.getElementById("webgl");
	gl = getWebGLContext(canvas, false);
	gl.getExtension("webgl_depth_texture");
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);

	window.onkeydown = keydown;

	chestModel = new Model(chest);
	lightShader = new Shader("lightVertexShader","lightFragmentShader");

	teapotModel = new Model(teapot);
	appleShader = new Shader("appleVertexShader","appleFragmentShader");

	//create a square model, need to change constructor to eliminate undefined values
	squareModel = new Model(square);
	//get shaders for each thing, for now nothing
	hudShader = new Shader("hudVertexShader","hudFragmentShader");

	markerModel = new Model(cube);
	markerShader = new Shader("markerVertexShader","markerFragmentShader");

  //prepare the color texture
	colorTexture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, colorTexture);
	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,500,500,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	//Prepare the depth texture
	depthTexture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, depthTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, 500,500,0,gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	//prepare the framebuffer
	framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture,0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture,0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);


	//do it again for the minimap's resources
	mColorTexture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, mColorTexture);
	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,500,500,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	//Prepare the depth texture
	mDepthTexture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE6);
	gl.bindTexture(gl.TEXTURE_2D, mDepthTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, 500,500,0,gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	//prepare the framebuffer
	mFramebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, mFramebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mColorTexture,0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, mDepthTexture,0);

	//just for safety, rebind the on-screen buffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	//Get the textures for the chest
	var diffuseTexture = gl.createTexture();
	var diffuseImage = new Image();
	diffuseImage.onload = function() {
		loadTexture(gl.TEXTURE0, diffuseImage, diffuseTexture);
	};
	diffuseImage.crossOrigin = "anonymous";
	diffuseImage.src = "http://i.imgur.com/7thU1gD.jpg";

	var specularTexture = gl.createTexture();
	var specularImage = new Image();
	specularImage.onload = function() {
		loadTexture(gl.TEXTURE1, specularImage, specularTexture);
	}
  specularImage.crossOrigin = "anonymous";
	specularImage.src = "https://dl.dropboxusercontent.com/u/37873577/chest-specular.png";

	var normalTexture = gl.createTexture();
	var normalImage = new Image();
	normalImage.onload = function() {
		loadTexture(gl.TEXTURE2, normalImage, normalTexture);
	}
	normalImage.crossOrigin = "anonymous";
	normalImage.src = "https://dl.dropboxusercontent.com/u/37873577/chest-normal.png";

	requestAnimationFrame(draw);
}

function loadTexture(unit, image, texture) {
	gl.activeTexture(unit);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.activeTexture(gl.TEXTURE0);
	requestAnimationFrame(draw);
}

function draw() {
	//Create required matrices
	var projectionMatrix = (new Matrix4()).setPerspective(45,1,1,10);
	var viewMatrix = (new Matrix4()).setTranslate(xpos,0,zpos);
	//A separate model matrix for each model is more elegant in my opinion.
	var chestModelMatrix = (new Matrix4()).setRotate(modelRotationX,1,0,0).rotate(modelRotationY,0,1,0);
	var teapotModelMatrix = (new Matrix4()).setRotate(modelRotationX,1,0,0).rotate(modelRotationY,0,1,0).translate(1,-.5,-1.5);

  //bind the framebuffer object with color and depth texture attachments
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.clearColor(1.0,1.0,1.0,1.0);
	gl.enable(gl.DEPTH_TEST);

	lightShader.setup(projectionMatrix, viewMatrix, chestModelMatrix);
	chestModel.draw(lightShader);
	appleShader.setup(projectionMatrix, viewMatrix, teapotModelMatrix);
	teapotModel.draw(appleShader);

	//now do it again for the minimap
	var miniView = (new Matrix4()).setTranslate(-2.5+xpos,-3.5-zpos,-10);
	var miniChestModel = (new Matrix4()).setRotate(90,1,0,0).rotate(0,0,1,0);
	var miniTeapotModel = (new Matrix4()).setRotate(90,1,0,0).rotate(0,0,1,0).translate(1,-.5,-1.5);
	gl.bindFramebuffer(gl.FRAMEBUFFER, mFramebuffer);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.clearColor(1.0,1.0,1.0,1.0);
	gl.enable(gl.DEPTH_TEST);

	lightShader.setup(projectionMatrix, miniView, miniChestModel);
	chestModel.draw(lightShader);
	appleShader.setup(projectionMatrix, miniView, miniTeapotModel);
	teapotModel.draw(appleShader);

	//render the markerModel
	var markerMatrix = (new Matrix4()).setTranslate(-0.6,-0.6,0);
	markerShader.setup(null,null,markerMatrix);
	markerModel.draw(markerShader);

	//bind null framebuffer object to re-enable on screen rendering
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.enable(gl.DEPTH_TEST);
	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, colorTexture);
	
	//render square
	hudShader.setup();
	squareModel.draw(hudShader);
	gl.bindTexture(gl.TEXTURE_2D, null);
}
