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
                this.drawInstantShape(shape, tCurr, c, mode === 'both');
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
    drawInstantShape(shape, tCurr, c, isGhost) {
        const ctx = this.ctx;
        const state = shape.getStateAt(tCurr, c);
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
        const stateInstant = shape.getStateAt(tCurr, c);

        // Физический световой горизонт наблюдателя:
        // Фотоны могли дойти только из круга радиусом R = c * tCurr (испущенные в t >= 0)
        const maxRadius = c * tCurr;
        if (maxRadius <= 0.001) {
            if (shape.type === 'rod' || this.state.shapes[0] === shape) {
                this.currentMeasurement = { isVisible: false, realLength: stateInstant.width };
            }
            return;
        }

        // Сканируем только внутри причинного светового горизонта [obs.x - maxRadius, obs.x + maxRadius]
        const startX = Math.max(-250, obs.x - maxRadius);
        const endX = Math.min(250, obs.x + maxRadius);
        const stepX = 1.0;

        ctx.save();
        ctx.fillStyle = shape.color;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;

        let activeStripes = [];

        for (let x = startX; x <= endX; x += stepX) {
            const tRet = SpacetimeMath.getRetardedTime(x, stateInstant.y, obs.x, obs.y, tCurr, c);
            // Если tRet < 0: событие произошло ДО начала симуляции (до t=0).
            // До наблюдателя этот свет ещё не успел дойти!
            if (tRet < 0) continue;

            const pastState = shape.getStateAt(tRet, c);

            // Проверяем, находится ли точка x внутри прямоугольника в момент tRet
            const halfW = pastState.width / 2;
            if (x >= pastState.x - halfW && x <= pastState.x + halfW) {
                const screenP = this.worldToScreen(x, pastState.y);
                const halfH = (pastState.height / 2) * this.scale;
                activeStripes.push({
                    worldX: x,
                    sx: screenP.x,
                    sy: screenP.y,
                    topY: screenP.y - halfH,
                    botY: screenP.y + halfH,
                    doorsOpen: pastState.doorsOpen
                });
            }
        }

        // Сохраняем точные данные для линейки измерения
        if (shape.type === 'rod' || this.state.shapes[0] === shape) {
            if (activeStripes.length > 0) {
                const first = activeStripes[0];
                const last = activeStripes[activeStripes.length - 1];
                const obsLen = last.worldX - first.worldX;
                this.currentMeasurement = {
                    isVisible: true,
                    minScreenX: first.sx,
                    maxScreenX: last.sx,
                    screenY: (first.topY + first.botY) / 2,
                    observedLength: Math.max(1, obsLen),
                    realLength: stateInstant.width,
                    factor: stateInstant.width > 0 ? (obsLen / stateInstant.width) : 1
                };
            } else {
                this.currentMeasurement = {
                    isVisible: false,
                    realLength: stateInstant.width
                };
            }
        }

        // Если фигура видна в поле зрения светового конуса
        if (activeStripes.length > 0) {
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
        const m = this.currentMeasurement;
        const hudX = 20;
        const hudY = this.height - 95;
        const ctx = this.ctx;

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, 280, 80, 8);
        ctx.fill();
        ctx.stroke();

        if (!m || !m.isVisible) {
            // Стержень ещё за пределами светового горизонта!
            ctx.fillStyle = '#f8fafc';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillText(`Истинная длина L₀: ${m ? Math.round(m.realLength) : 70} px`, hudX + 12, hudY + 24);

            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillText(`Свет ещё не дошёл до наблюдателя`, hudX + 12, hudY + 46);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillText(`(Вне светового конуса, t_ret < 0)`, hudX + 12, hudY + 66);
            ctx.restore();
            return;
        }

        // Если виден: рисуем линейку в точности под видимым контуром
        const rulerY = m.screenY + 24 * this.scale;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(m.minScreenX, rulerY);
        ctx.lineTo(m.maxScreenX, rulerY);
        // Засечки
        ctx.moveTo(m.minScreenX, rulerY - 5);
        ctx.lineTo(m.minScreenX, rulerY + 5);
        ctx.moveTo(m.maxScreenX, rulerY - 5);
        ctx.lineTo(m.maxScreenX, rulerY + 5);
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(`Истинная длина L₀: ${Math.round(m.realLength)} px`, hudX + 12, hudY + 22);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillText(`Кажущаяся длина L: ${Math.round(m.observedLength)} px`, hudX + 12, hudY + 43);

        const factorText = m.factor.toFixed(2);
        const factorColor = m.factor > 1.05 ? '#4ade80' : (m.factor < 0.95 ? '#f43f5e' : '#94a3b8');
        const stateWord = m.factor > 1.05 ? 'РАСТЯЖЕНИЕ' : (m.factor < 0.95 ? 'СЖАТИЕ' : 'НОРМА');

        ctx.fillStyle = factorColor;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(`Коэффициент k = ${factorText} (${stateWord})`, hudX + 12, hudY + 64);

        ctx.restore();
    }
}
