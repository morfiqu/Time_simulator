/**
 * ShapeModel.js
 * Модель объектов симуляции: стержни, сараи, излучатели и ключевые кадры анимации.
 * Скорость задается в долях от скорости света c: betaX = Vx / c.
 */

export class ShapeModel {
    constructor(config = {}) {
        this.id = config.id || 'shape_' + Math.random().toString(36).substr(2, 9);
        this.name = config.name || 'Объект';
        this.type = config.type || 'rod'; // 'rod', 'barn', 'pulse'
        this.color = config.color || '#38bdf8';
        this.fillColor = config.fillColor || (this.color + '44');

        // Скорость света для масштабирования скорости
        this.speedOfLight = config.speedOfLight || 53.333;

        // Базовые параметры движения: скорость задается в долях от скорости света (beta = v / c)
        this.x0 = config.x0 ?? -150;
        this.y0 = config.y0 ?? 0;
        this.betaX = config.betaX ?? (config.vx !== undefined ? (config.vx / this.speedOfLight) : 0.75);
        this.betaY = config.betaY ?? 0;

        // Размеры
        this.width = config.width ?? 70;
        this.height = config.height ?? 22;

        // Ключевые кадры (для нелинейной анимации в стиле Blender)
        this.keyframes = config.keyframes || null;

        // Специфика сарая (двери)
        this.barnDoorThickness = config.barnDoorThickness ?? 4;
        this.doorsOpen = config.doorsOpen ?? true;
        this.doorsCloseTime = config.doorsCloseTime ?? 2.2;
        this.doorsOpenTime = config.doorsOpenTime ?? 3.4;
    }

    setSpeedOfLight(c) {
        if (c > 0) {
            this.speedOfLight = c;
        }
    }

    setBetaX(beta) {
        this.betaX = beta;
    }

    get vx() {
        return this.betaX * this.speedOfLight;
    }

    set vx(val) {
        this.betaX = this.speedOfLight > 0 ? (val / this.speedOfLight) : 0;
    }

    get vy() {
        return this.betaY * this.speedOfLight;
    }

    set vy(val) {
        this.betaY = this.speedOfLight > 0 ? (val / this.speedOfLight) : 0;
    }

    /**
     * Получение состояния объекта в произвольный момент времени t.
     * Принимает опциональный customC (скорость света), чтобы гарантировать
     * 100% синхронизацию с 3D-конусом.
     */
    getStateAt(t, customC = null) {
        const c = (customC !== null && customC > 0) ? customC : this.speedOfLight;

        // Если заданы ключевые кадры, интерполируем между ними
        if (this.keyframes && this.keyframes.length > 0) {
            return this._interpolateKeyframes(t);
        }

        // Релятивистское движение x(t) = x0 + (beta * c) * t
        const currentVx = this.betaX * c;
        const currentVy = this.betaY * c;

        const x = this.x0 + currentVx * t;
        const y = this.y0 + currentVy * t;

        let doorsOpen = true;
        if (this.type === 'barn') {
            doorsOpen = (t < this.doorsCloseTime || t > this.doorsOpenTime);
        }

        return {
            x,
            y,
            width: this.width,
            height: this.height,
            doorsOpen,
            vx: currentVx,
            vy: currentVy
        };
    }

    _interpolateKeyframes(t) {
        if (this.keyframes.length === 1 || t <= this.keyframes[0].time) {
            return { ...this.keyframes[0] };
        }
        const last = this.keyframes[this.keyframes.length - 1];
        if (t >= last.time) {
            return { ...last };
        }

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
                color: '#38bdf8',
                x0: -180,
                y0: 0,
                betaX: 0.75, // Скорость 0.75 от скорости света c
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
                color: '#fbbf24',
                x0: 0,
                y0: 0,
                betaX: 0.0, // Неподвижен
                width: 110,
                height: 50,
                doorsCloseTime: 2.2,
                doorsOpenTime: 3.4
            }),
            new ShapeModel({
                id: 'long_pole',
                name: 'Длинный шест',
                type: 'rod',
                color: '#f43f5e',
                x0: -220,
                y0: 0,
                betaX: 0.85, // 0.85c
                width: 140, // Длиннее сарая
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
                x0: -180,
                y0: -20,
                betaX: 0.65, // +0.65c
                width: 60,
                height: 18
            }),
            new ShapeModel({
                id: 'rod_right',
                name: 'Стержень справа (красный)',
                type: 'rod',
                color: '#f43f5e',
                x0: 180,
                y0: 20,
                betaX: -0.65, // -0.65c навстречу
                width: 60,
                height: 18
            })
        ];
    }
};
