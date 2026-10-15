/**
 * View3D.js
 * 3D-визуализация пространства-времени Минковского с помощью Three.js.
 * Ось Y — время t, горизонтальная плоскость XZ — 2D-пространство (x, y).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class View3D {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        // Масштабы 3D-мира
        this.spaceSize = 400;      // Размер пространства X и Z [-200, 200]
        this.timeHeight = 320;     // Высота оси времени Y (t = 0 внизу, t = duration вверху)

        this.initScene();
        this.initStaticElements();
        this.bindEvents();
    }

    initScene() {
        // Сцена, камера и рендерер
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f1d); // Глубокий космический цвет

        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;

        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
        this.camera.position.set(380, 260, 420);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Управление камерой мышью
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, this.timeHeight / 2, 0);

        // Освещение
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(200, 400, 300);
        this.scene.add(dirLight);

        // Группы для динамических объектов
        this.dynamicGroup = new THREE.Group();
        this.scene.add(this.dynamicGroup);

        this.layersGroup = new THREE.Group();
        this.scene.add(this.layersGroup);

        this.tubesGroup = new THREE.Group();
        this.scene.add(this.tubesGroup);
    }

    initStaticElements() {
        // Нижняя сетка пространства (t = 0)
        const gridFloor = new THREE.GridHelper(this.spaceSize, 20, 0x38bdf8, 0x1e293b);
        gridFloor.position.y = 0;
        this.scene.add(gridFloor);

        // Верхняя сетка пространства (t = duration)
        const gridCeil = new THREE.GridHelper(this.spaceSize, 20, 0x64748b, 0x1e293b);
        gridCeil.position.y = this.timeHeight;
        this.scene.add(gridCeil);

        // Вертикальные направляющие колонны (ось времени)
        const corners = [
            [-this.spaceSize / 2, -this.spaceSize / 2],
            [this.spaceSize / 2, -this.spaceSize / 2],
            [this.spaceSize / 2, this.spaceSize / 2],
            [-this.spaceSize / 2, this.spaceSize / 2]
        ];

        corners.forEach(([cx, cz]) => {
            const points = [
                new THREE.Vector3(cx, 0, cz),
                new THREE.Vector3(cx, this.timeHeight, cz)
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.6 });
            this.scene.add(new THREE.Line(lineGeo, lineMat));
        });

        // Центральная ось времени (Time Arrow)
        const axisPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, this.timeHeight + 30, 0)
        ];
        const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPoints);
        const axisMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
        this.scene.add(new THREE.Line(axisGeo, axisMat));

        // Стрелка на конце оси времени
        const coneGeo = new THREE.ConeGeometry(5, 15, 16);
        const coneMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const arrowMesh = new THREE.Mesh(coneGeo, coneMat);
        arrowMesh.position.set(0, this.timeHeight + 30, 0);
        this.scene.add(arrowMesh);

        // Подпись оси времени
        this.timeArrow = arrowMesh;
    }

    bindEvents() {
        this.state.on('timeUpdated', () => this.updateScene());
        this.state.on('shapesUpdated', () => this.rebuildGeometry());
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

    /**
     * Преобразование физических координат (x, y, t) в 3D координаты Three.js:
     * Three.X = x
     * Three.Y = (t / duration) * timeHeight
     * Three.Z = y
     */
    timeToY(t) {
        return (t / this.state.duration) * this.timeHeight;
    }

    /**
     * Полная пересборка статических слоев и мировых трубок
     */
    rebuildGeometry() {
        this.buildLayers();
        this.buildWorldTubes();
        this.updateScene();
    }

    /**
     * Построение стопки полупрозрачных слоёв-кадров времени
     */
    buildLayers() {
        // Очищаем предыдущие слои
        while (this.layersGroup.children.length > 0) {
            const obj = this.layersGroup.children[0];
            this.layersGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        if (!this.state.settings.showLayers) return;

        const count = this.state.settings.layersCount;
        const opacity = this.state.settings.layersOpacity;

        for (let i = 0; i < count; i++) {
            const t = (i / (count - 1)) * this.state.duration;
            const yPos = this.timeToY(t);

            // Полупрозрачная плоскость среза времени
            const planeGeo = new THREE.PlaneGeometry(this.spaceSize, this.spaceSize);
            planeGeo.rotateX(-Math.PI / 2); // Горизонтальная плоскость XZ

            const planeMat = new THREE.MeshBasicMaterial({
                color: 0x1e3a5f,
                transparent: true,
                opacity: opacity * 0.4,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const planeMesh = new THREE.Mesh(planeGeo, planeMat);
            planeMesh.position.y = yPos;
            this.layersGroup.add(planeMesh);

            // Контур плоскости (рамка кадра)
            const edgesGeo = new THREE.EdgesGeometry(planeGeo);
            const edgesMat = new THREE.LineBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: opacity * 0.9
            });
            const frameLine = new THREE.LineSegments(edgesGeo, edgesMat);
            frameLine.position.y = yPos;
            this.layersGroup.add(frameLine);

            // Отрисовка фигур на данном слое времени
            this.state.shapes.forEach(shape => {
                const stateAtT = shape.getStateAt(t);
                const shapeGeo = new THREE.PlaneGeometry(stateAtT.width, stateAtT.height);
                shapeGeo.rotateX(-Math.PI / 2);

                const shapeMat = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(shape.color),
                    transparent: true,
                    opacity: 0.75,
                    side: THREE.DoubleSide
                });

                const shapeMesh = new THREE.Mesh(shapeGeo, shapeMat);
                // Three.X = x, Three.Z = y
                shapeMesh.position.set(stateAtT.x, yPos + 0.1, stateAtT.y);
                this.layersGroup.add(shapeMesh);
            });
        }
    }

    /**
     * Построение сплошных мировых трубок (World-tubes) в 3D
     */
    buildWorldTubes() {
        while (this.tubesGroup.children.length > 0) {
            const obj = this.tubesGroup.children[0];
            this.tubesGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        if (!this.state.settings.showWorldTubes) return;

        const steps = 60; // Количество шагов дискретизации вдоль времени
        const dt = this.state.duration / steps;

        this.state.shapes.forEach(shape => {
            // Строим экструдированную ленту мировых линий 4-х углов прямоугольника
            const cornersIndices = [
                [-0.5, -0.5],
                [0.5, -0.5],
                [0.5, 0.5],
                [-0.5, 0.5]
            ];

            // Создаем меш боковых граней мировой трубки
            const vertices = [];
            const indices = [];

            for (let step = 0; step <= steps; step++) {
                const t = step * dt;
                const yPos = this.timeToY(t);
                const s = shape.getStateAt(t);

                // 4 вершины на высоте yPos
                cornersIndices.forEach(([sx, sz]) => {
                    const vx = s.x + sx * s.width;
                    const vz = s.y + sz * s.height;
                    vertices.push(vx, yPos, vz);
                });

                // Треугольники между текущим шагом и предыдущим
                if (step > 0) {
                    const prevRow = (step - 1) * 4;
                    const currRow = step * 4;

                    for (let c = 0; c < 4; c++) {
                        const nextC = (c + 1) % 4;
                        const p1 = prevRow + c;
                        const p2 = prevRow + nextC;
                        const p3 = currRow + c;
                        const p4 = currRow + nextC;

                        // 2 треугольника на каждую боковую грань
                        indices.push(p1, p3, p2);
                        indices.push(p2, p3, p4);
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
                opacity: 0.35,
                side: THREE.DoubleSide,
                shininess: 60
            });

            const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
            this.tubesGroup.add(tubeMesh);

            // Добавляем каркасные ребра для четкости
            const wireframeMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(shape.color),
                wireframe: true,
                transparent: true,
                opacity: 0.2
            });
            this.tubesGroup.add(new THREE.Mesh(tubeGeo, wireframeMat));
        });
    }

    /**
     * Обновление динамических элементов:
     * - Световой конус прошлого
     * - Текущий плоскостной срез времени (лазерная плоскость)
     * - Положение наблюдателя
     */
    updateScene() {
        while (this.dynamicGroup.children.length > 0) {
            const obj = this.dynamicGroup.children[0];
            this.dynamicGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        const tCurr = this.state.currentTime;
        const currentY = this.timeToY(tCurr);
        const obs = this.state.observer;
        const c = this.state.speedOfLight;

        // 1. Текущий срез времени (активная плоскость времени)
        const activePlaneGeo = new THREE.PlaneGeometry(this.spaceSize, this.spaceSize);
        activePlaneGeo.rotateX(-Math.PI / 2);
        const activePlaneMat = new THREE.MeshBasicMaterial({
            color: 0x06b6d4, // Циановый лазер
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const activePlaneMesh = new THREE.Mesh(activePlaneGeo, activePlaneMat);
        activePlaneMesh.position.y = currentY;
        this.dynamicGroup.add(activePlaneMesh);

        // Рамка активного среза
        const edgesGeo = new THREE.EdgesGeometry(activePlaneGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, linewidth: 2 });
        const activeEdges = new THREE.LineSegments(edgesGeo, edgesMat);
        activeEdges.position.y = currentY;
        this.dynamicGroup.add(activeEdges);

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

        // Сфера наблюдателя в текущий момент времени ("Здесь и сейчас")
        const obsSphereGeo = new THREE.SphereGeometry(6, 16, 16);
        const obsSphereMat = new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0xeab308,
            emissiveIntensity: 0.8
        });
        const obsSphere = new THREE.Mesh(obsSphereGeo, obsSphereMat);
        obsSphere.position.set(obs.x, currentY, obs.y);
        this.dynamicGroup.add(obsSphere);

        // 3. 3D Световой конус прошлого (Past Light Cone)
        if (this.state.settings.showLightCone && tCurr > 0.05) {
            // Высота конуса от t = 0 до t = tCurr
            const coneHeight = currentY;
            // Радиус конуса на уровне пола (t = 0, dt = tCurr)
            const baseRadius = c * tCurr;

            // В Three.js ConeGeometry строится с вершиной вверху (+Y) и основанием внизу (-Y).
            // Чтобы конус прошлого расширялся вниз (в прошлое), переворачиваем его вверх ногами!
            const coneGeo = new THREE.ConeGeometry(baseRadius, coneHeight, 48, 1, true);
            coneGeo.rotateX(Math.PI); // Переворачиваем вершиной вверх

            const coneMat = new THREE.MeshPhongMaterial({
                color: 0x00f5ff, // Неоновый циан
                transparent: true,
                opacity: 0.28,
                side: THREE.DoubleSide,
                depthWrite: false,
                shininess: 90
            });

            const coneMesh = new THREE.Mesh(coneGeo, coneMat);
            // Вершина конуса должна быть в (obs.x, currentY, obs.y)
            // Центр конуса высотой coneHeight находится на currentY - coneHeight/2
            coneMesh.position.set(obs.x, currentY - coneHeight / 2, obs.y);
            this.dynamicGroup.add(coneMesh);

            // Каркас светового конуса для красивой графики
            const wireConeMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                wireframe: true,
                transparent: true,
                opacity: 0.25
            });
            const wireConeMesh = new THREE.Mesh(coneGeo, wireConeMat);
            wireConeMesh.position.copy(coneMesh.position);
            this.dynamicGroup.add(wireConeMesh);

            // Круг основания светового конуса на плоскости t = 0
            const ringGeo = new THREE.RingGeometry(baseRadius - 1.5, baseRadius + 1.5, 64);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00f5ff,
                side: THREE.DoubleSide
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.set(obs.x, 0.2, obs.y);
            this.dynamicGroup.add(ringMesh);
        }
    }

    /**
     * Основной цикл анимации Three.js
     */
    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }
}
