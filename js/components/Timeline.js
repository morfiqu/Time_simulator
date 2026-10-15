/**
 * Timeline.js
 * Интерактивный таймлайн в стиле видеоредакторов / Blender.
 * Позволяет скраббить время, управлять анимацией и расставлять ключевые кадры.
 */

export class Timeline {
    constructor(containerElement, state) {
        this.container = containerElement;
        this.state = state;

        this.isDragging = false;
        this.renderDom();
        this.bindEvents();
    }

    renderDom() {
        this.container.innerHTML = `
            <div class="timeline-controls">
                <div class="btn-group">
                    <button id="btn-prev-frame" class="btn btn-icon" title="Предыдущий кадр (←)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    <button id="btn-play" class="btn btn-primary btn-icon" title="Воспроизведение / Пауза (Пробел)">
                        <svg id="icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        <svg id="icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    </button>
                    <button id="btn-next-frame" class="btn btn-icon" title="Следующий кадр (→)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                </div>

                <div class="timecode-display">
                    <span id="timecode-current">00:00.00</span>
                    <span class="timecode-sep">/</span>
                    <span id="timecode-duration">00:06.00</span>
                    <span id="frame-counter" class="badge">F: 0</span>
                </div>

                <div class="speed-selector">
                    <label>Скорость:</label>
                    <select id="select-speed" class="select-sm">
                        <option value="0.25">0.25×</option>
                        <option value="0.5">0.5×</option>
                        <option value="1.0" selected>1.0×</option>
                        <option value="2.0">2.0×</option>
                    </select>
                </div>

                <div class="keyframe-actions">
                    <button id="btn-add-keyframe" class="btn btn-sm btn-outline" title="Добавить ключ анимации в текущий момент">
                        ◆ Добавить ключ
                    </button>
                </div>
            </div>

            <div class="timeline-track-wrapper" id="timeline-track-wrapper">
                <div class="timeline-ruler" id="timeline-ruler"></div>
                <div class="timeline-track" id="timeline-track">
                    <div class="timeline-progress" id="timeline-progress"></div>
                    <div class="timeline-keyframes-track" id="timeline-keyframes-track"></div>
                    <div class="timeline-playhead" id="timeline-playhead">
                        <div class="playhead-head"></div>
                        <div class="playhead-line"></div>
                    </div>
                </div>
            </div>
        `;

        this.dom = {
            btnPlay: this.container.querySelector('#btn-play'),
            iconPlay: this.container.querySelector('#icon-play'),
            iconPause: this.container.querySelector('#icon-pause'),
            btnPrev: this.container.querySelector('#btn-prev-frame'),
            btnNext: this.container.querySelector('#btn-next-frame'),
            btnAddKeyframe: this.container.querySelector('#btn-add-keyframe'),
            selectSpeed: this.container.querySelector('#select-speed'),
            timeCurrent: this.container.querySelector('#timecode-current'),
            timeDuration: this.container.querySelector('#timecode-duration'),
            frameCounter: this.container.querySelector('#frame-counter'),
            trackWrapper: this.container.querySelector('#timeline-track-wrapper'),
            track: this.container.querySelector('#timeline-track'),
            progress: this.container.querySelector('#timeline-progress'),
            keyframesTrack: this.container.querySelector('#timeline-keyframes-track'),
            playhead: this.container.querySelector('#timeline-playhead'),
            ruler: this.container.querySelector('#timeline-ruler')
        };

        this.buildRuler();
    }

    buildRuler() {
        const ruler = this.dom.ruler;
        ruler.innerHTML = '';
        const dur = this.state.duration;

        for (let s = 0; s <= dur; s += 0.5) {
            const pct = (s / dur) * 100;
            const tick = document.createElement('div');
            tick.className = s % 1 === 0 ? 'ruler-tick major' : 'ruler-tick minor';
            tick.style.left = `${pct}%`;

            if (s % 1 === 0) {
                const label = document.createElement('span');
                label.className = 'ruler-label';
                label.textContent = `${s}s`;
                tick.appendChild(label);
            }
            ruler.appendChild(tick);
        }
    }

    bindEvents() {
        // Воспроизведение / Пауза
        this.dom.btnPlay.addEventListener('click', () => this.state.togglePlay());
        this.dom.btnPrev.addEventListener('click', () => this.state.stepFrame(-1));
        this.dom.btnNext.addEventListener('click', () => this.state.stepFrame(1));

        this.dom.selectSpeed.addEventListener('change', (e) => {
            this.state.playbackSpeed = parseFloat(e.target.value);
        });

        this.dom.btnAddKeyframe.addEventListener('click', () => {
            const shape = this.state.getSelectedShape();
            if (shape) {
                shape.setKeyframe(this.state.currentTime);
                this.updateKeyframes();
                this.state.emit('shapesUpdated', this.state.shapes);
            }
        });

        // Скраббинг мышью по таймлайну
        const handleScrub = (e) => {
            const rect = this.dom.track.getBoundingClientRect();
            const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const progress = clickX / rect.width;
            this.state.setTime(progress * this.state.duration);
        };

        this.dom.trackWrapper.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            handleScrub(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) handleScrub(e);
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Горячие клавиши
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.state.togglePlay();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                this.state.stepFrame(-1);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                this.state.stepFrame(1);
            }
        });

        // Реакция на состояние
        this.state.on('timeUpdated', () => this.updateUI());
        this.state.on('playStateChanged', (isPlaying) => this.updatePlayIcon(isPlaying));
        this.state.on('shapeSelected', () => this.updateKeyframes());
        this.state.on('shapesUpdated', () => this.updateKeyframes());
    }

    updateUI() {
        const t = this.state.currentTime;
        const dur = this.state.duration;
        const pct = (t / dur) * 100;

        this.dom.playhead.style.left = `${pct}%`;
        this.dom.progress.style.width = `${pct}%`;

        // Форматирование времени
        const mins = Math.floor(t / 60);
        const secs = (t % 60).toFixed(2).padStart(5, '0');
        this.dom.timeCurrent.textContent = `${String(mins).padStart(2, '0')}:${secs}`;

        const durMins = Math.floor(dur / 60);
        const durSecs = (dur % 60).toFixed(2).padStart(5, '0');
        this.dom.timeDuration.textContent = `${String(durMins).padStart(2, '0')}:${durSecs}`;

        const frame = Math.round(t * this.state.fps);
        this.dom.frameCounter.textContent = `F: ${frame}`;
    }

    updatePlayIcon(isPlaying) {
        this.dom.iconPlay.style.display = isPlaying ? 'none' : 'block';
        this.dom.iconPause.style.display = isPlaying ? 'block' : 'none';
    }

    updateKeyframes() {
        const track = this.dom.keyframesTrack;
        track.innerHTML = '';

        const shape = this.state.getSelectedShape();
        if (!shape || !shape.keyframes) return;

        shape.keyframes.forEach(kf => {
            const pct = (kf.time / this.state.duration) * 100;
            const diamond = document.createElement('div');
            diamond.className = 'keyframe-diamond';
            diamond.style.left = `${pct}%`;
            diamond.title = `Ключ: ${kf.time.toFixed(2)}s`;
            diamond.addEventListener('click', (e) => {
                e.stopPropagation();
                this.state.setTime(kf.time);
            });
            track.appendChild(diamond);
        });
    }
}
