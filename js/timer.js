// The HeistTimer class encapsulates the functionality for starting,
// stopping and tracking multiple phases of a heist scenario (setup
// and heist). It records times, updates the UI, manages local
// storage and handles keyboard shortcuts. This file should be
// included after the DOM elements referenced by ID have been
// declared in the HTML.

class HeistTimer {
    constructor() {
        this.interval = null;
        this.isRunning = false;
        this.currentPhase = 'ready';
        this.startTime = 0;
        this.elapsedTime = 0;
        this.setupStartTime = 0;
        this.heistStartTime = 0;
        this.setupTimes = [];
        this.heistTimes = [];
        this.currentSetupTime = 0;
        this.lastSetupDuration = 0;
        this.setupElapsedTotal = 0;
        this.heistName = '';
        this.elements = {
            timerDisplay: document.getElementById('timerDisplay'),
            timerStatus: document.getElementById('timerStatus'),
            timerProgress: document.querySelector('.timer-progress-fill'),
            startSetupBtn: document.getElementById('startSetupBtn'),
            completeSetupBtn: document.getElementById('completeSetupBtn'),
            startHeistBtn: document.getElementById('startHeistBtn'),
            completeHeistBtn: document.getElementById('completeHeistBtn'),
            resetBtn: document.getElementById('resetBtn'),
            currentSetupTime: document.getElementById('currentSetupTime'),
            totalHeistTime: document.getElementById('totalHeistTime'),
            setupList: document.getElementById('setupList'),
            heistList: document.getElementById('heistList')
        };
        this.elements.heistNameInput = document.getElementById('heistNameInput');
        this.elements.resetModal = document.getElementById('resetModal');
        this.elements.confirmResetBtn = document.getElementById('confirmResetBtn');
        this.elements.cancelResetBtn = document.getElementById('cancelResetBtn');
        this.elements.setupTotalTime = document.getElementById('setupTotalTime');
        this.init();
    }
    init() {
        this.bindEvents();
        this.loadFromStorage();
        this.loadNameFromStorage();
        this.updateDisplay();
        this.updateProgress(0);
        this.updateButtonStates();
        this.updateStatus();
    }
    bindEvents() {
        this.elements.startSetupBtn.addEventListener('click', () => this.startSetup());
        this.elements.completeSetupBtn.addEventListener('click', () => this.completeSetup());
        this.elements.startHeistBtn.addEventListener('click', () => this.startHeist());
        this.elements.completeHeistBtn.addEventListener('click', () => this.completeHeist());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        if (this.elements.confirmResetBtn) {
            this.elements.confirmResetBtn.addEventListener('click', () => {
                this.hideResetModal();
                this.reset(true);
            });
        }
        if (this.elements.cancelResetBtn) {
            this.elements.cancelResetBtn.addEventListener('click', () => this.hideResetModal());
        }
        if (this.elements.heistNameInput) {
            this.elements.heistNameInput.addEventListener('input', () => {
                this.heistName = this.elements.heistNameInput.value;
                this.saveNameToStorage();
            });
        }
        document.addEventListener('keydown', (e) => {
            const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
            const isEditable = targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable;
            if (e.code === 'Space' && !e.ctrlKey && !isEditable) {
                e.preventDefault();
                this.handleSpacePress();
            } else if (e.code === 'KeyR' && e.ctrlKey) {
                e.preventDefault();
                this.reset();
            }
        });
    }
    handleSpacePress() {
        switch (this.currentPhase) {
            case 'ready':
                this.startSetup();
                break;
            case 'setup':
                this.completeSetup();
                break;
            case 'heist-ready':
                this.startHeist();
                break;
            case 'heist':
                this.completeHeist();
                break;
        }
    }
    startSetup() {
        if (this.currentPhase !== 'ready' && this.currentPhase !== 'heist-ready') return;
        this.currentPhase = 'setup';
        this.isRunning = true;
        this.setupStartTime = Date.now();
        if (this.setupTimes.length === 0) {
            this.startTime = Date.now();
        }
        this.interval = setInterval(() => {
            this.currentSetupTime = Date.now() - this.setupStartTime;
            this.elapsedTime = this.setupElapsedTotal + this.currentSetupTime;
            this.updateDisplay();
            this.updateProgress(this.currentSetupTime);
        }, 10);
        this.updateButtonStates();
        this.updateStatus();
    }
    completeSetup() {
        if (this.currentPhase !== 'setup') return;
        const setupTime = Date.now() - this.setupStartTime;
        this.setupElapsedTotal += setupTime;
        const setupData = {
            time: setupTime,
            formatted: this.formatTime(setupTime),
            timestamp: Date.now(),
            rating: '',
            name: this.heistName || ''
        };
        this.setupTimes.unshift(setupData);
        this.lastSetupDuration = setupTime;
        this.elapsedTime = this.setupElapsedTotal;
        this.currentSetupTime = 0;
        this.currentPhase = 'heist-ready';
        this.stopTimer();
        this.updateSetupRatings();
        this.updateSetupDisplay();
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus();
        this.updateProgress(0);
        this.saveToStorage();
    }
    startHeist() {
        if (this.currentPhase !== 'heist-ready') return;
        this.currentPhase = 'heist';
        this.heistStartTime = Date.now();
        this.isRunning = true;
        this.interval = setInterval(() => {
            this.elapsedTime = this.setupElapsedTotal + (Date.now() - this.heistStartTime);
            this.updateDisplay();
        }, 10);
        this.updateButtonStates();
        this.updateStatus();
    }
    completeHeist() {
        if (this.currentPhase !== 'heist') return;
        const heistTime = Date.now() - this.heistStartTime;
        const totalTime = this.setupElapsedTotal + heistTime;
        const heistData = {
            time: heistTime,
            formatted: this.formatTime(heistTime),
            totalTime: this.formatTime(totalTime),
            timestamp: Date.now(),
            setupCount: this.setupTimes.length,
            name: this.heistName || '',
            setups: this.setupTimes.map(s => Object.assign({}, s))
        };
        this.heistTimes.unshift(heistData);
        this.stopTimer();
        this.currentPhase = 'ready';
        this.setupTimes = [];
        this.setupElapsedTotal = 0;
        this.lastSetupDuration = 0;
        this.currentSetupTime = 0;
        this.startTime = 0;
        this.setupStartTime = 0;
        this.heistStartTime = 0;
        this.updateSetupDisplay();
        this.updateHeistDisplay();
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus();
        this.updateProgress(0);
        this.saveToStorage();
    }
    stopTimer() {
        this.isRunning = false;
        clearInterval(this.interval);
        this.interval = null;
    }
    reset(force = false) {
        if (!force) {
            this.showResetModal();
            return;
        }
        this.stopTimer();
        this.currentPhase = 'ready';
        this.elapsedTime = 0;
        this.currentSetupTime = 0;
        this.lastSetupDuration = 0;
        this.setupStartTime = 0;
        this.heistStartTime = 0;
        this.startTime = 0;
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus();
        this.updateProgress(0);
        this.clearStorage();
        this.saveNameToStorage();
    }
    showResetModal() {
        if (this.elements.resetModal) {
            this.elements.resetModal.classList.add('show');
        }
    }
    hideResetModal() {
        if (this.elements.resetModal) {
            this.elements.resetModal.classList.remove('show');
        }
    }
    updateDisplay() {
        let displayTime = 0;
        switch (this.currentPhase) {
            case 'setup':
                displayTime = this.currentSetupTime;
                break;
            case 'heist-ready':
                displayTime = 0;
                break;
            case 'heist':
                displayTime = this.setupElapsedTotal + (Date.now() - this.heistStartTime);
                break;
            case 'completed':
                if (this.heistTimes.length > 0) {
                    displayTime = this.setupElapsedTotal + this.heistTimes[0].time;
                } else {
                    displayTime = this.setupElapsedTotal;
                }
                break;
            default:
                displayTime = 0;
        }
        this.elements.timerDisplay.textContent = this.formatTime(displayTime);
    }
    updateProgress(time) {
        if (this.currentPhase !== 'setup') {
            this.elements.timerProgress.style.strokeDashoffset = '565.48';
            return;
        }
        
        const circumference = 2 * Math.PI * 90;
        const sevenMinutes = 7 * 60 * 1000;
        
        let progress;
        if (time <= sevenMinutes) {
            progress = time / sevenMinutes;
        } else {
            const extraTime = time - sevenMinutes;
            const slowFactor = 2;
            progress = 1 + (extraTime / (sevenMinutes * slowFactor));
        }
        
        const offset = circumference * (1 - Math.min(progress, 1));
        this.elements.timerProgress.style.strokeDashoffset = offset;
        
        // Smooth color transition from green to orange to red to dark red
        if (time < 60000) {
            // Green to Yellow transition (0-1 min)
            const progressToYellow = time / 60000;
            const r = Math.floor(56 + (255 - 56) * progressToYellow);
            const g = 184;
            const b = Math.floor(184 - (184 - 0) * progressToYellow);
            this.elements.timerProgress.style.stroke = `rgb(${r}, ${g}, ${b})`;
        } else if (time < 300000) {
            // Yellow to Orange to Red transition (1-5 min)
            const progressToRed = (time - 60000) / 240000; // 4 minutes range
            const r = 255;
            const g = Math.floor(255 - (255 - 69) * progressToRed);
            const b = 0;
            this.elements.timerProgress.style.stroke = `rgb(${r}, ${g}, ${b})`;
        } else if (time < 420000) {
            // Red to Dark Red transition (5-7 min)
            const progressToDarkRed = (time - 300000) / 120000; // 2 minutes range
            const r = Math.floor(255 - (255 - 139) * progressToDarkRed);
            const g = Math.floor(69 - (69 - 0) * progressToDarkRed);
            const b = 0;
            this.elements.timerProgress.style.stroke = `rgb(${r}, ${g}, ${b})`;
        } else {
            // Dark red after 7 minutes
            this.elements.timerProgress.style.stroke = '#8B0000';
        }
    }
    updateStatus() {
        this.elements.timerStatus.textContent = this.getStatusText();
        this.elements.timerStatus.className = 'timer-status ' + this.currentPhase;
    }
    getStatusText() {
        switch (this.currentPhase) {
            case 'ready': return 'Ready';
            case 'setup': return 'Setup Phase';
            case 'heist-ready': return 'Ready for Heist';
            case 'heist': return 'Heist Phase';
            case 'completed': return 'Completed';
            default: return 'Ready';
        }
    }
    updateButtonStates() {
        this.elements.startSetupBtn.disabled = !['ready', 'heist-ready'].includes(this.currentPhase);
        this.elements.completeSetupBtn.disabled = this.currentPhase !== 'setup';
        this.elements.startHeistBtn.disabled = this.currentPhase !== 'heist-ready';
        this.elements.completeHeistBtn.disabled = this.currentPhase !== 'heist';
        this.elements.resetBtn.disabled = false;
    }
    updateSetupDisplay() {
        if (this.setupTimes.length > 0) {
            const latest = this.setupTimes[0];
            this.elements.currentSetupTime.textContent = latest.formatted;
            this.elements.currentSetupTime.className = 'setup-time ' + latest.rating;
        } else {
            this.elements.currentSetupTime.textContent = '--:--';
            this.elements.currentSetupTime.className = 'setup-time';
        }

        if (this.elements.setupTotalTime) {
            if (this.setupElapsedTotal > 0) {
                this.elements.setupTotalTime.textContent = this.formatTime(this.setupElapsedTotal);
            } else {
                this.elements.setupTotalTime.textContent = '--:--';
            }
        }
        this.elements.setupList.innerHTML = '';
        if (this.setupTimes.length === 0) {
            this.elements.setupList.innerHTML = '<div class="empty-state">No setups recorded yet</div>';
            return;
        }
        this.setupTimes.slice(0, 5).forEach((setup, index) => {
            const item = document.createElement('div');
            item.className = 'setup-item';
            const nameLabel = setup.name && setup.name.trim()
                ? setup.name
                : `Setup ${this.setupTimes.length - index}`;
            item.innerHTML = `
                <span class="setup-name">${nameLabel}</span>
                <span class="setup-time-display ${setup.rating}">${setup.formatted}</span>
            `;
            this.elements.setupList.appendChild(item);
        });
    }
    updateHeistDisplay() {
        if (this.heistTimes.length > 0) {
            const latest = this.heistTimes[0];
            this.elements.totalHeistTime.textContent = latest.totalTime;
        } else {
            this.elements.totalHeistTime.textContent = '--:--';
        }
        this.elements.heistList.innerHTML = '';
        if (this.heistTimes.length === 0) {
            this.elements.heistList.innerHTML = '<div class="empty-state">No heists completed yet</div>';
            return;
        }
        this.heistTimes.slice(0, 5).forEach((heist, index) => {
            const heistLabel = heist.name && heist.name.trim()
                ? heist.name
                : `Heist ${this.heistTimes.length - index}`;
            const detailsEl = document.createElement('details');
            detailsEl.className = 'heist-item';
            const summaryEl = document.createElement('summary');
            summaryEl.innerHTML = `
                <span>${heistLabel} (${heist.setupCount} setups)</span>
                <span class="heist-time-display">${heist.totalTime}</span>
            `;
            detailsEl.appendChild(summaryEl);
            if (Array.isArray(heist.setups) && heist.setups.length > 0) {
                const setupsContainer = document.createElement('div');
                setupsContainer.className = 'heist-setups';
                heist.setups.forEach((setup) => {
                    const setupItem = document.createElement('div');
                    setupItem.className = 'heist-setup-item';
                    const setupName = setup.name && setup.name.trim()
                        ? setup.name
                        : 'Setup';
                    setupItem.innerHTML = `
                        <span>${setupName}</span>
                        <span class="setup-time-display ${setup.rating || ''}">${setup.formatted}</span>
                    `;
                    setupsContainer.appendChild(setupItem);
                });
                detailsEl.appendChild(setupsContainer);
            }
            this.elements.heistList.appendChild(detailsEl);
        });
    }
    getTimeRating(time) {
        if (time < 60000) return 'good';
        if (time < 180000) return 'average';
        return 'slow';
    }
    updateSetupRatings() {
        if (!Array.isArray(this.setupTimes) || this.setupTimes.length === 0) {
            return;
        }
        let minIndex = 0;
        let maxIndex = 0;
        let minTime = this.setupTimes[0].time;
        let maxTime = this.setupTimes[0].time;
        this.setupTimes.forEach((setup, index) => {
            if (setup.time < minTime) {
                minTime = setup.time;
                minIndex = index;
            }
            if (setup.time > maxTime) {
                maxTime = setup.time;
                maxIndex = index;
            }
        });
        this.setupTimes.forEach((setup, index) => {
            if (index === minIndex) {
                setup.rating = 'good';
            } else if (index === maxIndex) {
                setup.rating = 'slow';
            } else {
                setup.rating = 'average';
            }
        });
    }
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        if (minutes > 0) {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }
    }
    saveToStorage() {
        const timerData = {
            setupTimes: this.setupTimes,
            heistTimes: this.heistTimes,
            currentPhase: this.currentPhase,
            elapsedTime: this.elapsedTime,
            setupElapsedTotal: this.setupElapsedTotal,
            startTime: this.startTime,
            setupStartTime: this.setupStartTime,
            heistStartTime: this.heistStartTime,
            lastSetupDuration: this.lastSetupDuration
        };
        localStorage.setItem('heistTimer', JSON.stringify(timerData));
    }
    loadFromStorage() {
        const saved = localStorage.getItem('heistTimer');
        if (saved) {
            const timerData = JSON.parse(saved);
            this.setupTimes = timerData.setupTimes || [];
            this.heistTimes = timerData.heistTimes || [];
            this.currentPhase = timerData.currentPhase || 'ready';
            if (this.currentPhase === 'completed') {
                this.currentPhase = 'ready';
            }
            this.setupElapsedTotal = 0;
            this.setupTimes.forEach(s => {
                if (typeof s.time === 'number') {
                    this.setupElapsedTotal += s.time;
                }
            });
            this.elapsedTime = timerData.elapsedTime || this.setupElapsedTotal;
            this.startTime = timerData.startTime || 0;
            this.setupStartTime = timerData.setupStartTime || 0;
            this.heistStartTime = timerData.heistStartTime || 0;
            if (this.setupTimes.length > 0) {
                this.lastSetupDuration = this.setupTimes[0].time || 0;
            } else {
                this.lastSetupDuration = timerData.lastSetupDuration || 0;
            }
            this.updateSetupRatings();
            this.updateSetupDisplay();
            this.updateHeistDisplay();
            this.updateButtonStates();
            this.updateStatus();
            this.updateDisplay();
        }
    }
    saveNameToStorage() {
        localStorage.setItem('currentHeistName', this.heistName || '');
    }
    loadNameFromStorage() {
        const savedName = localStorage.getItem('currentHeistName');
        this.heistName = savedName || '';
        if (this.elements.heistNameInput) {
            this.elements.heistNameInput.value = this.heistName;
        }
    }
    clearStorage() {
        this.setupTimes = [];
        this.heistTimes = [];
        this.lastSetupDuration = 0;
        this.setupElapsedTotal = 0;
        this.updateSetupDisplay();
        this.updateHeistDisplay();
        localStorage.removeItem('heistTimer');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.heistTimer = new HeistTimer();
});