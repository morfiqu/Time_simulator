/**
 * Inspector.js
 * Боковая панель свойств: физика пространства-времени, настройки 3D Минковского и 2D Наблюдателя.
 * Меню объектов сцены вынесено в интерактивный 2D-редактор кадра.
 */

import { LorentzDiagram } from './LorentzDiagram.js';

export class Inspector {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        this.renderDom();
        this.initLorentzDiagram();
        this.bindEvents();
    }

    initLorentzDiagram() {
        const box = this.container.querySelector('#lorentz-diagram-box');
        if (box) {
            this.lorentzDiagram = new LorentzDiagram(box, this.state);
        }
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
                <h3 class="section-title">📐 Лоренцево сжатие (4-скорость)</h3>
                <div id="lorentz-diagram-box"></div>
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
    }

    bindEvents() {
        // Угол светового конуса жестко управляет и 3D-конусом, и 2D-скоростью света
        this.dom.sliderConeAngle.addEventListener('input', (e) => {
            const angle = parseInt(e.target.value);
            this.dom.valConeAngle.textContent = `${angle}°`;
            this.state.setConeAngle(angle);
            this.dom.valC.textContent = `${this.state.speedOfLight.toFixed(1)} px/s`;
        });

        // Положение наблюдателя
        this.dom.sliderObsX.addEventListener('input', (e) => {
            this.state.observer.x = parseFloat(e.target.value);
            this.state.emit('settingsChanged', this.state.settings);
            this.state.emit('timeUpdated', this.state.currentTime);
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
        });
    }
}
