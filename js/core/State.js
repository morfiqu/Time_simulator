/**
 * State.js
 * Центральное реактивное состояние приложения и шина событий.
 * Скорость света c жестко синхронизирована с углом светового конуса 3D:
 * c = (timeHeight / duration) * tan(coneAngle)
 */

import { Presets } from './ShapeModel.js';

export class AppState {
    constructor() {
        this.listeners = new Map();

        // Геометрические масштабы 3D пространства-времени
        this.spaceSize = 400;      // [-200, 200]
        this.heightPerSecond = 53.3333; // Константный вертикальный масштаб времени: 53.3 px за 1 секунду
        this.duration = 6.0;       // Длительность таймлайна в секундах
        this.timeHeight = this.duration * this.heightPerSecond; // Высота оси времени Y растет пропорционально времени

        // Параметры времени
        this.currentTime = 0.0;
        this.fps = 60;
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        this.lastFrameTimestamp = null;

        // Положение наблюдателя
        this.observer = { x: 0, y: 0 };

        // Режим отображения: 'all', 'split', 'editor', '3d', '2d'
        this.viewMode = 'all';

        // Активный инструмент векторного редактора: 'select', 'rect', 'circle', 'pivot'
        this.activeEditorTool = 'select';

        // Настройки рендереров
        this.settings = {
            coneAngle: 45,              // Угол светового конуса в градусах (45° = канонический Минковский)
            layersPerSecond: 6,         // Плотность слоёв времени (слоёв в 1 секунду)
            layersCount: Math.round(this.duration * 6) + 1, // Динамическое число слоёв (добавляются новые слои)
            layersOpacity: 0.16,        // Базовая прозрачность
            layerOpacityInside: 0.65,   // Прозрачность кадров внутри светового конуса
            layerOpacityOutside: 0.05,  // Прозрачность кадров снаружи конуса
            coneOpacity: 0.25,          // Прозрачность самого 3D-конуса
            shapeOpacityInside: 0.95,   // Прозрачность фигур внутри конуса
            shapeOpacityOutside: 0.12,  // Прозрачность фигур снаружи конуса
            showLayers: true,           // Отображать срезы времени
            showWorldTubes: true,       // Отображать сплошные мировые трубки в 3D
            showLightCone: true,        // Отображать 3D световой конус
            hardCutMode: false,         // Режим жесткого среза: конус скрыт, внутри 100%, снаружи 0%
            frameBgColor: '#133863',    // Цвет фона кадра (внутри конуса и в 2D виде)
            bg3DColor: '#070c18',       // Цвет фона 3D сцены
            view2DMode: 'both',         // 'retarded', 'instant', 'both'
            showMeasurement: true,      // Измерение кажущейся длины стержня
            coneResolution: 48          // Детализация конуса
        };

        // Скорость света c константна и зависит только от угла конуса:
        // c = heightPerSecond * tan(angle)
        this.speedOfLight = this.calculateSpeedOfLight(this.settings.coneAngle);

        // Объекты сцены
        this.shapes = Presets.processingRod();
        this.selectedShapeId = this.shapes[0]?.id || null;

        this.updateShapesSpeedOfLight();
    }

    /**
     * Формула жесткой связи угла светового конуса и скорости света:
     * timeScale = heightPerSecond (px/sec)
     * c = heightPerSecond * tan(angle)
     * Скорость света константна и не зависит от добавления новых секунд в длительность!
     */
    calculateSpeedOfLight(angleDeg) {
        const slope = Math.tan(angleDeg * (Math.PI / 180));
        return this.heightPerSecond * slope;
    }

    /**
     * Обратная формула: расчет угла конуса из скорости света
     */
    calculateConeAngle(c) {
        const slope = c / this.heightPerSecond;
        return (Math.atan(slope) * 180) / Math.PI;
    }

