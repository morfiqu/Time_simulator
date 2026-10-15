/**
 * ShapeModel.js
 * Модель объектов симуляции: стержни, сараи, излучатели и ключевые кадры анимации.
 */

export class ShapeModel {
    constructor(config = {}) {
        this.id = config.id || 'shape_' + Math.random().toString(36).substr(2, 9);
        this.name = config.name || 'Объект';
        this.type = config.type || 'rod'; // 'rod', 'barn', 'pulse'
        this.color = config.color || '#38bdf8';
        this.fillColor = config.fillColor || (this.color + '44');

        // Базовые параметры движения (линейная модель)
        this.x0 = config.x0 ?? -150;
        this.y0 = config.y0 ?? 0;
        this.vx = config.vx ?? 60; // px/s
        this.vy = config.vy ?? 0;

        // Размеры
        this.width = config.width ?? 70;
        this.height = config.height ?? 22;

        // Ключевые кадры (для нелинейной анимации в стиле Blender)
        // Формат: [ { time: 0, x: -150, y: 0, width: 70, height: 22, open: false }, ... ]
        this.keyframes = config.keyframes || null;

        // Специфика сарая (двери)
        this.barnDoorThickness = config.barnDoorThickness ?? 4;
        this.doorsOpen = config.doorsOpen ?? true;
        this.doorsCloseTime = config.doorsCloseTime ?? 2.5; // Время одновременного закрытия дверей
        this.doorsOpenTime = config.doorsOpenTime ?? 3.5;
    }

    /**
     * Получение состояния объекта в произвольный момент времени t
     */
    getStateAt(t) {
        // Если заданы ключевые кадры, интерполируем между ними
        if (this.keyframes && this.keyframes.length > 0) {
            return this._interpolateKeyframes(t);
        }

        // По умолчанию: линейное движение x(t) = x0 + vx * t
        const x = this.x0 + this.vx * t;
        const y = this.y0 + this.vy * t;

        let doorsOpen = true;
        if (this.type === 'barn') {
            doorsOpen = (t < this.doorsCloseTime || t > this.doorsOpenTime);
        }

        return {
            x,
            y,
            width: this.width,
            height: this.height,
            doorsOpen
        };
    }

    /**
     * Линейная интерполяция между ключевыми кадрами
     */
    _interpolateKeyframes(t) {
        if (this.keyframes.length === 1 || t <= this.keyframes[0].time) {
            return { ...this.keyframes[0] };
        }
        const last = this.keyframes[this.keyframes.length - 1];
        if (t >= last.time) {
            return { ...last };
        }

        // Поиск интервала [k1, k2]
        for (let i = 0; i < this.keyframes.length - 1; i++) {
            const k1 = this.keyframes[i];
            const k2 = this.keyframes[i + 1];
            if (t >= k1.time && t <= k2.time) {
                const alpha = (t - k1.time) / (k2.time - k1.time);
                return {
                    x: k1.x + (k2.x - k1.x) * alpha,
                    y: k1.y + (k2.y - k1.y) * alpha,
                    width: k1.width + (k2.width - k1.width) * alpha,
                    height: k1.height + (k2.height - k1.height) * alpha,
                    doorsOpen: alpha < 0.5 ? k1.doorsOpen : k2.doorsOpen
                };
            }
        }

        return { ...last };
    }

    /**
     * Добавление / обновление ключевого кадра в момент t
     */
    setKeyframe(time, params = {}) {
        if (!this.keyframes) {
            this.keyframes = [];
        }
        const current = this.getStateAt(time);
        const newKey = {
            time: Math.round(time * 100) / 100,
            x: params.x ?? current.x,
            y: params.y ?? current.y,
            width: params.width ?? current.width,
            height: params.height ?? current.height,
            doorsOpen: params.doorsOpen ?? current.doorsOpen
        };

        const existingIndex = this.keyframes.findIndex(k => Math.abs(k.time - time) < 0.05);
        if (existingIndex >= 0) {
            this.keyframes[existingIndex] = newKey;
        } else {
            this.keyframes.push(newKey);
            this.keyframes.sort((a, b) => a.time - b.time);
        }
    }
}

/**
 * Библиотека готовых пресетов
 */
export const Presets = {
    /**
     * Пресет 1: Летающий стержень (как в скетче Processing)
     */
    processingRod() {
        return [
            new ShapeModel({
                id: 'flying_rod',
                name: 'Летящий стержень',
                type: 'rod',
                color: '#38bdf8', // Неоново-голубой
                x0: -220,
                y0: 0,
                vx: 75, // скорость 75 px/s
                vy: 0,
                width: 70,
                height: 22
            })
        ];
    },

    /**
     * Пресет 2: Парадокс шеста и сарая (Barn-Pole Paradox)
     */
    barnAndPole() {
        return [
            new ShapeModel({
                id: 'barn',
                name: 'Неподвижный сарай',
                type: 'barn',
                color: '#fbbf24', // Золотисто-янтарный
                x0: 0,
                y0: 0,
                vx: 0,
                vy: 0,
                width: 110,
                height: 50,
                doorsCloseTime: 2.2,
                doorsOpenTime: 3.4
            }),
            new ShapeModel({
                id: 'long_pole',
                name: 'Длинный шест',
                type: 'rod',
                color: '#f43f5e', // Неоново-розовый
                x0: -240,
                y0: 0,
                vx: 85,
                vy: 0,
                width: 140, // Заведомо длиннее сарая (140 > 110)
                height: 18
            })
        ];
    },

    /**
     * Пресет 3: Встречное движение двух тел
     */
    twoRodsCollision() {
        return [
            new ShapeModel({
                id: 'rod_left',
                name: 'Стержень слева (синий)',
                type: 'rod',
                color: '#38bdf8',
                x0: -220,
                y0: -20,
                vx: 70,
                vy: 0,
                width: 60,
                height: 18
            }),
            new ShapeModel({
                id: 'rod_right',
                name: 'Стержень справа (красный)',
                type: 'rod',
                color: '#f43f5e',
                x0: 220,
                y0: 20,
                vx: -70,
                vy: 0,
                width: 60,
                height: 18
            })
        ];
    }
};
