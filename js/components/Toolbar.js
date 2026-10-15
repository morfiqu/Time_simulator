/**
 * Toolbar.js
 * Верхняя панель управления: переключение режимов видового экрана (Сплит / 3D / 2D),
 * выбор физических сценариев-пресетов и быстрые действия.
 */

export class Toolbar {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        this.renderDom();
        this.bindEvents();
    }

    renderDom() {
        this.container.innerHTML = `
            <div class="toolbar-brand">
                <span class="brand-logo">⏱️</span>
                <span class="brand-title">Time Simulator</span>
                <span class="brand-tag">Minkowski & Light Cone</span>
            </div>

            <div class="toolbar-center">
                <div class="view-mode-buttons">
                    <button class="btn btn-sm btn-tab active" data-view="all" title="Все 3 окна (Редактор + 3D + 2D)">
                        ▦ Все 3 окна
                    </button>
                    <button class="btn btn-sm btn-tab" data-view="editor" title="Только Редактор кадра">
                        ✏️ Редактор
                    </button>
                    <button class="btn btn-sm btn-tab" data-view="3d" title="Только 3D пространство-время">
                        🌐 3D Минковский
                    </button>
                    <button class="btn btn-sm btn-tab" data-view="2d" title="Только 2D вид наблюдателя">
                        👁️ 2D Наблюдатель
                    </button>
                    <button class="btn btn-sm btn-tab" data-view="split" title="Двухоконный сплит (3D + 2D)">
                        ◫ 3D + 2D
                    </button>
                </div>
            </div>

            <div class="toolbar-right">
                <div class="preset-selector-group">
                    <label>Сценарий:</label>
                    <select id="select-preset" class="select-sm">
                        <option value="processingRod">⚡ Летящий стержень (Processing)</option>
                        <option value="barnAndPole">🚪 Парадокс шеста и сарая</option>
                        <option value="twoRodsCollision">↔️ Встречное движение двух тел</option>
                    </select>
                </div>

                <button id="btn-reset-time" class="btn btn-sm btn-outline" title="Сбросить время в начало (R)">
                    ↺ Сброс
                </button>

                <button id="btn-info" class="btn btn-sm btn-icon btn-ghost" title="О симуляторе">
                    ℹ️
                </button>
            </div>
        `;

        this.dom = {
            viewButtons: this.container.querySelectorAll('.btn-tab'),
            selectPreset: this.container.querySelector('#select-preset'),
            btnResetTime: this.container.querySelector('#btn-reset-time'),
            btnInfo: this.container.querySelector('#btn-info')
        };
    }

    bindEvents() {
        // Переключение вида 3D / 2D / Сплит
        this.dom.viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-view');
                this.state.setViewMode(mode);
            });
        });

        // Выбор пресета
        this.dom.selectPreset.addEventListener('change', (e) => {
            this.state.loadPreset(e.target.value);
        });

        // Сброс времени
        this.dom.btnResetTime.addEventListener('click', () => {
            this.state.setTime(0);
        });

        // Клавиша R для сброса
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.code === 'KeyR') {
                this.state.setTime(0);
            }
        });

        // Окно справки
        this.dom.btnInfo.addEventListener('click', () => {
            alert(
                "Time Simulator — Симулятор течения времени и световых конусов\n\n" +
                "• 3D Пространство-время: Ось Y — время t, горизонтальная плоскость XZ — пространство. Полупрозрачные слои показывают кадры прошлого, а световой конус срезает пространство-время.\n" +
                "• 2D Вид: Показывает, что реально видит камера/наблюдатель из-за запаздывания света со скоростью c.\n\n" +
                "Горячие клавиши:\n" +
                "• Пробел: Воспроизведение / Пауза\n" +
                "• ← / →: Покадровый шаг\n" +
                "• R: Сброс времени в 0"
            );
        });

        // Синхронизация подсветки кнопок вида
        this.state.on('viewModeChanged', (mode) => {
            this.dom.viewButtons.forEach(btn => {
                if (btn.getAttribute('data-view') === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        });
    }
}
