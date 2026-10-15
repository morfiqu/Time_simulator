/**
 * View3D.js
 * 3D-визуализация пространства-времени Минковского с помощью Three.js.
 * Ось Y — время t, горизонтальная плоскость XZ — пространство (x, y).
 * Вершина светового конуса находится в точке наблюдателя (вверху) и поднимается по таймлайну.
 * Конус расширяется вниз в прошлое и динамически меняет прозрачность кадров внутри и снаружи.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Шейдер для полупрозрачных плоскостей-кадров (срезов времени)
const layerVertexShader = `
varying vec2 vWorldXZ;
void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const layerFragmentShader = `
uniform vec2 uApexXZ;
uniform float uConeRadius;
uniform float uOpacityInside;
uniform float uOpacityOutside;
uniform vec3 uColorInside;
uniform vec3 uColorOutside;
uniform float uIsFuture;

varying vec2 vWorldXZ;

void main() {
    if (uIsFuture > 0.5) {
        if (uOpacityOutside <= 0.001) discard;
        gl_FragColor = vec4(uColorOutside, uOpacityOutside);
        return;
    }

    float dist = distance(vWorldXZ, uApexXZ);

    if (dist <= uConeRadius) {
        // Внутри светового конуса:
        if (uOpacityInside >= 0.99) {
            // Режим жесткого среза: 100% непрозрачный цвет кадра
            gl_FragColor = vec4(uColorInside, 1.0);
        } else {
            // Полупрозрачный режим с неоновым кольцом
            float ring = smoothstep(3.5, 0.0, abs(dist - uConeRadius));
            vec3 col = mix(uColorInside, vec3(0.15, 0.95, 1.0), ring * 0.85);
            float alpha = mix(uOpacityInside, min(1.0, uOpacityInside + 0.35), ring);
            gl_FragColor = vec4(col, alpha);
        }
    } else {
        // Снаружи светового конуса:
        if (uOpacityOutside <= 0.001) discard;
        gl_FragColor = vec4(uColorOutside, uOpacityOutside);
    }
}
`;

// Шейдер для фигур на слоях времени
const shapeVertexShader = `
varying vec2 vWorldXZ;
void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const shapeFragmentShader = `
uniform vec2 uApexXZ;
uniform float uConeRadius;
uniform vec3 uBaseColor;
uniform float uOpacityInside;
uniform float uOpacityOutside;
uniform float uIsFuture;

varying vec2 vWorldXZ;

void main() {
    if (uIsFuture > 0.5) {
        if (uOpacityOutside <= 0.001) discard;
        gl_FragColor = vec4(uBaseColor, uOpacityOutside);
        return;
    }

    float dist = distance(vWorldXZ, uApexXZ);

    if (dist <= uConeRadius) {
        if (uOpacityInside >= 0.99) {
            gl_FragColor = vec4(uBaseColor, 1.0);
        } else {
            float ring = smoothstep(3.0, 0.0, abs(dist - uConeRadius));
            vec3 col = mix(uBaseColor, vec3(1.0, 1.0, 1.0), ring * 0.4);
            gl_FragColor = vec4(col, uOpacityInside);
        }
    } else {
        if (uOpacityOutside <= 0.001) discard;
        gl_FragColor = vec4(uBaseColor, uOpacityOutside);
    }
}
`;

export class View3D {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        // Масштабы 3D-мира
        this.spaceSize = 400;      // Пространство XZ [-200, 200]
        this.timeHeight = this.state.timeHeight || 320; // Высота оси времени Y

        // Коллекция для быстрого обновления шейдеров каждого слоя
        this.layersData = [];

        this.initScene();
        this.buildStaticElements();
        this.bindEvents();
    }

    initScene() {
        this.scene = new THREE.Scene();
        const bg3D = this.state.settings.bg3DColor || '#070c18';
        this.scene.background = new THREE.Color(bg3D);

        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;

        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
        this.camera.position.set(380, 280, 420);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, this.timeHeight / 2, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(200, 400, 300);
        this.scene.add(dirLight);

        this.dynamicGroup = new THREE.Group();
        this.scene.add(this.dynamicGroup);

        this.layersGroup = new THREE.Group();
        this.scene.add(this.layersGroup);

        this.tubesGroup = new THREE.Group();
        this.scene.add(this.tubesGroup);

        this.staticGroup = new THREE.Group();
        this.scene.add(this.staticGroup);
    }

    buildStaticElements() {
        while (this.staticGroup.children.length > 0) {
            const obj = this.staticGroup.children[0];
            this.staticGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        const H = this.timeHeight;

        // Нижняя сетка пространства (t = 0)
        const gridFloor = new THREE.GridHelper(this.spaceSize, 20, 0x0284c7, 0x1e293b);
        gridFloor.position.y = 0;
        this.staticGroup.add(gridFloor);

        // Верхняя сетка пространства (t = duration)
        const gridCeil = new THREE.GridHelper(this.spaceSize, 20, 0x475569, 0x111c30);
        gridCeil.position.y = H;
        this.staticGroup.add(gridCeil);

        // Угловые направляющие колонны
        const corners = [
            [-this.spaceSize / 2, -this.spaceSize / 2],
            [this.spaceSize / 2, -this.spaceSize / 2],
            [this.spaceSize / 2, this.spaceSize / 2],
            [-this.spaceSize / 2, this.spaceSize / 2]
        ];

        corners.forEach(([cx, cz]) => {
            const points = [
                new THREE.Vector3(cx, 0, cz),
                new THREE.Vector3(cx, H, cz)
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 });
            this.staticGroup.add(new THREE.Line(lineGeo, lineMat));
        });

        // Центральная стрела времени (Time Arrow)
        const axisPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, H + 35, 0)
        ];
        const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPoints);
        const axisMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
        this.staticGroup.add(new THREE.Line(axisGeo, axisMat));

        const arrowGeo = new THREE.ConeGeometry(5, 15, 16);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
        arrowMesh.position.set(0, H + 35, 0);
        this.staticGroup.add(arrowMesh);

        // Обновляем цель управления камерой на центр текущей высоты
        if (this.controls) {
            this.controls.target.set(0, H / 2, 0);
        }
    }

    bindEvents() {
        this.state.on('timeUpdated', () => this.updateScene());
        this.state.on('shapesUpdated', () => this.rebuildGeometry());
        this.state.on('durationChanged', () => {
            this.rebuildGeometry();
            this.updateScene();
        });
        this.state.on('settingsChanged', () => {
            this.rebuildGeometry();
            this.updateScene();
        });

        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    timeToY(t) {
        return (t / this.state.duration) * this.timeHeight;
    }

    rebuildGeometry() {
        this.timeHeight = this.state.timeHeight;
        this.buildStaticElements();
        this.buildLayers();
        this.buildWorldTubes();
        this.updateScene();
    }

    /**
     * Построение стопки полупрозрачных слоёв времени со специализированными шейдерами
     */
    buildLayers() {
        while (this.layersGroup.children.length > 0) {
            const obj = this.layersGroup.children[0];
            this.layersGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        }

        this.layersData = [];
        if (!this.state.settings.showLayers) return;

        const count = this.state.settings.layersCount;
        const optInside = this.state.settings.layerOpacityInside ?? 0.65;
        const optOutside = this.state.settings.layerOpacityOutside ?? 0.05;
        const frameColor = new THREE.Color(this.state.settings.frameBgColor || '#133863');

        for (let i = 0; i < count; i++) {
            const t = (i / (count - 1)) * this.state.duration;
            const yPos = this.timeToY(t);

            // Шейдерный материал плоскости слоя
            const planeUniforms = {
                uApexXZ: { value: new THREE.Vector2(this.state.observer.x, this.state.observer.y) },
                uConeRadius: { value: 0.0 },
                uOpacityInside: { value: optInside },
                uOpacityOutside: { value: optOutside },
                uColorInside: { value: frameColor.clone() }, // Цвет фона кадра
                uColorOutside: { value: new THREE.Color(0x0e172a) }, // Тёмный снаружи
                uIsFuture: { value: 0.0 }
            };

            const planeGeo = new THREE.PlaneGeometry(this.spaceSize, this.spaceSize);
            planeGeo.rotateX(-Math.PI / 2);

            const planeMat = new THREE.ShaderMaterial({
                vertexShader: layerVertexShader,
                fragmentShader: layerFragmentShader,
                uniforms: planeUniforms,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const planeMesh = new THREE.Mesh(planeGeo, planeMat);
            planeMesh.position.y = yPos;
            this.layersGroup.add(planeMesh);

            // Контур рамки кадра
            const edgesGeo = new THREE.EdgesGeometry(planeGeo);
            const edgesMat = new THREE.LineBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: Math.max(0.04, optOutside * 1.5)
            });
            const frameLine = new THREE.LineSegments(edgesGeo, edgesMat);
            frameLine.position.y = yPos;
            this.layersGroup.add(frameLine);

            // Фигуры на данном слое
            const shapeMeshes = [];
            this.state.shapes.forEach(shape => {
                const s = shape.getStateAt(t, this.state.speedOfLight);
                let shapeGeo;
                if (s.type === 'circle') {
                    const rx = s.width / 2;
                    const ry = s.height / 2;
                    shapeGeo = new THREE.CircleGeometry(1, 32);
                    shapeGeo.scale(rx, ry, 1);
                } else {
                    shapeGeo = new THREE.PlaneGeometry(s.width, s.height);
                }
                shapeGeo.rotateX(-Math.PI / 2);

                const shapeUniforms = {
                    uApexXZ: { value: new THREE.Vector2(this.state.observer.x, this.state.observer.y) },
                    uConeRadius: { value: 0.0 },
                    uBaseColor: { value: new THREE.Color(s.color || shape.color) },
                    uOpacityInside: { value: this.state.settings.shapeOpacityInside ?? 0.95 },
                    uOpacityOutside: { value: this.state.settings.shapeOpacityOutside ?? 0.12 },
                    uIsFuture: { value: 0.0 }
                };

                const shapeMat = new THREE.ShaderMaterial({
                    vertexShader: shapeVertexShader,
                    fragmentShader: shapeFragmentShader,
                    uniforms: shapeUniforms,
                    transparent: true,
                    side: THREE.DoubleSide
                });

                const shapeMesh = new THREE.Mesh(shapeGeo, shapeMat);
                shapeMesh.position.set(s.x, yPos + 0.1, s.y);
                // Вращение фигуры вокруг оси времени Y
                shapeMesh.rotation.y = -s.rotation * (Math.PI / 180);
                this.layersGroup.add(shapeMesh);

                shapeMeshes.push({ mesh: shapeMesh, uniforms: shapeUniforms });
            });

            this.layersData.push({
                yPos,
                t,
                planeUniforms,
                frameLine,
                shapeMeshes
            });
        }
    }

    /**
     * Построение непрерывных мировых трубок (World-tubes)
     */
    buildWorldTubes() {
        while (this.tubesGroup.children.length > 0) {
            const obj = this.tubesGroup.children[0];
            this.tubesGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        if (!this.state.settings.showWorldTubes) return;

        const steps = 60;
        const dt = this.state.duration / steps;

        this.state.shapes.forEach(shape => {
            const corners = [
                [-0.5, -0.5],
                [0.5, -0.5],
                [0.5, 0.5],
                [-0.5, 0.5]
            ];

            const vertices = [];
            const indices = [];

            for (let step = 0; step <= steps; step++) {
                const t = step * dt;
                const yPos = this.timeToY(t);
                const s = shape.getStateAt(t, this.state.speedOfLight);

                const rad = (-s.rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                corners.forEach(([sx, sz]) => {
                    const localX = sx * s.width;
                    const localZ = sz * s.height;
                    const rotX = localX * cos - localZ * sin;
                    const rotZ = localX * sin + localZ * cos;
                    vertices.push(s.x + rotX, yPos, s.y + rotZ);
                });

                if (step > 0) {
                    const prevRow = (step - 1) * 4;
                    const currRow = step * 4;

                    for (let c = 0; c < 4; c++) {
                        const nextC = (c + 1) % 4;
                        indices.push(prevRow + c, currRow + c, prevRow + nextC);
                        indices.push(prevRow + nextC, currRow + c, currRow + nextC);
                    }
                }
            }

            const tubeGeo = new THREE.BufferGeometry();
            tubeGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            tubeGeo.setIndex(indices);
            tubeGeo.computeVertexNormals();

            const tubeMat = new THREE.MeshPhongMaterial({
                color: new THREE.Color(shape.color),
                transparent: true,
                opacity: 0.28,
                side: THREE.DoubleSide,
                shininess: 40
            });

            const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
            this.tubesGroup.add(tubeMesh);
        });
    }

    /**
     * Обновление динамических элементов:
     * 1. Вершина светового конуса поднимается вверх по оси Y (время t).
     * 2. Конус направлен ВНИЗ в прошлое (apex вверху, base внизу).
     * 3. Каждый кадр под конусом динамически обновляет радиус среза и прозрачность.
     */
    updateScene() {
        while (this.dynamicGroup.children.length > 0) {
            const obj = this.dynamicGroup.children[0];
            this.dynamicGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        const tCurr = this.state.currentTime;
        const currentY = this.timeToY(tCurr); // Позиция вершины по высоте оси времени
        const obs = this.state.observer;

        // Расчет угла светового конуса (по умолчанию 45°, tan(45°) = 1.0)
        const coneAngleDeg = this.state.settings.coneAngle ?? 45;
        const coneSlope = Math.tan(coneAngleDeg * (Math.PI / 180));

        const hardCut = this.state.settings.hardCutMode;

        // Если включен режим жесткого среза:
        // Внутри конуса: 100% непрозрачно (1.0)
        // Снаружи конуса: 0% полностью невидимо (0.0)
        const optInside = hardCut ? 1.0 : (this.state.settings.layerOpacityInside ?? 0.65);
        const optOutside = hardCut ? 0.0 : (this.state.settings.layerOpacityOutside ?? 0.05);
        const shapeOptInside = hardCut ? 1.0 : (this.state.settings.shapeOpacityInside ?? 0.95);
        const shapeOptOutside = hardCut ? 0.0 : (this.state.settings.shapeOpacityOutside ?? 0.12);
        const coneOpacity = this.state.settings.coneOpacity ?? 0.25;

        // Обновляем фон 3D сцены
        if (this.scene && this.state.settings.bg3DColor) {
            this.scene.background.set(this.state.settings.bg3DColor);
        }

        const frameColor = new THREE.Color(this.state.settings.frameBgColor || '#133863');

        // 1. Обновляем шейдеры всех слоёв времени
        this.layersData.forEach(layer => {
            const isFuture = layer.yPos > currentY;
            // Глубина времени от вершины вниз до данного слоя
            const deltaY = currentY - layer.yPos;
            const radiusAtLayer = (!isFuture && deltaY >= 0) ? (deltaY * coneSlope) : 0.0;

            // В режиме жесткого среза прямоугольные контуры рамок скрываются
            if (layer.frameLine) {
                layer.frameLine.visible = !hardCut;
            }

            // Обновляем униформы плоскости слоя
            layer.planeUniforms.uApexXZ.value.set(obs.x, obs.y);
            layer.planeUniforms.uConeRadius.value = radiusAtLayer;
            layer.planeUniforms.uOpacityInside.value = optInside;
            layer.planeUniforms.uOpacityOutside.value = optOutside;
            layer.planeUniforms.uColorInside.value.copy(frameColor);
            layer.planeUniforms.uIsFuture.value = isFuture ? 1.0 : 0.0;

            // Обновляем униформы фигур на этом слое
            layer.shapeMeshes.forEach(sm => {
                sm.uniforms.uApexXZ.value.set(obs.x, obs.y);
                sm.uniforms.uConeRadius.value = radiusAtLayer;
                sm.uniforms.uOpacityInside.value = shapeOptInside;
                sm.uniforms.uOpacityOutside.value = shapeOptOutside;
                sm.uniforms.uIsFuture.value = isFuture ? 1.0 : 0.0;
            });
        });

        // 2. Линия жизни наблюдателя (Observer Worldline)
        const obsLinePoints = [
            new THREE.Vector3(obs.x, 0, obs.y),
            new THREE.Vector3(obs.x, this.timeHeight, obs.y)
        ];
        const obsLineGeo = new THREE.BufferGeometry().setFromPoints(obsLinePoints);
        const obsLineMat = new THREE.LineDashedMaterial({
            color: 0xfacc15,
            dashSize: 4,
            gapSize: 4,
            linewidth: 2
        });
        const obsLine = new THREE.Line(obsLineGeo, obsLineMat);
        obsLine.computeLineDistances();
        this.dynamicGroup.add(obsLine);

        // 3. Вершина конуса — точка наблюдателя "Здесь и сейчас"
        const apexSphereGeo = new THREE.SphereGeometry(5, 16, 16);
        const apexSphereMat = new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0xeab308,
            emissiveIntensity: 0.9
        });
        const apexSphere = new THREE.Mesh(apexSphereGeo, apexSphereMat);
        apexSphere.position.set(obs.x, currentY, obs.y);
        this.dynamicGroup.add(apexSphere);

        // 4. Световой конус прошлого (Past Light Cone)
        // В режиме жесткого среза (hardCutMode) конус полностью отключается (становится невидимым)
        if (this.state.settings.showLightCone && !hardCut && currentY > 1.0) {
            const coneHeight = currentY;
            const baseRadius = coneHeight * coneSlope; // Радиус на плоскости t = 0

            // Создаем геометрию конуса (apex вверху, base внизу, открытое дно)
            const coneGeo = new THREE.ConeGeometry(baseRadius, coneHeight, 48, 1, true);

            const coneMat = new THREE.MeshPhongMaterial({
                color: 0x00f5ff,
                transparent: true,
                opacity: coneOpacity,
                side: THREE.DoubleSide,
                depthWrite: false,
                shininess: 90
            });

            const coneMesh = new THREE.Mesh(coneGeo, coneMat);
            coneMesh.position.set(obs.x, currentY / 2, obs.y);
            this.dynamicGroup.add(coneMesh);

            // Каркас конуса
            const wireConeMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                wireframe: true,
                transparent: true,
                opacity: coneOpacity * 0.8
            });
            const wireConeMesh = new THREE.Mesh(coneGeo, wireConeMat);
            wireConeMesh.position.copy(coneMesh.position);
            this.dynamicGroup.add(wireConeMesh);

            // Нижнее кольцо среза на плоскости t = 0
            const ringGeo = new THREE.RingGeometry(baseRadius - 1.5, baseRadius + 1.5, 64);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00f5ff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.set(obs.x, 0.2, obs.y);
            this.dynamicGroup.add(ringMesh);
        }
    }

    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }
}
