import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, loader;
let currentModel;

function createCustomShaderMaterial(originalMaterial) {
	return new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0 },
			dissolve: { value: 0 },
			map: { value: originalMaterial.map },
			diffuse: { value: originalMaterial.color },
		},
		vertexShader: `
			uniform float time;
			uniform float dissolve;
			varying vec2 vUv;
			varying vec3 vNormal;

			float random(vec3 scale, float seed) {
				return fract(sin(dot(gl_Position.xyz + seed, scale)) * 43758.5453 + seed);
			}

			void main() {
				vUv = uv;
				vNormal = normal;
				vec3 pos = position;
				
        float r = random(vec3(12.9898, 78.233, 37.719), length(position));
        float noise = sin(pos.x * 10.0 + time) * cos(pos.y * 8.0 + time) * sin(pos.z * 9.0 + time);
        vec3 direction = normalize(pos) * (r - 0.5);
        pos += direction * dissolve * 30.0 + vec3(noise) * dissolve * 5.0;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
		`,
		fragmentShader: `
			uniform sampler2D map;
			uniform vec3 diffuse;
			uniform float dissolve;
			varying vec2 vUv;
			varying vec3 vNormal;

			void main() {
				vec4 texColor = texture2D(map, vUv);
				vec3 color = texColor.rgb * diffuse;
				float alpha = texColor.a * (1.0 - dissolve);
				gl_FragColor = vec4(color, alpha);
			}
		`,
		transparent: true,
	});
}

function init() {
  // 씬
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);

  // 카메라
	camera = new THREE.PerspectiveCamera(105, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.z = 10;

  // 라이팅
	const light = new THREE.AmbientLight(0xffffff, 1);
	scene.add(light);
  
  // 렌더
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

  // 컨트롤
	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;

  // 모델 로드
	loader = new GLTFLoader();
	loadModel('model1.glb', (model) => {
		model.userData.modelName = 'model1.glb';
		currentModel = model;
		scene.add(currentModel);
		console.log('Initial model loaded: model1.glb');

		const box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		
		camera.position.set(0, 0, maxDim * 2);
		camera.lookAt(0, 0, 0);

		controls.target.set(0, 0, 0);
	});

	animate();
}

function loadModel(path, callback) {
	loader.load(path, function (gltf) {
		const model = gltf.scene;
		const box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		const scale = 5 / maxDim;

		model.position.set(0, 0, 0);
		model.scale.setScalar(scale);
		model.traverse((child) => {
			if (child.isMesh) {
				child.geometry.center();
				const customMaterial = createCustomShaderMaterial(child.material);
				child.material = customMaterial;
			}
		});

		callback(model);
	}, undefined, function (error) {
		console.error('An error happened during loading model:', error);
	});
}

function changeModel() {
	if (currentModel) {
		const nextModelPath = currentModel.userData.modelName === 'model1.glb' ? 'model2.glb' : 'model1.glb';
		
		let startTime = performance.now();
		let duration = 3000;

		function animateDissolve() {
			let elapsed = performance.now() - startTime;
			let progress = Math.min(elapsed / duration, 1);
			
			currentModel.traverse((child) => {
				if (child.isMesh) {
					child.material.uniforms.dissolve.value = progress;
					child.material.uniforms.time.value = elapsed / 1000;
				}
			});
			
			if (progress < 1) {
				requestAnimationFrame(animateDissolve);
			} else {
				scene.remove(currentModel);
				loadModel(nextModelPath, (model) => {
					model.userData.modelName = nextModelPath;
					currentModel = model;
					scene.add(currentModel);
					console.log(`New model added: ${nextModelPath}`);
					
					reverseDissolveAnimation(model);
				});
			}
		}

		animateDissolve();
	} else {
		loadModel('model1.glb', (model) => {
			model.userData.modelName = 'model1.glb';
			currentModel = model;
			scene.add(currentModel);
			console.log('Initial model loaded: model1.glb');
		});
	}
}

function reverseDissolveAnimation(model) {
	let startTime = performance.now();
	let duration = 3000;

	function animateReverse() {
		let elapsed = performance.now() - startTime;
		let progress = Math.max(1 - (elapsed / duration), 0);
		
		model.traverse((child) => {
			if (child.isMesh) {
				child.material.uniforms.dissolve.value = progress;
				child.material.uniforms.time.value = elapsed / 1000;
			}
		});
		
		if (progress > 0) {
			requestAnimationFrame(animateReverse);
		}
	}

	animateReverse();
}

function animate() {
	requestAnimationFrame(animate);
	controls.update();
	renderer.render(scene, camera);
}

init();

document.getElementById('changeModel').addEventListener('click', changeModel);