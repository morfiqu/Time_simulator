/**
 * Вспомогательная функция плавного смешивания HEX-цветов
 */
function hexToRgb(hex) {
    if (!hex) return { r: 56, g: 189, b: 248 };
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function rgbToHex(r, g, b) {
    const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lerpColor(c1, c2, t) {
    if (!c1) return c2;
    if (!c2) return c1;
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    return rgbToHex(
        rgb1.r + (rgb2.r - rgb1.r) * t,
        rgb1.g + (rgb2.g - rgb1.g) * t,
        rgb1.b + (rgb2.b - rgb1.b) * t
    );
}

export class ShapeModel {
    constructor(config = {}) {
        this.id = config.id || 'shape_' + Math.random().toString(36).substr(2, 9);
        this.name = config.name || 'Объект';
        this.type = config.type || 'rect'; // 'rect', 'circle', 'rod', 'barn'
        this.color = config.color || '#38bdf8';
        this.strokeColor = config.strokeColor || '#ffffff';
        this.strokeWidth = config.strokeWidth ?? 2;

        // Скорость света для масштабирования скорости
        this.speedOfLight = config.speedOfLight || 53.333;

        // Базовые параметры положения и вращения
        this.x0 = config.x0 ?? 0;
        this.y0 = config.y0 ?? 0;
        this.rotation = config.rotation ?? 0; // угол в градусах
        this.pivotX = config.pivotX ?? 0;     // смещение точки вращения (пивота) от центра
        this.pivotY = config.pivotY ?? 0;

        // Скорость движения без ключевых кадров
        this.betaX = config.betaX ?? (config.vx !== undefined ? (config.vx / this.speedOfLight) : 0);
        this.betaY = config.betaY ?? 0;

        // Размеры
        this.width = config.width ?? (config.radius ? config.radius * 2 : 60);
        this.height = config.height ?? (config.radius ? config.radius * 2 : 60);

        // Ключевые кадры (для аниматора и траекторий)
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
     */
    getStateAt(t, customC = null) {
        const c = (customC !== null && customC > 0) ? customC : this.speedOfLight;

        // Если заданы ключевые кадры, интерполируем параметры между ними
        if (this.keyframes && this.keyframes.length > 0) {
            return this._interpolateKeyframes(t);
        }

        // Движение по постоянной скорости: x(t) = x0 + (beta * c) * t
        const currentVx = this.betaX * c;
        const currentVy = this.betaY * c;

        const xBase = this.x0 + currentVx * t;
        const yBase = this.y0 + currentVy * t;
        const rot = this.rotation;
        const pX = this.pivotX;
        const pY = this.pivotY;

        // Расчет мировой позиции с учетом смещения пивота и вращения (орбита)
        const pivotWorldX = xBase + pX;
        const pivotWorldY = yBase + pY;
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotDx = (-pX) * cos - (-pY) * sin;
        const rotDy = (-pX) * sin + (-pY) * cos;
        const finalX = pivotWorldX + rotDx;
        const finalY = pivotWorldY + rotDy;

        let doorsOpen = true;
        if (this.type === 'barn') {
            doorsOpen = (t < this.doorsCloseTime || t > this.doorsOpenTime);
        }

        return {
            x: finalX,
            y: finalY,
            baseX: xBase,
            baseY: yBase,
            pivotX: pX,
            pivotY: pY,
            pivotWorldX,
            pivotWorldY,
            rotation: rot,
            width: this.width,
            height: this.height,
            radius: Math.max(this.width, this.height) / 2,
            color: this.color,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            type: this.type,
            doorsOpen,
            vx: currentVx,
            vy: currentVy
        };
    }

    _interpolateKeyframes(t) {
        if (!this.keyframes || this.keyframes.length === 0) {
            return this.getStateAt(0);
        }

        let k1, k2, alpha;

        if (this.keyframes.length === 1 || t <= this.keyframes[0].time) {
            k1 = this.keyframes[0];
            k2 = this.keyframes[0];
            alpha = 0;
        } else if (t >= this.keyframes[this.keyframes.length - 1].time) {
            const last = this.keyframes[this.keyframes.length - 1];
            k1 = last;
            k2 = last;
            alpha = 1;
        } else {
            for (let i = 0; i < this.keyframes.length - 1; i++) {
                if (t >= this.keyframes[i].time && t <= this.keyframes[i + 1].time) {
                    k1 = this.keyframes[i];
                    k2 = this.keyframes[i + 1];
                    const range = k2.time - k1.time;
                    alpha = range > 0 ? (t - k1.time) / range : 0;
                    break;
                }
            }
        }

        const xBase = k1.x + (k2.x - k1.x) * alpha;
        const yBase = k1.y + (k2.y - k1.y) * alpha;
        const rot = (k1.rotation ?? 0) + ((k2.rotation ?? 0) - (k1.rotation ?? 0)) * alpha;
        const pX = (k1.pivotX ?? 0) + ((k2.pivotX ?? 0) - (k1.pivotX ?? 0)) * alpha;
        const pY = (k1.pivotY ?? 0) + ((k2.pivotY ?? 0) - (k1.pivotY ?? 0)) * alpha;
        const w = k1.width + (k2.width - k1.width) * alpha;
        const h = k1.height + (k2.height - k1.height) * alpha;
        const color = lerpColor(k1.color || this.color, k2.color || this.color, alpha);
        const strokeColor = lerpColor(k1.strokeColor || this.strokeColor, k2.strokeColor || this.strokeColor, alpha);
        const strokeWidth = (k1.strokeWidth ?? this.strokeWidth) + ((k2.strokeWidth ?? this.strokeWidth) - (k1.strokeWidth ?? this.strokeWidth)) * alpha;

        // Вращение относительно пивот-поинта (орбитальное вращение)
        const pivotWorldX = xBase + pX;
        const pivotWorldY = yBase + pY;
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotDx = (-pX) * cos - (-pY) * sin;
        const rotDy = (-pX) * sin + (-pY) * cos;
        const finalX = pivotWorldX + rotDx;
        const finalY = pivotWorldY + rotDy;

        return {
            x: finalX,
            y: finalY,
            baseX: xBase,
            baseY: yBase,
            pivotX: pX,
            pivotY: pY,
            pivotWorldX,
            pivotWorldY,
            rotation: rot,
            width: w,
            height: h,
            radius: Math.max(w, h) / 2,
            color,
            strokeColor,
            strokeWidth,
            type: this.type,
            doorsOpen: alpha < 0.5 ? k1.doorsOpen : k2.doorsOpen
        };
    }

    setKeyframe(time, params = {}) {
        if (!this.keyframes) {
            this.keyframes = [];
        }
        const current = this.getStateAt(time);
        const newKey = {
            time: Math.round(time * 100) / 100,
            x: params.x ?? current.baseX ?? current.x,
            y: params.y ?? current.baseY ?? current.y,
            rotation: params.rotation ?? current.rotation ?? this.rotation ?? 0,
            pivotX: params.pivotX ?? current.pivotX ?? this.pivotX ?? 0,
            pivotY: params.pivotY ?? current.pivotY ?? this.pivotY ?? 0,
            width: params.width ?? current.width ?? this.width,
            height: params.height ?? current.height ?? this.height,
            color: params.color ?? current.color ?? this.color,
            strokeColor: params.strokeColor ?? current.strokeColor ?? this.strokeColor,
            strokeWidth: params.strokeWidth ?? current.strokeWidth ?? this.strokeWidth,
            doorsOpen: params.doorsOpen ?? current.doorsOpen
        };

        const existingIndex = this.keyframes.findIndex(k => Math.abs(k.time - time) < 0.04);
        if (existingIndex >= 0) {
            this.keyframes[existingIndex] = { ...this.keyframes[existingIndex], ...newKey };
        } else {
            this.keyframes.push(newKey);
            this.keyframes.sort((a, b) => a.time - b.time);
        }
        return newKey;
    }

    removeKeyframe(time) {
        if (!this.keyframes) return;
        this.keyframes = this.keyframes.filter(k => Math.abs(k.time - time) >= 0.04);
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
