/**
 * View2D.js
 * 2D-визуализация вида с точки зрения наблюдателя (срез светового конуса).
 * Демонстрирует оптические релятивистские деформации (эффект Террелла — Пенроуза),
 * разницу между синхронным временем и запаздывающим сигналом.
 */

import { SpacetimeMath } from '../core/SpacetimeMath.js';

export class View2D {
    constructor(canvasElement, state) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.state = state;

        // Координатная система: центр холста (0, 0)
        this.scale = 1.0;
        this.width = canvasElement.clientWidth || 500;
        this.height = canvasElement.clientHeight || 500;

        this.initCanvas();
        this.bindEvents();
    }

    initCanvas() {
        this.onResize();
    }

    bindEvents() {
        this.state.on('timeUpdated', () => this.render());
        this.state.on('shapesUpdated', () => this.render());
        this.state.on('settingsChanged', () => this.render());
        this.state.on('viewModeChanged', () => this.onResize());

        window.addEventListener('resize', () => this.onResize());
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

    /**
     * Преобразование физических координат (x, y) в экранные пиксели (px, py)
     */
    worldToScreen(wx, wy) {
        const cx = this.width / 2;
        const cy = this.height / 2;
        return {
            x: cx + wx * this.scale,
            y: cy + wy * this.scale
        };
    }

    render() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // 1. Очистка фона
        ctx.fillStyle = '#0b1329';
        ctx.fillRect(0, 0, w, h);

        // 2. Координатная сетка
        this.drawGrid();

        const tCurr = this.state.currentTime;
        const obs = this.state.observer;
        const c = this.state.speedOfLight;
        const mode = this.state.settings.view2DMode; // 'retarded', 'instant', 'both'

        // 3. Световые фронты / волны (кольца)
        this.drawLightWaves(tCurr, obs, c);

        // 4. Отрисовка фигур
        this.state.shapes.forEach(shape => {
            // Если включен режим 'both' или 'instant', рисуем синхронное положение (настоящее t = t_curr)
            if (mode === 'both' || mode === 'instant') {
                this.drawInstantShape(shape, tCurr, mode === 'both');
            }

            // Если включен режим 'both' или 'retarded', рисуем видимое релятивистское положение (свет с задержкой)
            if (mode === 'both' || mode === 'retarded') {
                this.drawRetardedShape(shape, tCurr, obs, c);
            }
        });

        // 5. Отрисовка наблюдателя (глаз / детектор)
        this.drawObserver(obs);

        // 6. Измерение стержня (HUD)
        if (this.state.settings.showMeasurement) {
            this.drawMeasurements(tCurr, obs, c);
        }
    }

    drawGrid() {
        const ctx = this.ctx;
        const cx = this.width / 2;
        const cy = this.height / 2;
        const step = 50 * this.scale;

        ctx.save();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;

        // Вертикальные линии
        for (let x = cx % step; x < this.width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }

        // Горизонтальные линии
        for (let y = cy % step; y < this.height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Главные оси X и Y
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(this.width, cy);
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, this.height);
        ctx.stroke();

        ctx.restore();
    }

    drawLightWaves(tCurr, obs, c) {
        if (!this.state.settings.showLightCone || tCurr <= 0) return;
        const ctx = this.ctx;
        const sObs = this.worldToScreen(obs.x, obs.y);
        const radius = c * tCurr * this.scale;

        // Внешний световой горизонт (срез конуса на момент начала)
        ctx.save();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(sObs.x, sObs.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Световой градиент внутри конуса
        const grad = ctx.createRadialGradient(sObs.x, sObs.y, 0, sObs.x, sObs.y, radius);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
        grad.addColorStop(0.85, 'rgba(6, 182, 212, 0.04)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.restore();
    }

    /**
     * Отрисовка синхронного (абсолютного) положения объекта в момент t_curr
     */
    drawInstantShape(shape, tCurr, isGhost) {
        const ctx = this.ctx;
        const state = shape.getStateAt(tCurr);
        const screen = this.worldToScreen(state.x, state.y);
        const w = state.width * this.scale;
        const h = state.height * this.scale;

        ctx.save();
        if (isGhost) {
            // Призрачный контур (истинное положение)
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
            ctx.fillRect(screen.x - w / 2, screen.y - h / 2, w, h);
            ctx.strokeRect(screen.x - w / 2, screen.y - h / 2, w, h);

            // Текстовая метка "Истина (Sync)"
            ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
            ctx.font = '10px Inter, sans-serif';
            ctx.fillText('Истинное ' + Math.round(state.x), screen.x - w / 2, screen.y - h / 2 - 5);
        } else {
            ctx.fillStyle = shape.color;
            ctx.fillRect(screen.x - w / 2, screen.y - h / 2, w, h);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(screen.x - w / 2, screen.y - h / 2, w, h);
        }

        // Если это сарай, отрисовываем двери
        if (shape.type === 'barn') {
            this.drawBarnDoors(screen, w, h, state.doorsOpen, isGhost);
        }

        ctx.restore();
    }

    /**
     * Отрисовка видимого (релятивистского) положения с учетом запаздывания света
     */
    drawRetardedShape(shape, tCurr, obs, c) {
        const ctx = this.ctx;
        const stateInstant = shape.getStateAt(tCurr);

        // Для отрисовки искривления формы сканируем вертикальные полосы стержня
        const stepX = 1.5;
        const searchRange = 250;
        const startX = stateInstant.x - stateInstant.width - searchRange;
        const endX = stateInstant.x + stateInstant.width + searchRange;

        ctx.save();
        ctx.fillStyle = shape.color;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;

        let activeStripes = [];

        for (let x = startX; x <= endX; x += stepX) {
            const tRet = SpacetimeMath.getRetardedTime(x, stateInstant.y, obs.x, obs.y, tCurr, c);
            const pastState = shape.getStateAt(tRet);

            // Проверяем, находится ли точка x внутри прямоугольника в момент tRet
            const halfW = pastState.width / 2;
            if (x >= pastState.x - halfW && x <= pastState.x + halfW) {
                const screenP = this.worldToScreen(x, pastState.y);
                const halfH = (pastState.height / 2) * this.scale;
                activeStripes.push({
                    sx: screenP.x,
                    topY: screenP.y - halfH,
                    botY: screenP.y + halfH,
                    doorsOpen: pastState.doorsOpen
                });
            }
        }

        // Если фигура видна в поле зрения
        if (activeStripes.length > 0) {
            // Рисуем видимый контур искаженного стержня
            ctx.beginPath();
            // Верхняя граница слева направо
            ctx.moveTo(activeStripes[0].sx, activeStripes[0].topY);
            for (let i = 1; i < activeStripes.length; i++) {
                ctx.lineTo(activeStripes[i].sx, activeStripes[i].topY);
            }
            // Правый торец
            ctx.lineTo(activeStripes[activeStripes.length - 1].sx, activeStripes[activeStripes.length - 1].botY);
            // Нижняя граница справа налево
            for (let i = activeStripes.length - 2; i >= 0; i--) {
                ctx.lineTo(activeStripes[i].sx, activeStripes[i].botY);
            }
            ctx.closePath();

            ctx.fillStyle = shape.color;
            ctx.fill();

            // Неоновая светящаяся обводка
            ctx.shadowColor = shape.color;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Если это сарай, отрисовываем состояние видимых дверей
            if (shape.type === 'barn') {
                const first = activeStripes[0];
                const last = activeStripes[activeStripes.length - 1];
                const h = last.botY - last.topY;
                const leftScreen = { x: first.sx, y: (first.topY + first.botY) / 2 };
                const rightScreen = { x: last.sx, y: (last.topY + last.botY) / 2 };
                this.drawBarnDoorAt(ctx, leftScreen.x, leftScreen.y, h, first.doorsOpen);
                this.drawBarnDoorAt(ctx, rightScreen.x, rightScreen.y, h, last.doorsOpen);
            }
        }

        ctx.restore();
    }

    drawBarnDoors(screen, w, h, isOpen, isGhost) {
        const ctx = this.ctx;
        ctx.save();
        this.drawBarnDoorAt(ctx, screen.x - w / 2, screen.y, h, isOpen, isGhost);
        this.drawBarnDoorAt(ctx, screen.x + w / 2, screen.y, h, isOpen, isGhost);
        ctx.restore();
    }

    drawBarnDoorAt(ctx, x, y, h, isOpen, isGhost = false) {
        ctx.save();
        ctx.lineWidth = 3;
        if (isOpen) {
            ctx.strokeStyle = '#22c55e'; // Зеленый: открыто
            ctx.beginPath();
            ctx.moveTo(x, y - h / 2);
            ctx.lineTo(x, y - h / 4);
            ctx.moveTo(x, y + h / 4);
            ctx.lineTo(x, y + h / 2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = '#ef4444'; // Красный: закрыто
            ctx.beginPath();
            ctx.moveTo(x, y - h / 2);
            ctx.lineTo(x, y + h / 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawObserver(obs) {
        const ctx = this.ctx;
        const sObs = this.worldToScreen(obs.x, obs.y);

        ctx.save();
        // Внешнее кольцо
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sObs.x, sObs.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Центр (зрачок)
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(sObs.x, sObs.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Прицел
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sObs.x - 14, sObs.y);
        ctx.lineTo(sObs.x + 14, sObs.y);
        ctx.moveTo(sObs.x, sObs.y - 14);
        ctx.lineTo(sObs.x, sObs.y + 14);
        ctx.stroke();

        // Подпись
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('Наблюдатель', sObs.x + 12, sObs.y - 10);

        ctx.restore();
    }

    drawMeasurements(tCurr, obs, c) {
        const shape = this.state.shapes.find(s => s.type === 'rod') || this.state.shapes[0];
        if (!shape) return;

        const measurement = SpacetimeMath.measureObservedRod(shape, obs.x, obs.y, tCurr, c);
        if (!measurement) return;

        const ctx = this.ctx;
        const sMin = this.worldToScreen(measurement.minX, 0);
        const sMax = this.worldToScreen(measurement.maxX, 0);
        const rulerY = sMin.y + 50;

        ctx.save();
        // Линейка измерения под стержнем
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sMin.x, rulerY);
        ctx.lineTo(sMax.x, rulerY);
        // Засечки
        ctx.moveTo(sMin.x, rulerY - 6);
        ctx.lineTo(sMin.x, rulerY + 6);
        ctx.moveTo(sMax.x, rulerY - 6);
        ctx.lineTo(sMax.x, rulerY + 6);
        ctx.stroke();

        // Плашка с данными (HUD)
        const hudX = 20;
        const hudY = this.height - 90;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, 260, 70, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(`Истинная длина L₀: ${Math.round(measurement.realLength)} px`, hudX + 12, hudY + 22);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillText(`Кажущаяся длина L: ${Math.round(measurement.observedLength)} px`, hudX + 12, hudY + 42);

        const factorText = measurement.factor.toFixed(2);
        const factorColor = measurement.factor > 1.05 ? '#4ade80' : (measurement.factor < 0.95 ? '#f43f5e' : '#94a3b8');
        const stateWord = measurement.factor > 1.05 ? 'РАСТЯЖЕНИЕ' : (measurement.factor < 0.95 ? 'СЖАТИЕ' : 'НОРМА');

        ctx.fillStyle = factorColor;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(`Коэффициент k = ${factorText} (${stateWord})`, hudX + 12, hudY + 60);

        ctx.restore();
    }
}
