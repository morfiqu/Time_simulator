/**
 * SpacetimeMath.js
 * Физико-математическое ядро для расчета запаздывания света,
 * световых конусов и релятивистских искажений (эффект Террелла — Пенроуза).
 */

export class SpacetimeMath {
    /**
     * Евклидово расстояние между двумя точками на плоскости
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Время испускания фотона (запаздывающее время, Retarded Time):
     * t_ret = t_curr - distance / c
     */
    static getRetardedTime(targetX, targetY, obsX, obsY, currentTime, speedOfLight) {
        if (speedOfLight <= 0 || !isFinite(speedOfLight)) {
            return currentTime; // Мгновенное распространение сигнала (классическая механика)
        }
        const dist = this.distance(targetX, targetY, obsX, obsY);
        return currentTime - (dist / speedOfLight);
    }

    /**
     * Радиус среза светового конуса на глубине времени dt в прошлом
     */
    static getConeRadius(dt, speedOfLight) {
        if (dt < 0) return 0;
        return dt * speedOfLight;
    }

    /**
     * Проверка: попадает ли точка (px, py) внутрь прямоугольника
     */
    static isInsideBox(px, py, box) {
        const halfW = box.width / 2;
        const halfH = box.height / 2;
        return (
            px >= box.x - halfW &&
            px <= box.x + halfW &&
            py >= box.y - halfH &&
            py <= box.y + halfH
        );
    }

    /**
     * Измерение наблюдаемых границ и кажущейся длины объекта
     * с учетом светового конуса наблюдателя.
     */
    static measureObservedRod(shape, obsX, obsY, currentTime, speedOfLight, step = 1.0) {
        if (speedOfLight <= 0 || currentTime <= 0) return null;

        const maxRadius = speedOfLight * currentTime;
        const stateInstant = shape.getStateAt(currentTime, speedOfLight);
        const testY = stateInstant.y;

        // Физический световой горизонт: фотоны успели дойти только с расстояния r <= c * currentTime
        const minScanX = Math.max(-250, obsX - maxRadius);
        const maxScanX = Math.min(250, obsX + maxRadius);

        let observedMinX = Infinity;
        let observedMaxX = -Infinity;
        let hit = false;

        for (let x = minScanX; x <= maxScanX; x += step) {
            const tRet = this.getRetardedTime(x, testY, obsX, obsY, currentTime, speedOfLight);
            if (tRet < 0) continue; // Свет от этой точки ещё не родился в момент t=0

            const pastState = shape.getStateAt(tRet, speedOfLight);
            const halfW = pastState.width / 2;
            if (x >= pastState.x - halfW && x <= pastState.x + halfW) {
                hit = true;
                if (x < observedMinX) observedMinX = x;
                if (x > observedMaxX) observedMaxX = x;
            }
        }

        if (!hit) {
            return null;
        }

        const observedLength = observedMaxX - observedMinX;
        const realLength = stateInstant.width;
        const factor = realLength > 0 ? (observedLength / realLength) : 1;

        return {
            minX: observedMinX,
            maxX: observedMaxX,
            centerX: (observedMinX + observedMaxX) / 2,
            centerY: testY,
            observedLength,
            realLength,
            factor
        };
    }
}
