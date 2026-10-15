/**
 * ViewEditor.js
 * Интерактивный 2D векторный аниматор и редактор кадра.
 * Является источником (Ground Truth) для 3D пространства-времени Минковского
 * и для 2D вида наблюдателя (со световым запаздыванием).
 */

import { ShapeModel } from '../core/ShapeModel.js';

export class ViewEditor {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.scale = 1.0;

        // Состояние интерактивности
        this.dragState = null; // { mode: 'move'|'rotate'|'pivot'|'resize'|'draw_rect'|'draw_circle', startX, startY, origX, origY, origRot, ... }
        this.hoveredHandle = null; // 'body' | 'rotate' | 'pivot' | 'tl' | 'tr' | 'bl' | 'br'

        // Всплывающее окно быстрого редактирования цвета (Double-click)
        this.popupEl = null;

        this.initDom();
        this.bindEvents();
    }

    initDom() {
        this.container.innerHTML = `
            <div class="editor-toolbar-overlay">
                <div class="editor-tool-group">
                    <button class="btn btn-xs btn-tool active" data-tool="select" title="Выбор и перемещение (V)">
                        👆 Выбор
                    </button>
                    <button class="btn btn-xs btn-tool" data-tool="rect" title="Нарисовать прямоугольник (R)">
                        ⬛ Прямоугольник
                    </button>
                    <button class="btn btn-xs btn-tool" data-tool="circle" title="Нарисовать круг (C)">
                        ⚪ Круг
                    </button>
                    <button class="btn btn-xs btn-tool" data-tool="pivot" title="Переместить пивот / центр вращения (P)">
                        🎯 Пивот
                    </button>
                </div>
                <div class="editor-action-group">
                    <button id="btn-editor-add-key" class="btn btn-xs btn-primary" title="Зафиксировать позу и цвет в текущий кадр">
                        ◆ Ключ (K)
                    </button>
                </div>
            </div>
            <div class="editor-canvas-box" style="position:relative; width:100%; height:100%; overflow:hidden;">
                <canvas id="canvas-editor"></canvas>
                <div id="editor-color-popup" class="editor-popup" style="display:none;"></div>
            </div>
        `;

        this.canvas = this.container.querySelector('#canvas-editor');
        this.ctx = this.canvas.getContext('2d');
        this.popupEl = this.container.querySelector('#editor-color-popup');

        this.toolButtons = this.container.querySelectorAll('.btn-tool');
        this.btnAddKey = this.container.querySelector('#btn-editor-add-key');

        this.onResize();
    }

    bindEvents() {
        // Переключение инструментов редактора
        this.toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.state.setEditorTool(tool);
            });
        });

        this.state.on('editorToolChanged', (tool) => {
            this.toolButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === tool);
            });
            this.render();
        });

        // Добавление ключевого кадра
        this.btnAddKey.addEventListener('click', () => {
            this.captureKeyframe();
        });

        // Реакция на изменение состояния
        this.state.on('timeUpdated', () => this.render());
        this.state.on('shapesUpdated', () => this.render());
        this.state.on('shapeSelected', () => this.render());
        this.state.on('settingsChanged', () => this.render());
        this.state.on('durationChanged', () => this.render());
        this.state.on('viewModeChanged', () => this.onResize());

        window.addEventListener('resize', () => this.onResize());

        // Взаимодействие с холстом (мышь)
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Горячие клавиши редактора
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.key === 'v' || e.key === 'V') this.state.setEditorTool('select');
            if (e.key === 'r' || e.key === 'R') this.state.setEditorTool('rect');
            if (e.key === 'c' || e.key === 'C') this.state.setEditorTool('circle');
            if (e.key === 'p' || e.key === 'P') this.state.setEditorTool('pivot');
            if (e.key === 'k' || e.key === 'K') this.captureKeyframe();
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelectedShape();
            }
        });
    }

    onResize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.resetTransform();
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        this.render();
    }

    worldToScreen(wx, wy) {
        return {
            x: this.width / 2 + wx * this.scale,
            y: this.height / 2 + wy * this.scale
        };
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.width / 2) / this.scale,
            y: (sy - this.height / 2) / this.scale
        };
    }

    captureKeyframe() {
        const shape = this.state.getSelectedShape();
        if (!shape) return;
        const current = shape.getStateAt(this.state.currentTime, this.state.speedOfLight);
        shape.setKeyframe(this.state.currentTime, {
            x: current.baseX ?? current.x,
            y: current.baseY ?? current.y,
            rotation: current.rotation,
            pivotX: current.pivotX,
            pivotY: current.pivotY,
            width: current.width,
            height: current.height,
            color: current.color,
            strokeColor: current.strokeColor,
            strokeWidth: current.strokeWidth
        });
        this.state.emit('shapesUpdated', this.state.shapes);
        this.render();
    }

    onMouseDown(e) {
        if (e.button !== 0) return; // Только левая кнопка мыши
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const wpos = this.screenToWorld(sx, sy);
        const t = this.state.currentTime;

        // Скрываем попап цвета при клике вне его
        this.hidePopup();

        const activeTool = this.state.activeEditorTool;

        // 1. Создание нового прямоугольника
        if (activeTool === 'rect') {
            this.dragState = {
                mode: 'draw_rect',
                startX: wpos.x,
                startY: wpos.y
            };
            return;
        }

        // 2. Создание нового круга
        if (activeTool === 'circle') {
            this.dragState = {
                mode: 'draw_circle',
                startX: wpos.x,
                startY: wpos.y
            };
            return;
        }

        const selectedShape = this.state.getSelectedShape();

        // 3. Инструмент "Пивот"
        if (activeTool === 'pivot' && selectedShape) {
            const s = selectedShape.getStateAt(t, this.state.speedOfLight);
            // Пивот задается относительно базовой позиции объекта
            const newPivotX = wpos.x - (s.baseX ?? s.x);
            const newPivotY = wpos.y - (s.baseY ?? s.y);
            selectedShape.pivotX = Math.round(newPivotX);
            selectedShape.pivotY = Math.round(newPivotY);
            if (selectedShape.keyframes) {
                selectedShape.setKeyframe(t, { pivotX: selectedShape.pivotX, pivotY: selectedShape.pivotY });
            }
            this.state.emit('shapesUpdated', this.state.shapes);
            this.render();
            return;
        }

        // 4. Инструмент "Выбор"
        if (selectedShape) {
            const handle = this.hitTestHandles(sx, sy, selectedShape, t);
            if (handle) {
                const s = selectedShape.getStateAt(t, this.state.speedOfLight);
                this.dragState = {
                    mode: handle,
                    shape: selectedShape,
                    startScreenX: sx,
                    startScreenY: sy,
                    startWorldX: wpos.x,
                    startWorldY: wpos.y,
                    origX: s.baseX ?? s.x,
                    origY: s.baseY ?? s.y,
                    origRot: s.rotation,
                    origPivotX: s.pivotX,
                    origPivotY: s.pivotY,
                    origW: s.width,
                    origH: s.height,
                    pivotScreen: this.worldToScreen(s.pivotWorldX, s.pivotWorldY)
                };
                return;
            }
        }

        // Проверяем клик по телу фигур для выбора
        let clickedShape = null;
        for (let i = this.state.shapes.length - 1; i >= 0; i--) {
            const shape = this.state.shapes[i];
            const s = shape.getStateAt(t, this.state.speedOfLight);
            if (this.isPointInsideShape(wpos.x, wpos.y, s)) {
                clickedShape = shape;
                break;
            }
        }

        if (clickedShape) {
            this.state.selectShape(clickedShape.id);
            const s = clickedShape.getStateAt(t, this.state.speedOfLight);
            this.dragState = {
                mode: 'move',
                shape: clickedShape,
                startScreenX: sx,
                startScreenY: sy,
                startWorldX: wpos.x,
                startWorldY: wpos.y,
                origX: s.baseX ?? s.x,
                origY: s.baseY ?? s.y
            };
        } else {
            // Клик в пустоту
            this.state.selectShape(null);
        }
        this.render();
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const wpos = this.screenToWorld(sx, sy);
        const t = this.state.currentTime;

        if (!this.dragState) {
            // Hover-эффекты курсора
            const selectedShape = this.state.getSelectedShape();
            if (selectedShape) {
                const handle = this.hitTestHandles(sx, sy, selectedShape, t);
                if (handle === 'rotate') {
                    this.canvas.style.cursor = 'crosshair';
                    return;
                } else if (handle === 'pivot') {
                    this.canvas.style.cursor = 'move';
                    return;
                } else if (handle === 'body') {
                    this.canvas.style.cursor = 'move';
                    return;
                }
            }

            // Проверяем наведение на любую фигуру
            let isOverAny = false;
            for (const shape of this.state.shapes) {
                const s = shape.getStateAt(t, this.state.speedOfLight);
                if (this.isPointInsideShape(wpos.x, wpos.y, s)) {
                    isOverAny = true;
                    break;
                }
            }
            this.canvas.style.cursor = isOverAny ? 'pointer' : 'default';
            return;
        }

        const ds = this.dragState;

        // Рисование нового прямоугольника
        if (ds.mode === 'draw_rect') {
            ds.currentX = wpos.x;
            ds.currentY = wpos.y;
            this.render();
            return;
        }

        // Рисование нового круга
        if (ds.mode === 'draw_circle') {
            ds.currentX = wpos.x;
            ds.currentY = wpos.y;
            this.render();
            return;
        }

        const shape = ds.shape;
        if (!shape) return;

        // Перемещение тела фигуры
        if (ds.mode === 'move') {
            const dx = wpos.x - ds.startWorldX;
            const dy = wpos.y - ds.startWorldY;
            const newX = ds.origX + dx;
            const newY = ds.origY + dy;

            shape.x0 = Math.round(newX);
            shape.y0 = Math.round(newY);

            // Автоматически фиксируем/обновляем ключевой кадр
            shape.setKeyframe(t, { x: shape.x0, y: shape.y0 });
            this.state.emit('shapesUpdated', this.state.shapes);
            this.render();
            return;
        }

        // Вращение фигуры вокруг пивота
        if (ds.mode === 'rotate') {
            const p = ds.pivotScreen;
            const angleRad = Math.atan2(sy - p.y, sx - p.x);
            let angleDeg = Math.round((angleRad * 180) / Math.PI) + 90;
            if (angleDeg < 0) angleDeg += 360;

            shape.rotation = angleDeg;
            shape.setKeyframe(t, { rotation: shape.rotation });
            this.state.emit('shapesUpdated', this.state.shapes);
            this.render();
            return;
        }

        // Перемещение пивот-поинта
        if (ds.mode === 'pivot') {
            const newPivotX = Math.round(wpos.x - ds.origX);
            const newPivotY = Math.round(wpos.y - ds.origY);

            shape.pivotX = newPivotX;
            shape.pivotY = newPivotY;
            shape.setKeyframe(t, { pivotX: shape.pivotX, pivotY: shape.pivotY });
            this.state.emit('shapesUpdated', this.state.shapes);
            this.render();
            return;
        }
    }

    onMouseUp(e) {
        if (!this.dragState) return;
        const ds = this.dragState;
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const wpos = this.screenToWorld(sx, sy);
        const t = this.state.currentTime;

        // Завершение рисования прямоугольника
        if (ds.mode === 'draw_rect') {
            const x0 = Math.min(ds.startX, wpos.x);
            const y0 = Math.min(ds.startY, wpos.y);
            const width = Math.max(20, Math.abs(wpos.x - ds.startX));
            const height = Math.max(15, Math.abs(wpos.y - ds.startY));

            const newShape = new ShapeModel({
                name: 'Прямоугольник',
                type: 'rect',
                color: '#38bdf8',
                strokeColor: '#ffffff',
                strokeWidth: 2,
                x0: Math.round(x0 + width / 2),
                y0: Math.round(y0 + height / 2),
                width: Math.round(width),
                height: Math.round(height),
                speedOfLight: this.state.speedOfLight
            });
            newShape.setKeyframe(t);
            this.state.addShape(newShape);
            this.state.setEditorTool('select');
        }

        // Завершение рисования круга
        if (ds.mode === 'draw_circle') {
            const radius = Math.max(12, Math.hypot(wpos.x - ds.startX, wpos.y - ds.startY));
            const newShape = new ShapeModel({
                name: 'Круг',
                type: 'circle',
                color: '#fbbf24',
                strokeColor: '#ffffff',
                strokeWidth: 2,
                x0: Math.round(ds.startX),
                y0: Math.round(ds.startY),
                width: Math.round(radius * 2),
                height: Math.round(radius * 2),
                speedOfLight: this.state.speedOfLight
            });
            newShape.setKeyframe(t);
            this.state.addShape(newShape);
            this.state.setEditorTool('select');
        }

        this.dragState = null;
        this.render();
    }

    onDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const wpos = this.screenToWorld(sx, sy);
        const t = this.state.currentTime;

        // Поиск фигуры под кликом
        for (let i = this.state.shapes.length - 1; i >= 0; i--) {
            const shape = this.state.shapes[i];
            const s = shape.getStateAt(t, this.state.speedOfLight);
            if (this.isPointInsideShape(wpos.x, wpos.y, s)) {
                this.state.selectShape(shape.id);
                this.showPopup(e.clientX, e.clientY, shape, s);
                return;
            }
        }
    }

    showPopup(clientX, clientY, shape, stateAtT) {
        const popup = this.popupEl;
        popup.innerHTML = `
            <div class="popup-header">
                <strong>Свойства фигуры</strong>
                <button class="popup-close">&times;</button>
            </div>
            <div class="popup-row">
                <label>Имя:</label>
                <input type="text" id="popup-shape-name" value="${shape.name}">
            </div>
            <div class="popup-row">
                <label>Цвет заливки:</label>
                <input type="color" id="popup-shape-color" value="${stateAtT.color || shape.color}">
            </div>
            <div class="popup-row">
                <label>Цвет обводки:</label>
                <input type="color" id="popup-shape-stroke" value="${stateAtT.strokeColor || shape.strokeColor}">
            </div>
            <div class="popup-row">
                <label>Скорость β (v/c):</label>
                <input type="number" id="popup-shape-beta" step="0.05" value="${shape.betaX ?? 0}">
            </div>
            <button id="popup-btn-key" class="btn btn-xs btn-primary btn-block mt-2">
                ◆ Зафиксировать цвет в ключе (t = ${this.state.currentTime.toFixed(2)}s)
            </button>
            <button id="popup-btn-delete" class="btn btn-xs btn-danger btn-block mt-2">
                🗑️ Удалить объект (Del)
            </button>
        `;

        const containerRect = this.container.getBoundingClientRect();
        const left = Math.min(containerRect.width - 240, Math.max(10, clientX - containerRect.left + 10));
        const top = Math.min(containerRect.height - 240, Math.max(10, clientY - containerRect.top + 10));

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.display = 'block';

        // Слушатели попапа
        popup.querySelector('.popup-close').addEventListener('click', () => this.hidePopup());

        const inputName = popup.querySelector('#popup-shape-name');
        inputName.addEventListener('input', (e) => {
            shape.name = e.target.value;
            this.state.emit('shapesUpdated', this.state.shapes);
        });

        const inputColor = popup.querySelector('#popup-shape-color');
        inputColor.addEventListener('input', (e) => {
            const val = e.target.value;
            shape.color = val;
            shape.setKeyframe(this.state.currentTime, { color: val });
            this.state.emit('shapesUpdated', this.state.shapes);
            this.render();
        });

        const inputStroke = popup.querySelector('#popup-shape-stroke');
        inputStroke.addEventListener('input', (e) => {
            const val = e.target.value;
            shape.strokeColor = val;
            shape.setKeyframe(this.state.currentTime, { strokeColor: val });
            this.state.emit('shapesUpdated', this.state.shapes);
            this.render();
        });

        const inputBeta = popup.querySelector('#popup-shape-beta');
        inputBeta.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                shape.setBetaX(val);
                this.state.emit('shapesUpdated', this.state.shapes);
                this.render();
            }
        });

        popup.querySelector('#popup-btn-key').addEventListener('click', () => {
            shape.setKeyframe(this.state.currentTime, {
                color: inputColor.value,
                strokeColor: inputStroke.value
            });
            this.state.emit('shapesUpdated', this.state.shapes);
            this.hidePopup();
        });

        popup.querySelector('#popup-btn-delete').addEventListener('click', () => {
            this.deleteShape(shape.id);
        });
    }

    hidePopup() {
        if (this.popupEl) {
            this.popupEl.style.display = 'none';
        }
    }

    deleteShape(id) {
        this.state.shapes = this.state.shapes.filter(s => s.id !== id);
        this.state.setShapes(this.state.shapes);
        this.hidePopup();
    }

    deleteSelectedShape() {
        if (!this.state.selectedShapeId) return;
        this.deleteShape(this.state.selectedShapeId);
    }

    hitTestHandles(sx, sy, shape, t) {
        const s = shape.getStateAt(t, this.state.speedOfLight);
        const center = this.worldToScreen(s.x, s.y);
        const pivot = this.worldToScreen(s.pivotWorldX, s.pivotWorldY);

        // 1. Ручка пивота (радиус 10px)
        if (Math.hypot(sx - pivot.x, sy - pivot.y) <= 12) {
            return 'pivot';
        }

        // 2. Ручка вращения: находится над фигурой на расстоянии (H/2 + 25px) с учетом угла rotation
        const rad = (s.rotation * Math.PI) / 180;
        const distHandle = (s.height / 2 + 25) * this.scale;
        const rotHandleX = center.x + Math.sin(rad) * distHandle;
        const rotHandleY = center.y - Math.cos(rad) * distHandle;

        if (Math.hypot(sx - rotHandleX, sy - rotHandleY) <= 12) {
            return 'rotate';
        }

        // 3. Тело фигуры
        const wpos = this.screenToWorld(sx, sy);
        if (this.isPointInsideShape(wpos.x, wpos.y, s)) {
            return 'body';
        }

        return null;
    }

    isPointInsideShape(wx, wy, s) {
        // Переводим точку в локальные координаты фигуры с учетом угла вращения
        const dx = wx - s.x;
        const dy = wy - s.y;
        const rad = (-s.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        if (s.type === 'circle') {
            const r = (s.width + s.height) / 4;
            return (localX * localX + localY * localY) <= r * r;
        } else {
            return Math.abs(localX) <= s.width / 2 && Math.abs(localY) <= s.height / 2;
        }
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // 1. Очистка фона
        ctx.fillStyle = this.state.settings.frameBgColor || '#0e172a';
        ctx.fillRect(0, 0, w, h);

        // 2. Координатная сетка
        this.drawGrid();

        const tCurr = this.state.currentTime;
        const c = this.state.speedOfLight;
        const selectedShape = this.state.getSelectedShape();

        // 3. Отрисовка траектории пути для выбранного объекта
        if (selectedShape) {
            this.drawMotionPath(selectedShape, c);
        }

        // 4. Отрисовка всех фигур кадра в текущий момент t
        this.state.shapes.forEach(shape => {
            const isSelected = selectedShape && selectedShape.id === shape.id;
            this.drawShape(shape, tCurr, c, isSelected);
        });

        // 5. Отрисовка превью при рисовании
        if (this.dragState) {
            this.drawDrawingPreview();
        }

        // 6. Отрисовка позиции наблюдателя (камера / глаз)
        this.drawObserver(this.state.observer);
    }

    drawGrid() {
        const ctx = this.ctx;
        const step = 40 * this.scale;
        const cx = this.width / 2;
        const cy = this.height / 2;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = cx % step; x < this.width; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
        }
        for (let y = cy % step; y < this.height; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
        }
        ctx.stroke();

        // Главные оси X и Y
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(this.width, cy);
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, this.height);
        ctx.stroke();
    }

    drawMotionPath(shape, c) {
        if (!shape.keyframes || shape.keyframes.length === 0) return;
        const ctx = this.ctx;
        const dur = this.state.duration;
        const steps = 60;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * dur;
            const s = shape.getStateAt(t, c);
            const pt = this.worldToScreen(s.x, s.y);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Ключевые точки на пути (ромбики)
        shape.keyframes.forEach(kf => {
            const s = shape.getStateAt(kf.time, c);
            const pt = this.worldToScreen(s.x, s.y);

            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y - 5);
            ctx.lineTo(pt.x + 5, pt.y);
            ctx.lineTo(pt.x, pt.y + 5);
            ctx.lineTo(pt.x - 5, pt.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });
    }

    drawShape(shape, t, c, isSelected) {
        const ctx = this.ctx;
        const s = shape.getStateAt(t, c);
        const center = this.worldToScreen(s.x, s.y);
        const rad = (s.rotation * Math.PI) / 180;

        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rad);

        const w = s.width * this.scale;
        const h = s.height * this.scale;

        ctx.fillStyle = s.color || shape.color;
        ctx.strokeStyle = isSelected ? '#38bdf8' : (s.strokeColor || '#ffffff');
        ctx.lineWidth = isSelected ? 3 : (s.strokeWidth || 2);

        if (s.type === 'circle') {
            const r = Math.max(w, h) / 2;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Внутренний лучик для наглядности вращения круга
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(r, 0);
            ctx.stroke();
        } else {
            // Прямоугольник
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, 4);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();

        // Отрисовка манипуляторов выделения
        if (isSelected) {
            this.drawHandles(s, center, rad, w, h);
        }
    }

    drawHandles(s, center, rad, w, h) {
        const ctx = this.ctx;

        // 1. Ручка вращения: линия и шарик
        const distHandle = h / 2 + 25 * this.scale;
        const rotHandleX = center.x + Math.sin(rad) * distHandle;
        const rotHandleY = center.y - Math.cos(rad) * distHandle;

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(rotHandleX, rotHandleY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Кружочек ручки вращения
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rotHandleX, rotHandleY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 2. Пивот-поинт (центр вращения / орбиты)
        const pivotScreen = this.worldToScreen(s.pivotWorldX, s.pivotWorldY);

        // Линия от пивота к центру объекта
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pivotScreen.x, pivotScreen.y);
        ctx.lineTo(center.x, center.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Перекрестие пивота 🎯
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pivotScreen.x, pivotScreen.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(pivotScreen.x - 8, pivotScreen.y);
        ctx.lineTo(pivotScreen.x + 8, pivotScreen.y);
        ctx.moveTo(pivotScreen.x, pivotScreen.y - 8);
        ctx.lineTo(pivotScreen.x, pivotScreen.y + 8);
        ctx.stroke();
    }

    drawDrawingPreview() {
        const ds = this.dragState;
        if (!ds || (!ds.currentX && !ds.currentY)) return;
        const ctx = this.ctx;
        const start = this.worldToScreen(ds.startX, ds.startY);
        const curr = this.worldToScreen(ds.currentX, ds.currentY);

        ctx.strokeStyle = '#38bdf8';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        if (ds.mode === 'draw_rect') {
            const x = Math.min(start.x, curr.x);
            const y = Math.min(start.y, curr.y);
            const w = Math.abs(curr.x - start.x);
            const h = Math.abs(curr.y - start.y);
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();
        } else if (ds.mode === 'draw_circle') {
            const r = Math.hypot(curr.x - start.x, curr.y - start.y);
            ctx.beginPath();
            ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    drawObserver(obs) {
        const ctx = this.ctx;
        const pt = this.worldToScreen(obs.x, obs.y);

        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Наблюдатель', pt.x, pt.y + 16);
    }
}
