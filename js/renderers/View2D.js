/**
 * View2D.js
 * 2D-визуализация вида с точки зрения наблюдателя (срез светового конуса).
 * Демонстрирует оптические релятивистские деформации (эффект Террелла — Пенроуза),
 * разницу между синхронным временем и запаздывающим сигналом.
 */

import { SpacetimeMath } from '../core/SpacetimeMath.js';

function hexToRgba(hex, alpha = 1.0) {
    if (!hex) return `rgba(56, 189, 248, ${alpha})`;
    if (hex.startsWith('rgb')) return hex;
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
        this.state.on('durationChanged', () => this.render());
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

        // 1. Очистка фона (Цвет фона кадра)
        ctx.fillStyle = this.state.settings.frameBgColor || '#0b1329';
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
        const rad = (state.rotation * Math.PI) / 180;
        const col = state.color || shape.color || '#38bdf8';

        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(rad);

        if (isGhost) {
            // Призрачный контур (истинное синхронное положение) с реальным цветом объекта
            ctx.strokeStyle = hexToRgba(col, 0.75);
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.fillStyle = hexToRgba(col, 0.15);

            if (state.type === 'circle') {
                const rx = w / 2;
                const ry = h / 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, Math.max(2, rx), ry, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(-w / 2, -h / 2, w, h);
                ctx.strokeRect(-w / 2, -h / 2, w, h);
            }

            // Текстовая метка "Истина (Sync)" цвета объекта
            ctx.fillStyle = hexToRgba(col, 0.9);
            ctx.font = '10px Inter, sans-serif';
            const labelText = state.lorentzFactor < 0.999 
                ? `Истина L=${Math.round(state.width)} (L₀=${Math.round(state.restWidth || state.width)})` 
                : `Истинное ${Math.round(state.x)}`;
            ctx.fillText(labelText, -w / 2, -h / 2 - 5);
        } else {
            ctx.fillStyle = col;
            ctx.strokeStyle = state.strokeColor || '#ffffff';
            ctx.lineWidth = state.strokeWidth || 1;

            if (state.type === 'circle') {
                const rx = w / 2;
                const ry = h / 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, Math.max(2, rx), ry, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(-w / 2, -h / 2, w, h);
                ctx.strokeRect(-w / 2, -h / 2, w, h);
            }
        }

        // Если это сарай, отрисовываем двери
        if (shape.type === 'barn') {
            this.drawBarnDoors({ x: 0, y: 0 }, w, h, state.doorsOpen, isGhost);
        }

        ctx.restore();
    }

    /**
     * Расчет точного положения и времени испускания для любой материальной точки фигуры
     */
    getRetardedPoint(shape, localU, localV, tCurr, obs, c, stateInstant) {
        const rad = (stateInstant.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Текущая мировая позиция этой материальной точки в момент tCurr:
        const xCurr = stateInstant.x + (localU * cos - localV * sin);
        const yCurr = stateInstant.y + (localU * sin + localV * cos);

        // Вектор от наблюдателя к текущей позиции точки:
        const Dx = xCurr - obs.x;
        const Dy = yCurr - obs.y;
        const distSq = Dx * Dx + Dy * Dy;

        const vx = stateInstant.vx || 0;
        const vy = stateInstant.vy || 0;
        const vSq = vx * vx + vy * vy;

        let tau = 0;
        if (vSq < 0.001 || c <= 0) {
            // Неподвижный объект
            tau = Math.sqrt(distSq) / c;
        } else {
            // Движущийся объект: точное решение релятивистского уравнения запаздывания
            const D_dot_v = Dx * vx + Dy * vy;
            const A = Math.max(0.001, c * c - vSq);
            const disc = D_dot_v * D_dot_v + A * distSq;
            tau = (-D_dot_v + Math.sqrt(Math.max(0, disc))) / A;
        }

        const tEmit = tCurr - tau;

        let xEmit, yEmit, col, doorsOpen;
        if (shape.keyframes && shape.keyframes.length > 1) {
            const pastS = shape.getStateAt(Math.max(0, tEmit), c);
            const pastRad = (pastS.rotation * Math.PI) / 180;
            const pCos = Math.cos(pastRad);
            const pSin = Math.sin(pastRad);
            xEmit = pastS.x + (localU * pCos - localV * pSin);
            yEmit = pastS.y + (localU * pSin + localV * pCos);
            col = pastS.color || shape.color;
            doorsOpen = pastS.doorsOpen;
        } else {
            xEmit = xCurr - vx * tau;
            yEmit = yCurr - vy * tau;
            col = stateInstant.color || shape.color;
            doorsOpen = stateInstant.doorsOpen;
        }

        return {
            worldX: xEmit,
            worldY: yEmit,
            tEmit,
            tau,
            isInsideHorizon: (tEmit >= 0),
            color: col,
            doorsOpen
        };
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
                this.currentMeasurement = {
                    isVisible: false,
                    realLength: stateInstant.width,
                    restLength: stateInstant.restWidth || stateInstant.width
                };
            }
            return;
        }

        // Строим 2D-полигон запаздывающих граничных точек фигуры
        const vertices = [];
        if (shape.type === 'circle') {
            const N = 48;
            const rx = stateInstant.width / 2;
            const ry = stateInstant.height / 2;
            for (let i = 0; i < N; i++) {
                const angle = (i / N) * Math.PI * 2;
                const u = rx * Math.cos(angle);
                const v = ry * Math.sin(angle);
                vertices.push(this.getRetardedPoint(shape, u, v, tCurr, obs, c, stateInstant));
            }
        } else {
            const halfW = stateInstant.width / 2;
            const halfH = stateInstant.height / 2;
            const segX = 16;
            const segY = 16;

            // Верхняя грань: слева направо (v = -halfH, u от -halfW до +halfW)
            for (let i = 0; i <= segX; i++) {
                const u = -halfW + (i / segX) * (2 * halfW);
                vertices.push(this.getRetardedPoint(shape, u, -halfH, tCurr, obs, c, stateInstant));
            }
            // Правая грань: сверху вниз (u = +halfW, v от -halfH до +halfH)
            for (let i = 1; i <= segY; i++) {
                const v = -halfH + (i / segY) * (2 * halfH);
                vertices.push(this.getRetardedPoint(shape, halfW, v, tCurr, obs, c, stateInstant));
            }
            // Нижняя грань: справа налево (v = +halfH, u от +halfW до -halfW)
            for (let i = 1; i <= segX; i++) {
                const u = halfW - (i / segX) * (2 * halfW);
                vertices.push(this.getRetardedPoint(shape, u, halfH, tCurr, obs, c, stateInstant));
            }
            // Левая грань: снизу вверх (u = -halfW, v от +halfH до -halfH)
            for (let i = 1; i < segY; i++) {
                const v = halfH - (i / segY) * (2 * halfH);
                vertices.push(this.getRetardedPoint(shape, -halfW, v, tCurr, obs, c, stateInstant));
            }
        }

        if (vertices.length === 0) return;

        // Проверяем, есть ли точки внутри причинного светового горизонта
        const visibleVertices = vertices.filter(v => v.tEmit >= 0);
        const hasVisible = visibleVertices.length > 0;

        // Измерение наблюдаемой длины стержня (для HUD)
        if (shape.type === 'rod' || this.state.shapes[0] === shape) {
            if (hasVisible) {
                let minX = Infinity;
                let maxX = -Infinity;
                let minScreenX = Infinity;
                let maxScreenX = -Infinity;
                let sumY = 0;

                visibleVertices.forEach(v => {
                    const sp = this.worldToScreen(v.worldX, v.worldY);
                    if (v.worldX < minX) minX = v.worldX;
                    if (v.worldX > maxX) maxX = v.worldX;
                    if (sp.x < minScreenX) minScreenX = sp.x;
                    if (sp.x > maxScreenX) maxScreenX = sp.x;
                    sumY += sp.y;
                });

                const obsLen = Math.max(1, maxX - minX);
                const avgScreenY = sumY / visibleVertices.length;

                this.currentMeasurement = {
                    isVisible: true,
                    minScreenX,
                    maxScreenX,
                    screenY: avgScreenY,
                    observedLength: obsLen,
                    realLength: stateInstant.width,
                    restLength: stateInstant.restWidth || stateInstant.width,
                    lorentzFactor: stateInstant.lorentzFactor || 1,
                    factor: stateInstant.width > 0 ? (obsLen / stateInstant.width) : 1
                };
            } else {
                this.currentMeasurement = {
                    isVisible: false,
                    realLength: stateInstant.width,
                    restLength: stateInstant.restWidth || stateInstant.width
                };
            }
        }

        if (!hasVisible) {
            // Тело полностью за пределами светового горизонта, свет ещё не дошел
            return;
        }

        const sObs = this.worldToScreen(obs.x, obs.y);
        const maxRadiusScreen = maxRadius * this.scale;

        ctx.save();

        // 1. Физическая отсечка причинным световым горизонтом:
        // Рисуем ТОЛЬКО внутри круга радиуса c * tCurr вокруг наблюдателя!
        ctx.beginPath();
        ctx.arc(sObs.x, sObs.y, maxRadiusScreen, 0, Math.PI * 2);
        ctx.clip();

        // 2. Отрисовываем ретардированный полигон фигуры
        ctx.beginPath();
        const p0 = this.worldToScreen(vertices[0].worldX, vertices[0].worldY);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < vertices.length; i++) {
            const p = this.worldToScreen(vertices[i].worldX, vertices[i].worldY);
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();

        // Поддержка градиента цвета при изменении во времени
        let fillStyle = vertices[0].color || shape.color || '#38bdf8';
        const lastColor = vertices[Math.floor(vertices.length / 2)].color;
        if (lastColor && fillStyle !== lastColor) {
            const pMid = this.worldToScreen(vertices[Math.floor(vertices.length / 2)].worldX, vertices[Math.floor(vertices.length / 2)].worldY);
            const grad = ctx.createLinearGradient(p0.x, p0.y, pMid.x, pMid.y);
            grad.addColorStop(0, fillStyle);
            grad.addColorStop(1, lastColor);
            fillStyle = grad;
        }

        const strokeColor = stateInstant.strokeColor || vertices[0].color || shape.color || '#ffffff';
        const strokeWidth = stateInstant.strokeWidth || 2;

        ctx.fillStyle = fillStyle;
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.shadowColor = vertices[0].color || shape.color || '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.stroke();

        // 3. Если это сарай, отрисовываем двери в их ретардированном состоянии
        if (shape.type === 'barn') {
            const halfW = stateInstant.width / 2;
            const ptLeft = this.getRetardedPoint(shape, -halfW, 0, tCurr, obs, c, stateInstant);
            const ptRight = this.getRetardedPoint(shape, halfW, 0, tCurr, obs, c, stateInstant);
            const sLeft = this.worldToScreen(ptLeft.worldX, ptLeft.worldY);
            const sRight = this.worldToScreen(ptRight.worldX, ptRight.worldY);
            const doorH = stateInstant.height * this.scale;

            if (ptLeft.tEmit >= 0) {
                this.drawBarnDoorAt(ctx, sLeft.x, sLeft.y, doorH, ptLeft.doorsOpen);
            }
            if (ptRight.tEmit >= 0) {
                this.drawBarnDoorAt(ctx, sRight.x, sRight.y, doorH, ptRight.doorsOpen);
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

        const restLen = m.restLength || m.realLength;
        const labLen = m.realLength;
        const obsLen = m.observedLength;

        ctx.fillStyle = '#f8fafc';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(`Собств. L₀: ${Math.round(restLen)} px ➔ В ИСО L_лаб: ${Math.round(labLen)} px`, hudX + 12, hudY + 22);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillText(`Видимая глазом L_вид: ${Math.round(obsLen)} px`, hudX + 12, hudY + 43);

        const factorText = m.factor.toFixed(2);
        const factorColor = m.factor > 1.05 ? '#4ade80' : (m.factor < 0.95 ? '#f43f5e' : '#94a3b8');
        const stateWord = m.factor > 1.05 ? 'ОПТИЧ. РАСТЯЖЕНИЕ' : (m.factor < 0.95 ? 'ОПТИЧ. СЖАТИЕ' : 'НОРМА');

        ctx.fillStyle = factorColor;
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`k_вид = ${factorText} (${stateWord}) | γ = ${(restLen / Math.max(1, labLen)).toFixed(2)}`, hudX + 12, hudY + 64);

        ctx.restore();
    }
}