    setConeAngle(angleDeg) {
        const clamped = Math.max(15, Math.min(75, angleDeg));
        this.settings.coneAngle = clamped;
        this.speedOfLight = this.calculateSpeedOfLight(clamped);
        this.updateShapesSpeedOfLight();
        this.emit('settingsChanged', this.settings);
        this.emit('timeUpdated', this.currentTime);
    }

    setSpeedOfLight(c) {
        const clampedC = Math.max(10, c);
        this.speedOfLight = clampedC;
        this.settings.coneAngle = Math.round(this.calculateConeAngle(clampedC));
        this.updateShapesSpeedOfLight();
        this.emit('settingsChanged', this.settings);
        this.emit('timeUpdated', this.currentTime);
    }

    setDuration(d) {
        const val = parseFloat(d);
        if (isNaN(val) || val <= 0.1) return;
        const clamped = Math.max(0.5, Math.min(300, val));
        this.duration = clamped;

        // Ось времени в 3D растет вверх пропорционально времени
        this.timeHeight = this.duration * this.heightPerSecond;

        // Слои не растягиваются, а добавляются новые:
        const lps = this.settings.layersPerSecond || 6;
        this.settings.layersCount = Math.max(2, Math.round(this.duration * lps) + 1);

        // Скорость света константна
        this.speedOfLight = this.calculateSpeedOfLight(this.settings.coneAngle);
        this.updateShapesSpeedOfLight();

        if (this.currentTime > this.duration) {
            this.currentTime = this.duration;
        }

        this.emit('durationChanged', this.duration);
        this.emit('settingsChanged', this.settings);
        this.emit('timeUpdated', this.currentTime);
    }

    setEditorTool(tool) {
        this.activeEditorTool = tool;
        this.emit('editorToolChanged', tool);
    }

    addShape(shape) {
        this.shapes.push(shape);
        this.setShapes(this.shapes);
        this.selectShape(shape.id);
    }

    updateShapesSpeedOfLight() {
        this.shapes.forEach(s => {
            if (typeof s.setSpeedOfLight === 'function') {
                s.setSpeedOfLight(this.speedOfLight);
            }
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.listeners.get(event).delete(callback);
    }

    emit(event, payload) {
        if (this.listeners.has(event)) {
            for (const cb of this.listeners.get(event)) {
                cb(payload);
            }
        }
    }

    setTime(t) {
        const clamped = Math.max(0, Math.min(this.duration, t));
        if (Math.abs(this.currentTime - clamped) > 0.0001) {
            this.currentTime = clamped;
            this.emit('timeUpdated', this.currentTime);
        }
    }

    setPlaying(play) {
        if (this.isPlaying !== play) {
            this.isPlaying = play;
            this.lastFrameTimestamp = null;
            this.emit('playStateChanged', this.isPlaying);
        }
    }

    togglePlay() {
        this.setPlaying(!this.isPlaying);
    }

    stepFrame(deltaFrames = 1) {
        const dt = deltaFrames / this.fps;
        let newTime = this.currentTime + dt;
        if (newTime > this.duration) newTime = 0;
        if (newTime < 0) newTime = this.duration;
        this.setTime(newTime);
    }

    setViewMode(mode) {
        if (this.viewMode !== mode) {
            this.viewMode = mode;
            this.emit('viewModeChanged', mode);
        }
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        if (key === 'coneAngle') {
            this.setConeAngle(value);
            return;
        }
        this.emit('settingsChanged', this.settings);
    }

    selectShape(id) {
        this.selectedShapeId = id;
        this.emit('shapeSelected', this.getSelectedShape());
    }

    getSelectedShape() {
        return this.shapes.find(s => s.id === this.selectedShapeId) || null;
    }

    setShapes(shapes) {
        this.shapes = shapes;
        this.updateShapesSpeedOfLight();
        this.selectedShapeId = shapes[0]?.id || null;
        this.emit('shapesUpdated', this.shapes);
        this.emit('shapeSelected', this.getSelectedShape());
    }

    loadPreset(presetName) {
        if (Presets[presetName]) {
            this.setShapes(Presets[presetName]());
            this.setTime(0);
        }
    }
}
