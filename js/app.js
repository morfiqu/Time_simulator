/**
 * app.js
 * Главная точка входа приложения Time Simulator.
 * Координирует реактивное состояние, рендереры и пользовательский интерфейс.
 */

import { AppState } from './core/State.js';
import { ViewEditor } from './renderers/ViewEditor.js';
import { View3D } from './renderers/View3D.js';
import { View2D } from './renderers/View2D.js';
import { Timeline } from './components/Timeline.js';
import { Inspector } from './components/Inspector.js';
import { Toolbar } from './components/Toolbar.js';

class Application {
    constructor() {
        this.state = new AppState();
        this.initUI();
        this.initRenderers();
        this.startClockLoop();
    }

    initUI() {
        const toolbarEl = document.getElementById('toolbar-container');
        const inspectorEl = document.getElementById('inspector-container');
        const timelineEl = document.getElementById('timeline-container');

        this.toolbar = new Toolbar(toolbarEl, this.state);
        this.inspector = new Inspector(inspectorEl, this.state);
        this.timeline = new Timeline(timelineEl, this.state);

        // Управление видовыми экранами (Редактор, 3D, 2D)
        this.viewportsWrapper = document.getElementById('viewports-wrapper');
        this.viewportEditor = document.getElementById('viewport-editor-container');
        this.viewport3D = document.getElementById('viewport-3d-container');
        this.viewport2D = document.getElementById('viewport-2d-container');

        this.state.on('viewModeChanged', (mode) => this.applyViewMode(mode));
        this.applyViewMode(this.state.viewMode);
    }

    initRenderers() {
        const containerEditor = document.getElementById('canvas-editor-box');
        const container3D = document.getElementById('canvas-3d-box');
        const canvas2D = document.getElementById('canvas-2d');

        this.viewEditor = new ViewEditor(containerEditor, this.state);
        this.view3D = new View3D(container3D, this.state);
        this.view2D = new View2D(canvas2D, this.state);

        // Инициализация первой пересборки геометрии
        this.view3D.rebuildGeometry();
        this.view3D.startRenderLoop();
    }

    applyViewMode(mode) {
        // Скрываем все экраны
        this.viewportEditor.style.display = 'none';
        this.viewport3D.style.display = 'none';
        this.viewport2D.style.display = 'none';

        if (mode === 'all') {
            // Все 3 окна сразу
            this.viewportEditor.style.display = 'flex';
            this.viewportEditor.style.flex = '1 1 0%';
            this.viewport3D.style.display = 'flex';
            this.viewport3D.style.flex = '1 1 0%';
            this.viewport2D.style.display = 'flex';
            this.viewport2D.style.flex = '1 1 0%';
        } else if (mode === 'editor') {
            this.viewportEditor.style.display = 'flex';
            this.viewportEditor.style.flex = '1 1 0%';
        } else if (mode === '3d') {
            this.viewport3D.style.display = 'flex';
            this.viewport3D.style.flex = '1 1 0%';
        } else if (mode === '2d') {
            this.viewport2D.style.display = 'flex';
            this.viewport2D.style.flex = '1 1 0%';
        } else {
            // 'split' (3D + 2D)
            this.viewport3D.style.display = 'flex';
            this.viewport3D.style.flex = '1 1 0%';
            this.viewport2D.style.display = 'flex';
            this.viewport2D.style.flex = '1 1 0%';
        }

        // Обновляем размеры рендереров после анимации раскладки
        setTimeout(() => {
            this.viewEditor?.onResize();
            this.view3D?.onResize();
            this.view2D?.onResize();
        }, 50);
    }

    /**
     * Высокоточный таймер воспроизведения анимации
     */
    startClockLoop() {
        let lastTime = performance.now();

        const tick = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            if (this.state.isPlaying) {
                let nextTime = this.state.currentTime + dt * this.state.playbackSpeed;
                if (nextTime > this.state.duration) {
                    nextTime = 0; // Зацикливание воспроизведения
                }
                this.state.setTime(nextTime);
            }

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }
}

// Запуск приложения после загрузки DOM (или сразу, если DOM уже готов)
function startApp() {
    if (!window.app) {
        window.app = new Application();
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
