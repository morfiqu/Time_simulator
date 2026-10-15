/**
 * LorentzDiagram.js
 * Интерактивная диаграмма 4-скорости и Лоренцева сокращения длины (диаграмма Эпштейна).
 * 
 * Наглядно демонстрирует фундаментальный постулат СТО:
 * «Все объекты в пространстве-времени всегда движутся со скоростью света c».
 * Отрезок постоянной длины c наклоняется при увеличении пространственной скорости v,
 * что приводит к замедлению времени и сжатию длины тела по теореме Пифагора:
 * L = L0 * sqrt(1 - (v/c)^2) = L0 / gamma
 */

export class LorentzDiagram {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        this.canvas = null;
        this.ctx = null;
        this.width = 290;
        this.height = 190;

        this.isDragging = false;

        this.renderDom();
        this.initCanvas();
        this.bindEvents();
    }

    renderDom() {
        this.container.innerHTML = `
            <div class="lorentz-card">
                <div class="lorentz-canvas-wrapper" style="position:relative; width:100%; display:flex; justify-content:center;">
                    <canvas id="lorentz-canvas" style="display:block; border-radius:6px; background:#070d1a; border:1px solid #1a2744; cursor:grab;"></canvas>
                </div>

                <!-- Блок числовых показателей релятивистских эффектов -->
                <div class="lorentz-stats-grid">
                    <div class="lorentz-stat-box">
                        <span class="lorentz-stat-label">Скорость β (v/c)</span>
                        <strong id="lorentz-val-beta" class="lorentz-stat-val text-primary">0.75 c</strong>
                    </div>
                    <div class="lorentz-stat-box">
                        <span class="lorentz-stat-label">Фактор γ (гамма)</span>
                        <strong id="lorentz-val-gamma" class="lorentz-stat-val text-gold">1.51</strong>
                    </div>
                    <div class="lorentz-stat-box">
                        <span class="lorentz-stat-label">Ход времени (τ / t)</span>
                        <strong id="lorentz-val-time-rate" class="lorentz-stat-val text-cyan">66.1%</strong>
                    </div>
                    <div class="lorentz-stat-box">
                        <span class="lorentz-stat-label">Длина L / L₀</span>
                        <strong id="lorentz-val-length-rate" class="lorentz-stat-val text-green">66.1%</strong>
                    </div>
                </div>

                <!-- 1D-визуализация сжатия стержня -->
                <div class="lorentz-rod-box">
                    <div class="lorentz-rod-header">
                        <span>Сравнение длин (1D срез стержня):</span>
                        <span id="lorentz-rod-lengths" style="font-family:var(--font-mono); color:var(--text-muted);">L₀: 70px ➔ L: 46px</span>
                    </div>
                    <div class="lorentz-rod-container">
                        <!-- Исходная длина покоя L0 (полупрозрачный эталон) -->
                        <div class="rod-bar rod-rest" id="rod-bar-rest" title="Собственная длина покоя L0 (100%)">
                            <span class="rod-tag">L₀ (покой)</span>
                        </div>
                        <!-- Лоренцево сжатая длина L -->
                        <div class="rod-bar rod-contracted" id="rod-bar-contracted" title="Лоренцево сжатая длина L при текущей скорости">
                            <span class="rod-tag" id="rod-tag-contracted">L (сжато)</span>
                        </div>
                    </div>
                </div>

                <!-- Пресеты скоростей -->
                <div class="lorentz-preset-buttons">
                    <button class="btn btn-xs btn-outline btn-beta-preset" data-beta="0.0">0.0 c (покой)</button>
                    <button class="btn btn-xs btn-outline btn-beta-preset" data-beta="0.5">0.50 c</button>
                    <button class="btn btn-xs btn-outline btn-beta-preset" data-beta="0.75">0.75 c</button>
                    <button class="btn btn-xs btn-outline btn-beta-preset" data-beta="0.866" title="Скорость, при которой длина уменьшается ровно в 2 раза (gamma = 2.0)">½ L₀ (0.87c)</button>
                    <button class="btn btn-xs btn-outline btn-beta-preset" data-beta="0.95">0.95 c</button>
                </div>
            </div>
        `;

        this.dom = {
            canvas: this.container.querySelector('#lorentz-canvas'),
            valBeta: this.container.querySelector('#lorentz-val-beta'),
            valGamma: this.container.querySelector('#lorentz-val-gamma'),
            valTimeRate: this.container.querySelector('#lorentz-val-time-rate'),
            valLengthRate: this.container.querySelector('#lorentz-val-length-rate'),
            rodLengths: this.container.querySelector('#lorentz-rod-lengths'),
            rodRest: this.container.querySelector('#rod-bar-rest'),
            rodContracted: this.container.querySelector('#rod-bar-contracted'),
            rodTagContracted: this.container.querySelector('#rod-tag-contracted'),
            presetButtons: this.container.querySelectorAll('.btn-beta-preset')
        };
    }

    initCanvas() {
        this.canvas = this.dom.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.onResize();
    }

    onResize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = Math.max(260, rect.width || 290);
        this.height = 160;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);

        this.render();
    }

    bindEvents() {
        // Реакция на события приложения
        this.state.on('shapesUpdated', () => this.render());
        this.state.on('shapeSelected', () => this.render());
        this.state.on('settingsChanged', () => this.render());

        window.addEventListener('resize', () => this.onResize());

        // Кнопки пресетов
        this.dom.presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const beta = parseFloat(btn.dataset.beta);
                this.setBeta(beta);
            });
        });

        // Интерактивное перетаскивание стрелки мышью по дуге
        const handleMove = (e) => {
            if (!this.isDragging) return;
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const originX = this.width / 2;
            const originY = this.height - 24;

            const dx = mouseX - originX;
            const dy = originY - mouseY; // вверх - положительный

            if (dy <= 2) {
                // Если мышь опустилась ниже оси, скорость максимальна
                this.setBeta(dx >= 0 ? 0.99 : -0.99);
                return;
            }

            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 10) return;

            // beta = sin(angle) = dx / dist
            let beta = dx / dist;
            beta = Math.max(-0.99, Math.min(0.99, beta));
            this.setBeta(beta);
        };

        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
            handleMove(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                handleMove(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'grab';
            }
        });
    }

    setBeta(beta) {
        const shape = this.state.getSelectedShape() || this.state.shapes[0];
        if (!shape) return;

        shape.setBetaX(beta);
        this.state.emit('shapesUpdated', this.state.shapes);
        this.render();
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        const shape = this.state.getSelectedShape() || this.state.shapes[0];
        const beta = shape ? (shape.betaX ?? 0) : 0.75;
        const absBeta = Math.min(0.999, Math.abs(beta));
        const sign = beta >= 0 ? 1 : -1;

        // Физические величины
        const factor = Math.sqrt(Math.max(0.001, 1 - absBeta * absBeta)); // 1 / gamma
        const gamma = 1 / factor;
        const timeRatePct = (factor * 100).toFixed(1);
        const lengthPct = (factor * 100).toFixed(1);

        // Обновляем статистику в DOM
        this.dom.valBeta.textContent = `${beta.toFixed(2)} c`;
        this.dom.valGamma.textContent = gamma.toFixed(2);
        this.dom.valTimeRate.textContent = `${timeRatePct}%`;
        this.dom.valLengthRate.textContent = `${lengthPct}%`;

        // Обновляем плашку стержня
        const l0 = shape ? shape.width : 70;
        const lContracted = Math.max(2, Math.round(l0 * factor));
        this.dom.rodLengths.textContent = `L₀: ${Math.round(l0)}px ➔ L: ${lContracted}px`;

        const shapeColor = shape ? shape.color : '#38bdf8';
        this.dom.rodRest.style.borderColor = shapeColor;
        this.dom.rodContracted.style.backgroundColor = shapeColor;
        this.dom.rodContracted.style.boxShadow = `0 0 10px ${shapeColor}66`;
        this.dom.rodContracted.style.width = `${Math.max(4, factor * 100)}%`;
        this.dom.rodTagContracted.textContent = `L = ${lengthPct}%`;

        // Геометрия графика на Canvas
        const originX = w / 2;
        const originY = h - 25;
        const radius = Math.min(originX - 25, originY - 25);

        // 1. Координатные оси
        ctx.strokeStyle = '#1e2e4f';
        ctx.lineWidth = 1;

        // Горизонтальная ось (Пространство v)
        ctx.beginPath();
        ctx.moveTo(15, originY);
        ctx.lineTo(w - 15, originY);
        ctx.stroke();

        // Вертикальная ось (Время t)
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX, 15);
        ctx.stroke();

        // 2. Дуга постоянной скорости света (c = const)
        ctx.beginPath();
        ctx.arc(originX, originY, radius, Math.PI, 0, false);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Подпись дуги
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Постоянная скорость света c', originX, 18);

        // 3. Расчет положения вершины стрелки
        const tipX = originX + radius * beta;
        const tipY = originY - radius * factor;

        // 4. Проекционные пунктирные линии (катеты треугольника)
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Вертикальная проекция на ось времени (ход времени)
        ctx.beginPath();
        ctx.moveTo(originX, tipY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Горизонтальная проекция на ось пространства (скорость)
        ctx.beginPath();
        ctx.moveTo(tipX, originY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Метки проекций на осях
        ctx.fillStyle = '#facc15';
        ctx.font = '9px var(--font-mono, monospace)';
        ctx.textAlign = 'center';
        ctx.fillText(`${(absBeta * 100).toFixed(0)}% c`, tipX, originY + 14);

        ctx.textAlign = beta >= 0 ? 'right' : 'left';
        ctx.fillText(`Δτ: ${timeRatePct}%`, originX + (beta >= 0 ? -6 : 6), tipY + 3);

        // 5. Вектор 4-скорости (стрелка постоянной длины c)
        ctx.save();
        ctx.strokeStyle = shapeColor;
        ctx.fillStyle = shapeColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = shapeColor;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Наконечник стрелки / Draggable Handle
        ctx.beginPath();
        ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // 6. Подписи осей
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('+c', w - 24, originY - 4);
        ctx.textAlign = 'right';
        ctx.fillText('-c', 24, originY - 4);
        ctx.textAlign = 'center';
        ctx.fillText('0', originX, originY + 12);
    }
}
