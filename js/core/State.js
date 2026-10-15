/**
 * State.js
 * Центральное реактивное состояние приложения и шина событий.
 */

import { Presets } from './ShapeModel.js';

export class AppState {
    constructor() {
        this.listeners = new Map();

        // Параметры времени
        this.currentTime = 0.0;
        this.duration = 6.0; // секунды
        this.fps = 60;
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        this.lastFrameTimestamp = null;

        // Физика пространства-времени
        this.speedOfLight = 90.0; // px/s (позволяет наглядно видеть задержку на масштабе 500px)
        this.observer = { x: 0, y: 0 };

        // Режим отображения: 'split', '3d', '2d'
        this.viewMode = 'split';

        // Настройки рендереров
        this.settings = {
            layersCount: 36,        // Количество полупрозрачных слоёв-кадров в 3D
            layersOpacity: 0.16,    // Прозрачность слоёв времени
            showLayers: true,       // Отображать срезы времени
            showWorldTubes: true,   // Отображать сплошные мировые трубки в 3D
            showLightCone: true,    // Отображать 3D световой конус
            view2DMode: 'both',     // 'retarded' (световой конус), 'instant' (синхронно), 'both' (наложение)
            showMeasurement: true,  // Измерение кажущейся длины стержня
            coneResolution: 32      // Детализация конуса
        };

        // Объекты сцены
        this.shapes = Presets.processingRod();
        this.selectedShapeId = this.shapes[0]?.id || null;
    }

    /**
     * Подписка на события
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.listeners.get(event).delete(callback);
    }

    /**
     * Генерация событий
     */
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

    setSpeedOfLight(c) {
        this.speedOfLight = Math.max(10, c);
        this.emit('settingsChanged', this.settings);
    }

    setViewMode(mode) {
        if (this.viewMode !== mode) {
            this.viewMode = mode;
            this.emit('viewModeChanged', mode);
        }
    }

    updateSetting(key, value) {
        this.settings[key] = value;
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
