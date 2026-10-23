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
        this.accelTime = config.accelTime ?? null; // Индивидуальное время разгона (если null — берется глобальное ShapeModel.accelDuration)

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

    setBetaY(beta) {
        this.betaY = beta;
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
     * Расчет коэффициента текущей скорости и пройденного пути с учетом плавного разгона (t_acc)
     */
    _calcMotionProfile(dt, accelTime) {
        if (dt <= 0) {
            return { velScale: 0, distTime: 0 };
        }
        const tAcc = Math.max(0, accelTime ?? ShapeModel.accelDuration ?? 0);
        if (tAcc <= 0.001) {
            return { velScale: 1.0, distTime: dt };
        }
        if (dt < tAcc) {
            // Линейное нарастание скорости от 0 до v_max за время tAcc:
            // v(dt) = v_max * (dt / tAcc), интеграл пути = v_max * (dt^2 / (2 * tAcc))
            const ratio = dt / tAcc;
            return {
                velScale: ratio,
                distTime: 0.5 * dt * ratio
            };
        } else {
            // После завершения разгона: равномерное движение со скоростью v_max
            return {
                velScale: 1.0,
                distTime: dt - 0.5 * tAcc
            };
        }
    }

    /**
     * Получение состояния объекта в произвольный момент времени t.
     */
    getStateAt(t, customC = null) {
        const c = (customC !== null && customC > 0) ? customC : this.speedOfLight;

        // Если заданы ключевые кадры (больше 1), интерполируем параметры между ними
        if (this.keyframes && this.keyframes.length > 1) {
            return this._interpolateKeyframes(t, c);
        }

        let x0 = this.x0;
        let y0 = this.y0;
        let rot = this.rotation;
        let pX = this.pivotX;
        let pY = this.pivotY;
        let baseW = this.width;
        let baseH = this.height;
        let color = this.color;
        let strokeColor = this.strokeColor;
        let strokeWidth = this.strokeWidth;
        let doorsOpen = true;
        let startTime = 0;

        if (this.keyframes && this.keyframes.length === 1) {
            const k0 = this.keyframes[0];
            x0 = k0.x ?? x0;
            y0 = k0.y ?? y0;
            rot = k0.rotation ?? rot;
            pX = k0.pivotX ?? pX;
            pY = k0.pivotY ?? pY;
            baseW = k0.width ?? baseW;
            baseH = k0.height ?? baseH;
            color = k0.color ?? color;
            strokeColor = k0.strokeColor ?? strokeColor;
            strokeWidth = k0.strokeWidth ?? strokeWidth;
            doorsOpen = k0.doorsOpen ?? doorsOpen;
            startTime = k0.time ?? 0;
        }

        // Расчет профиля плавного разгона от момента старта startTime
        const dt = t - startTime;
        const profile = this._calcMotionProfile(dt, this.accelTime);

        const targetBetaX = this.betaX || 0;
        const targetBetaY = this.betaY || 0;
        const instBetaX = targetBetaX * profile.velScale;
        const instBetaY = targetBetaY * profile.velScale;

        const targetVx = targetBetaX * c;
        const targetVy = targetBetaY * c;
        const currentVx = instBetaX * c;
        const currentVy = instBetaY * c;

        const xBase = x0 + targetVx * profile.distTime;
        const yBase = y0 + targetVy * profile.distTime;

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

        if (this.type === 'barn') {
            doorsOpen = (t < this.doorsCloseTime || t > this.doorsOpenTime);
        }

        // Релятивистский расчет сокращения длины по МГНОВЕННОЙ скорости (плавное сжатие при разгоне)
        const betaX = instBetaX;
        const betaY = instBetaY;
        const betaMag = Math.min(0.999, Math.hypot(betaX, betaY));
        const lorentzFactor = Math.sqrt(Math.max(0.001, 1 - betaMag * betaMag)); // 1 / gamma
        const gamma = 1 / lorentzFactor;

        const isLorentz = ShapeModel.lorentzEnabled && (this.lorentzContraction ?? true);

        // Проекция мгновенной скорости на локальные оси фигуры (с учетом угла вращения rot):
        const betaU = betaX * cos + betaY * sin;
        const betaV = -betaX * sin + betaY * cos;

        const kU = isLorentz ? Math.sqrt(Math.max(0.001, 1 - Math.min(0.999, betaU * betaU))) : 1.0;
        const kV = isLorentz ? Math.sqrt(Math.max(0.001, 1 - Math.min(0.999, betaV * betaV))) : 1.0;

        const contractedW = Math.max(2, baseW * kU);
        const contractedH = Math.max(2, baseH * kV);

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
            width: contractedW,
            height: contractedH,
            restWidth: baseW,
            restHeight: baseH,
            radius: Math.max(contractedW, contractedH) / 2,
            restRadius: Math.max(baseW, baseH) / 2,
            color,
            strokeColor,
            strokeWidth,
            type: this.type,
            doorsOpen,
            vx: currentVx,
            vy: currentVy,
            beta: betaMag,
            betaX,
            betaY,
            targetBetaX,
            targetBetaY,
            velScale: profile.velScale,
            lorentzFactor: lorentzFactor,
            kU,
            kV,
            gamma
        };
    }

    _interpolateKeyframes(t, c = this.speedOfLight) {
        if (!this.keyframes || this.keyframes.length === 0) {
            return this.getStateAt(0, c);
        }

        let k1, k2, alpha;
        let currentVx = 0;
        let currentVy = 0;
        let xBase = 0;
        let yBase = 0;

        const first = this.keyframes[0];
        const last = this.keyframes[this.keyframes.length - 1];
        const tAcc = Math.max(0, this.accelTime ?? ShapeModel.accelDuration ?? 0);

        if (this.keyframes.length === 1 || t <= first.time) {
            k1 = first;
            k2 = first;
            alpha = 0;
            const dt = t - first.time;
            const profile = this._calcMotionProfile(dt, tAcc);
            const targetVx = (this.betaX || 0) * c;
            const targetVy = (this.betaY || 0) * c;
            currentVx = targetVx * profile.velScale;
            currentVy = targetVy * profile.velScale;
            xBase = first.x + targetVx * profile.distTime;
            yBase = first.y + targetVy * profile.distTime;
        } else if (t >= last.time) {
            k1 = last;
            k2 = last;
            alpha = 1;
            const dt = t - last.time;
            const profile = this._calcMotionProfile(dt, tAcc);
            const targetVx = (this.betaX || 0) * c;
            const targetVy = (this.betaY || 0) * c;
            currentVx = targetVx * profile.velScale;
            currentVy = targetVy * profile.velScale;
            xBase = last.x + targetVx * profile.distTime;
            yBase = last.y + targetVy * profile.distTime;
        } else {
            for (let i = 0; i < this.keyframes.length - 1; i++) {
                if (t >= this.keyframes[i].time && t <= this.keyframes[i + 1].time) {
                    k1 = this.keyframes[i];
                    k2 = this.keyframes[i + 1];
                    const range = k2.time - k1.time;
                    const u = range > 0 ? (t - k1.time) / range : 0;

                    // Плавный профиль скорости внутри сегмента (трапецеидальный разгон/торможение)
                    const tau = range > 0 ? Math.min(0.45, tAcc / range) : 0;
                    let posAlpha = u;
                    let velFactor = 1.0;

                    if (tau > 0.001) {
                        const vPeak = 1.0 / (1.0 - tau);
                        if (u < tau) {
                            velFactor = vPeak * (u / tau);
                            posAlpha = 0.5 * vPeak * (u * u) / tau;
                        } else if (u > 1.0 - tau) {
                            const rem = 1.0 - u;
                            velFactor = vPeak * (rem / tau);
                            posAlpha = 1.0 - 0.5 * vPeak * (rem * rem) / tau;
                        } else {
                            velFactor = vPeak;
                            posAlpha = vPeak * (u - 0.5 * tau);
                        }
                    }

                    alpha = posAlpha;
                    const dx = k2.x - k1.x;
                    const dy = k2.y - k1.y;

                    if (range > 0.001 && (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01)) {
                        currentVx = (dx / range) * velFactor;
                        currentVy = (dy / range) * velFactor;
                        xBase = k1.x + dx * posAlpha;
                        yBase = k1.y + dy * posAlpha;
                    } else {
                        // Если ключи на одном месте, но задана betaX/betaY
                        const dt = t - k1.time;
                        const profile = this._calcMotionProfile(dt, tAcc);
                        const targetVx = (this.betaX || 0) * c;
                        const targetVy = (this.betaY || 0) * c;
                        currentVx = targetVx * profile.velScale;
                        currentVy = targetVy * profile.velScale;
                        xBase = k1.x + targetVx * profile.distTime;
                        yBase = k1.y + targetVy * profile.distTime;
                    }
                    break;
                }
            }
        }

        const rot = (k1.rotation ?? 0) + ((k2.rotation ?? 0) - (k1.rotation ?? 0)) * alpha;
        const pX = (k1.pivotX ?? 0) + ((k2.pivotX ?? 0) - (k1.pivotX ?? 0)) * alpha;
        const pY = (k1.pivotY ?? 0) + ((k2.pivotY ?? 0) - (k1.pivotY ?? 0)) * alpha;
        const baseW = k1.width + (k2.width - k1.width) * alpha;
        const baseH = k1.height + (k2.height - k1.height) * alpha;
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

        // Релятивистский расчет сокращения длины (Lorentz Contraction в 2D)
        const betaX = c > 0 ? (currentVx / c) : 0;
        const betaY = c > 0 ? (currentVy / c) : 0;
        const betaMag = Math.min(0.999, Math.hypot(betaX, betaY));
        const lorentzFactor = Math.sqrt(Math.max(0.001, 1 - betaMag * betaMag));
        const gamma = 1 / lorentzFactor;

        const isLorentz = ShapeModel.lorentzEnabled && (this.lorentzContraction ?? true);

        // Проекция скорости на локальные оси фигуры (с учетом угла вращения rot):
        const betaU = betaX * cos + betaY * sin;
        const betaV = -betaX * sin + betaY * cos;

        const kU = isLorentz ? Math.sqrt(Math.max(0.001, 1 - Math.min(0.999, betaU * betaU))) : 1.0;
        const kV = isLorentz ? Math.sqrt(Math.max(0.001, 1 - Math.min(0.999, betaV * betaV))) : 1.0;

        const contractedW = Math.max(2, baseW * kU);
        const contractedH = Math.max(2, baseH * kV);

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
            width: contractedW,
            height: contractedH,
            restWidth: baseW,
            restHeight: baseH,
            radius: Math.max(contractedW, contractedH) / 2,
            restRadius: Math.max(baseW, baseH) / 2,
            color,
            strokeColor,
            strokeWidth,
            type: this.type,
            doorsOpen: alpha < 0.5 ? k1.doorsOpen : k2.doorsOpen,
            vx: currentVx,
            vy: currentVy,
            beta: betaMag,
            betaX,
            betaY,
            lorentzFactor: lorentzFactor,
            kU,
            kV,
            gamma
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
            width: params.width ?? current.restWidth ?? this.width,
            height: params.height ?? current.restHeight ?? this.height,
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

ShapeModel.lorentzEnabled = true;
ShapeModel.accelDuration = 0.8;

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
