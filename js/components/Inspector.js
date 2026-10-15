/**
 * Inspector.js
 * Боковая панель свойств: физика пространства-времени, объекты сцены,
 * слои 3D и проекция 2D.
 * Угол светового конуса жестко определяет скорость света c.
 * Скорость фигур задается в долях от скорости света (beta = v/c).
 */

import { ShapeModel } from '../core/ShapeModel.js';

export class Inspector {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        this.renderDom();
        this.bindEvents();
    }

    renderDom() {
        this.container.innerHTML = `
            <div class="panel-section">
                <h3 class="section-title">⚡ Физика пространства-времени</h3>
                <div class="control-row">
                    <label>Угол светового конуса (задаёт скорость света c):</label>
                    <div class="slider-val-group">
                        <input type="range" id="slider-cone-angle" min="15" max="75" step="1" value="${this.state.settings.coneAngle}">
                        <span id="val-cone-angle" class="val-badge">${this.state.settings.coneAngle}°</span>
                    </div>
                    <div class="param-subtext" style="margin-top:6px; font-size:11px; color:#94a3b8;">
                        Скорость света: <strong id="val-c" style="color:#38bdf8;">${this.state.speedOfLight.toFixed(1)} px/s</strong>
                        <span style="display:block; font-size:10px; color:#64748b; margin-top:2px;">
                            (3D-конус и 2D-запаздывание жестко синхронизированы 1:1)
                        </span>
                    </div>
                </div>

                <div class="control-row" style="margin-top:12px;">
                    <label>Позиция наблюдателя X:</label>
                    <input type="range" id="slider-obs-x" min="-180" max="180" step="5" value="${this.state.observer.x}">
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header-flex">
                    <h3 class="section-title">📦 Объекты сцены</h3>
                    <div class="btn-group-sm">
                        <button id="btn-add-rod" class="btn btn-xs btn-primary">+ Стержень</button>
                        <button id="btn-add-barn" class="btn btn-xs btn-outline">+ Сарай</button>
                    </div>
                </div>

                <div id="shapes-list" class="shapes-list"></div>

                <div id="shape-props-box" class="shape-props-box" style="display:none;">
                    <div class="control-row">
                        <label>Имя:</label>
                        <input type="text" id="prop-shape-name" class="input-text-sm">
                    </div>

                    <div class="control-row">
                        <label>Цвет:</label>
                        <input type="color" id="prop-shape-color" class="input-color-sm">
                    </div>

                    <div class="control-row">
                        <label>Скорость (в долях от скорости света c, β = v/c):</label>
                        <div class="slider-val-group">
                            <input type="range" id="slider-shape-beta" min="-1.0" max="1.0" step="0.01" value="0.75">
                            <span id="val-shape-beta" class="val-badge">0.75 c</span>
                        </div>
                        <div style="margin-top:6px;">
                            <label style="font-size:10px; color:#94a3b8;">Точное значение β (любое число, без ограничений):</label>
                            <input type="number" id="prop-shape-beta-input" class="input-num-sm" step="0.05" style="width:100%;" placeholder="например 0.1, 0.85 или 1.5">
                        </div>
                    </div>

                    <div class="control-row-grid" style="margin-top:10px;">
                        <div>
                            <label>X₀ (старт):</label>
                            <input type="number" id="prop-shape-x0" class="input-num-sm" step="5">
                        </div>
                        <div>
                            <label>Ширина L₀:</label>
                            <input type="number" id="prop-shape-w" class="input-num-sm" min="10" max="300" step="5">
                        </div>
                    </div>

                    <div class="control-row">
                        <label>Высота H:</label>
                        <input type="number" id="prop-shape-h" class="input-num-sm" min="6" max="100" step="2" style="width:100%;">
                    </div>

                    <div class="control-row-grid" style="margin-top:6px;">
                        <div>
                            <label>Вращение (°):</label>
                            <input type="number" id="prop-shape-rot" class="input-num-sm" step="5" value="0">
                        </div>
                        <div>
                            <label>Обводка:</label>
                            <input type="color" id="prop-shape-stroke" class="input-color-sm" value="#ffffff">
                        </div>
                    </div>

                    <div class="control-row-grid">
                        <div>
                            <label>Пивот dX:</label>
                            <input type="number" id="prop-shape-pivot-x" class="input-num-sm" step="5" value="0">
                        </div>
                        <div>
                            <label>Пивот dY:</label>
                            <input type="number" id="prop-shape-pivot-y" class="input-num-sm" step="5" value="0">
                        </div>
                    </div>

                    <button id="btn-shape-add-key" class="btn btn-xs btn-primary btn-block mt-2">
                        ◆ Зафиксировать ключ (t = <span id="val-cur-time-label">0.00</span>s)
                    </button>

                    <button id="btn-delete-shape" class="btn btn-xs btn-danger btn-block mt-2">
                        Удалить объект
                    </button>
                </div>
            </div>

            <div class="panel-section">
                <h3 class="section-title">🌐 Вид 3D (Минковский)</h3>

                <div class="control-checkbox-row" style="background: rgba(56, 189, 248, 0.08); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25); margin-bottom: 12px;">
                    <label style="cursor: pointer; font-weight: 600; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="chk-hard-cut" ${this.state.settings.hardCutMode ? 'checked' : ''}>
                        Чистый срез (скрыть конус, кадры 100% / 0%)
                    </label>
                </div>

                <div class="control-row-grid" style="margin-bottom: 12px;">
                    <div>
                        <label>Цвет фона кадра:</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <input type="color" id="prop-frame-bg" class="input-color-sm" value="${this.state.settings.frameBgColor || '#133863'}">
                            <span id="val-frame-bg" style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted);">${this.state.settings.frameBgColor || '#133863'}</span>
                        </div>
                    </div>
                    <div>
                        <label>Цвет фона 3D:</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <input type="color" id="prop-3d-bg" class="input-color-sm" value="${this.state.settings.bg3DColor || '#070c18'}">
                            <span id="val-3d-bg" style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted);">${this.state.settings.bg3DColor || '#070c18'}</span>
                        </div>
                    </div>
                </div>

                <div class="control-row">
                    <label>Слои времени (кадры):</label>
                    <div class="slider-val-group">
                        <input type="range" id="slider-layers-count" min="12" max="72" step="6" value="${this.state.settings.layersCount}">
                        <span id="val-layers-count" class="val-badge">${this.state.settings.layersCount}</span>
                    </div>
                </div>

                <div class="control-row">
                    <label>Прозрачность 3D-конуса:</label>
                    <div class="slider-val-group">
                        <input type="range" id="slider-cone-opacity" min="0.05" max="0.8" step="0.05" value="${this.state.settings.coneOpacity ?? 0.25}">
                        <span id="val-cone-opacity" class="val-badge">${Math.round((this.state.settings.coneOpacity ?? 0.25) * 100)}%</span>
                    </div>
                </div>

                <div class="control-row">
                    <label>Кадр ВНУТРИ конуса (срез):</label>
                    <div class="slider-val-group">
                        <input type="range" id="slider-layer-inside" min="0.1" max="1.0" step="0.05" value="${this.state.settings.layerOpacityInside ?? 0.65}">
                        <span id="val-layer-inside" class="val-badge">${Math.round((this.state.settings.layerOpacityInside ?? 0.65) * 100)}%</span>
                    </div>
                </div>

                <div class="control-row">
                    <label>Кадр СНАРУЖИ конуса:</label>
                    <div class="slider-val-group">
                        <input type="range" id="slider-layer-outside" min="0.0" max="0.3" step="0.02" value="${this.state.settings.layerOpacityOutside ?? 0.05}">
                        <span id="val-layer-outside" class="val-badge">${Math.round((this.state.settings.layerOpacityOutside ?? 0.05) * 100)}%</span>
                    </div>
                </div>

                <div class="control-checkbox-row">
                    <label><input type="checkbox" id="chk-world-tubes" ${this.state.settings.showWorldTubes ? 'checked' : ''}> Мировые трубки (Worldtubes)</label>
                </div>

                <div class="control-checkbox-row">
                    <label><input type="checkbox" id="chk-light-cone" ${this.state.settings.showLightCone ? 'checked' : ''}> 3D Световой конус</label>
                </div>
            </div>

            <div class="panel-section">
                <h3 class="section-title">👁️ Вид 2D (Наблюдатель)</h3>
                <div class="control-row">
                    <label>Режим восприятия:</label>
                    <select id="select-2d-mode" class="select-sm select-block">
                        <option value="both" ${this.state.settings.view2DMode === 'both' ? 'selected' : ''}>Оба (Сравнение и наложение)</option>
                        <option value="retarded" ${this.state.settings.view2DMode === 'retarded' ? 'selected' : ''}>Световой конус (Запаздывание)</option>
                        <option value="instant" ${this.state.settings.view2DMode === 'instant' ? 'selected' : ''}>Синхронно (Абсолютное t)</option>
                    </select>
                </div>

                <div class="control-checkbox-row">
                    <label><input type="checkbox" id="chk-measurement" ${this.state.settings.showMeasurement ? 'checked' : ''}> Линейка измерения стержня (HUD)</label>
                </div>
            </div>
        `;

        this.dom = {
            sliderConeAngle: this.container.querySelector('#slider-cone-angle'),
            valConeAngle: this.container.querySelector('#val-cone-angle'),
            valC: this.container.querySelector('#val-c'),
            sliderObsX: this.container.querySelector('#slider-obs-x'),

            btnAddRod: this.container.querySelector('#btn-add-rod'),
            btnAddBarn: this.container.querySelector('#btn-add-barn'),
            shapesList: this.container.querySelector('#shapes-list'),
            shapePropsBox: this.container.querySelector('#shape-props-box'),
            propName: this.container.querySelector('#prop-shape-name'),
            propColor: this.container.querySelector('#prop-shape-color'),
            sliderShapeBeta: this.container.querySelector('#slider-shape-beta'),
            valShapeBeta: this.container.querySelector('#val-shape-beta'),
            propShapeBetaInput: this.container.querySelector('#prop-shape-beta-input'),
            propX0: this.container.querySelector('#prop-shape-x0'),
            propW: this.container.querySelector('#prop-shape-w'),
            propH: this.container.querySelector('#prop-shape-h'),
            propRot: this.container.querySelector('#prop-shape-rot'),
            propStroke: this.container.querySelector('#prop-shape-stroke'),
            propPivotX: this.container.querySelector('#prop-shape-pivot-x'),
            propPivotY: this.container.querySelector('#prop-shape-pivot-y'),
            btnShapeAddKey: this.container.querySelector('#btn-shape-add-key'),
            valCurTimeLabel: this.container.querySelector('#val-cur-time-label'),
            btnDeleteShape: this.container.querySelector('#btn-delete-shape'),

            chkHardCut: this.container.querySelector('#chk-hard-cut'),
            propFrameBg: this.container.querySelector('#prop-frame-bg'),
            valFrameBg: this.container.querySelector('#val-frame-bg'),
            prop3dBg: this.container.querySelector('#prop-3d-bg'),
            val3dBg: this.container.querySelector('#val-3d-bg'),
            sliderLayersCount: this.container.querySelector('#slider-layers-count'),
            valLayersCount: this.container.querySelector('#val-layers-count'),
            sliderConeOpacity: this.container.querySelector('#slider-cone-opacity'),
            valConeOpacity: this.container.querySelector('#val-cone-opacity'),
            sliderLayerInside: this.container.querySelector('#slider-layer-inside'),
            valLayerInside: this.container.querySelector('#val-layer-inside'),
            sliderLayerOutside: this.container.querySelector('#slider-layer-outside'),
            valLayerOutside: this.container.querySelector('#val-layer-outside'),
            chkWorldTubes: this.container.querySelector('#chk-world-tubes'),
            chkLightCone: this.container.querySelector('#chk-light-cone'),
            select2DMode: this.container.querySelector('#select-2d-mode'),
            chkMeasurement: this.container.querySelector('#chk-measurement')
        };

        this.renderShapesList();
        this.updateShapeProps();
    }

    bindEvents() {
        // Угол светового конуса жестко управляет и 3D-конусом, и 2D-скоростью света
        this.dom.sliderConeAngle.addEventListener('input', (e) => {
            const angle = parseInt(e.target.value);
            this.dom.valConeAngle.textContent = `${angle}°`;
            this.state.setConeAngle(angle);
            this.dom.valC.textContent = `${this.state.speedOfLight.toFixed(1)} px/s`;
            this.updateShapeProps();
        });

        // Положение наблюдателя
        this.dom.sliderObsX.addEventListener('input', (e) => {
            this.state.observer.x = parseFloat(e.target.value);
            this.state.emit('settingsChanged', this.state.settings);
            this.state.emit('timeUpdated', this.state.currentTime);
        });

        // Добавление стержня
        this.dom.btnAddRod.addEventListener('click', () => {
            const newShape = new ShapeModel({
                name: 'Новый стержень',
                type: 'rod',
                color: '#34d399',
                x0: -180,
                betaX: 0.6,
                speedOfLight: this.state.speedOfLight,
                width: 60,
                height: 20
            });
            this.state.shapes.push(newShape);
            this.state.setShapes(this.state.shapes);
            this.state.selectShape(newShape.id);
        });

        // Добавление сарая
        this.dom.btnAddBarn.addEventListener('click', () => {
            const newShape = new ShapeModel({
                name: 'Сарай',
                type: 'barn',
                color: '#fbbf24',
                x0: 0,
                betaX: 0.0,
                speedOfLight: this.state.speedOfLight,
                width: 100,
                height: 45
            });
            this.state.shapes.push(newShape);
            this.state.setShapes(this.state.shapes);
            this.state.selectShape(newShape.id);
        });

        // Редактирование скорости через ползунок beta
        this.dom.sliderShapeBeta.addEventListener('input', (e) => {
            const shape = this.state.getSelectedShape();
            if (!shape) return;
            const beta = parseFloat(e.target.value);
            shape.setBetaX(beta);
            this.dom.propShapeBetaInput.value = beta;
            this.dom.valShapeBeta.textContent = `${beta.toFixed(2)} c`;
            this.state.emit('shapesUpdated', this.state.shapes);
        });

        // Редактирование скорости через свободное числовое поле ввода (без ограничений)
        this.dom.propShapeBetaInput.addEventListener('input', (e) => {
            const shape = this.state.getSelectedShape();
            if (!shape) return;
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                shape.setBetaX(val);
                if (val >= -1.0 && val <= 1.0) {
                    this.dom.sliderShapeBeta.value = val;
                }
                this.dom.valShapeBeta.textContent = `${val.toFixed(2)} c`;
                this.state.emit('shapesUpdated', this.state.shapes);
            }
        });

        // Редактирование остальных свойств фигуры
        const updateCurrentShape = () => {
            const shape = this.state.getSelectedShape();
            if (!shape) return;
            shape.name = this.dom.propName.value;
            shape.color = this.dom.propColor.value;
            shape.strokeColor = this.dom.propStroke.value;
            shape.x0 = parseFloat(this.dom.propX0.value) || 0;
            shape.width = parseFloat(this.dom.propW.value) || 10;
            shape.height = parseFloat(this.dom.propH.value) || 10;
            shape.rotation = parseFloat(this.dom.propRot.value) || 0;
            shape.pivotX = parseFloat(this.dom.propPivotX.value) || 0;
            shape.pivotY = parseFloat(this.dom.propPivotY.value) || 0;
            this.renderShapesList();
            this.state.emit('shapesUpdated', this.state.shapes);
        };

        this.dom.propName.addEventListener('input', updateCurrentShape);
        this.dom.propColor.addEventListener('input', updateCurrentShape);
        this.dom.propStroke.addEventListener('input', updateCurrentShape);
        this.dom.propX0.addEventListener('input', updateCurrentShape);
        this.dom.propW.addEventListener('input', updateCurrentShape);
        this.dom.propH.addEventListener('input', updateCurrentShape);
        this.dom.propRot.addEventListener('input', updateCurrentShape);
        this.dom.propPivotX.addEventListener('input', updateCurrentShape);
        this.dom.propPivotY.addEventListener('input', updateCurrentShape);

        this.dom.btnShapeAddKey.addEventListener('click', () => {
            const shape = this.state.getSelectedShape();
            if (shape) {
                const t = this.state.currentTime;
                shape.setKeyframe(t, {
                    x: shape.x0,
                    y: shape.y0,
                    rotation: shape.rotation,
                    pivotX: shape.pivotX,
                    pivotY: shape.pivotY,
                    color: shape.color,
                    strokeColor: shape.strokeColor
                });
                this.state.emit('shapesUpdated', this.state.shapes);
            }
        });

        // Удаление фигуры
        this.dom.btnDeleteShape.addEventListener('click', () => {
            const shape = this.state.getSelectedShape();
            if (!shape) return;
            this.state.shapes = this.state.shapes.filter(s => s.id !== shape.id);
            this.state.setShapes(this.state.shapes);
        });

        // Настройки 3D
        this.dom.sliderLayersCount.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.dom.valLayersCount.textContent = val;
            this.state.updateSetting('layersCount', val);
        });

        this.dom.sliderConeOpacity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.dom.valConeOpacity.textContent = `${Math.round(val * 100)}%`;
            this.state.updateSetting('coneOpacity', val);
        });

        this.dom.sliderLayerInside.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.dom.valLayerInside.textContent = `${Math.round(val * 100)}%`;
            this.state.updateSetting('layerOpacityInside', val);
        });

        this.dom.sliderLayerOutside.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.dom.valLayerOutside.textContent = `${Math.round(val * 100)}%`;
            this.state.updateSetting('layerOpacityOutside', val);
        });

        this.dom.chkHardCut.addEventListener('change', (e) => {
            this.state.updateSetting('hardCutMode', e.target.checked);
        });

        this.dom.propFrameBg.addEventListener('input', (e) => {
            const val = e.target.value;
            this.dom.valFrameBg.textContent = val;
            this.state.updateSetting('frameBgColor', val);
        });

        this.dom.prop3dBg.addEventListener('input', (e) => {
            const val = e.target.value;
            this.dom.val3dBg.textContent = val;
            this.state.updateSetting('bg3DColor', val);
        });

        this.dom.chkWorldTubes.addEventListener('change', (e) => {
            this.state.updateSetting('showWorldTubes', e.target.checked);
        });

        this.dom.chkLightCone.addEventListener('change', (e) => {
            this.state.updateSetting('showLightCone', e.target.checked);
        });

        // Настройки 2D
        this.dom.select2DMode.addEventListener('change', (e) => {
            this.state.updateSetting('view2DMode', e.target.value);
        });

        this.dom.chkMeasurement.addEventListener('change', (e) => {
            this.state.updateSetting('showMeasurement', e.target.checked);
        });

        // Слушатели событий состояния
        this.state.on('timeUpdated', (t) => {
            if (this.dom.valCurTimeLabel) {
                this.dom.valCurTimeLabel.textContent = t.toFixed(2);
            }
        });

        this.state.on('shapesUpdated', () => {
            this.renderShapesList();
            this.updateShapeProps();
        });

        this.state.on('shapeSelected', () => {
            this.renderShapesList();
            this.updateShapeProps();
        });

        this.state.on('settingsChanged', () => {
            this.dom.sliderConeAngle.value = this.state.settings.coneAngle;
            this.dom.valConeAngle.textContent = `${this.state.settings.coneAngle}°`;
            this.dom.valC.textContent = `${this.state.speedOfLight.toFixed(1)} px/s`;
            if (this.dom.chkHardCut) {
                this.dom.chkHardCut.checked = !!this.state.settings.hardCutMode;
            }
            if (this.dom.propFrameBg) {
                this.dom.propFrameBg.value = this.state.settings.frameBgColor || '#133863';
                this.dom.valFrameBg.textContent = this.state.settings.frameBgColor || '#133863';
            }
            if (this.dom.prop3dBg) {
                this.dom.prop3dBg.value = this.state.settings.bg3DColor || '#070c18';
                this.dom.val3dBg.textContent = this.state.settings.bg3DColor || '#070c18';
            }
            this.updateShapeProps();
        });
    }

    renderShapesList() {
        const list = this.dom.shapesList;
        list.innerHTML = '';

        this.state.shapes.forEach(shape => {
            const item = document.createElement('div');
            item.className = `shape-item ${shape.id === this.state.selectedShapeId ? 'active' : ''}`;
            const betaStr = (shape.betaX !== undefined ? shape.betaX.toFixed(2) : '0') + 'c';
            const typeLabel = shape.type === 'circle' ? 'Круг' : (shape.type === 'barn' ? 'Сарай' : 'Прямоуг');
            item.innerHTML = `
                <span class="shape-badge-color" style="background:${shape.color};"></span>
                <span class="shape-item-name">${shape.name}</span>
                <span class="shape-item-type">${shape.keyframes && shape.keyframes.length > 0 ? 'Анимация' : betaStr} (${typeLabel})</span>
            `;
            item.addEventListener('click', () => {
                this.state.selectShape(shape.id);
            });
            list.appendChild(item);
        });
    }

    updateShapeProps() {
        const shape = this.state.getSelectedShape();
        if (!shape) {
            this.dom.shapePropsBox.style.display = 'none';
            return;
        }

        this.dom.shapePropsBox.style.display = 'block';
        this.dom.propName.value = shape.name;
        this.dom.propColor.value = shape.color;
        if (this.dom.propStroke) this.dom.propStroke.value = shape.strokeColor || '#ffffff';
        this.dom.propX0.value = shape.x0;
        this.dom.propW.value = shape.width;
        this.dom.propH.value = shape.height;
        if (this.dom.propRot) this.dom.propRot.value = shape.rotation ?? 0;
        if (this.dom.propPivotX) this.dom.propPivotX.value = shape.pivotX ?? 0;
        if (this.dom.propPivotY) this.dom.propPivotY.value = shape.pivotY ?? 0;

        const beta = shape.betaX ?? 0;
        this.dom.sliderShapeBeta.value = Math.max(-1.0, Math.min(1.0, beta));
        this.dom.propShapeBetaInput.value = beta;
        const absVx = (beta * this.state.speedOfLight).toFixed(1);
        this.dom.valShapeBeta.textContent = `${beta.toFixed(2)} c (${absVx} px/s)`;
    }
}
