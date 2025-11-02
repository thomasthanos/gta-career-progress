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
        this.extraTimers = []; // Array για τα επιπλέον timers μετά τα 7 λεπτά
        this.mainTimerStoppedAt = 0; // Χρόνος που σταμάτησε το κύριο timer
        
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

        // Optional element to display the time spent during the heist phase only.
        this.elements.heistPhaseTime = document.getElementById('heistPhaseTime');
        
        // Δημιουργία container για τα επιπλέον timers
        this.createExtraTimersContainer();
        
        this.init();
    }

    createExtraTimersContainer() {
        // Δημιουργία container για τα επιπλέον timers ΔΕΞΙΑ από το κύριο timer
        const extraTimersContainer = document.createElement('div');
        extraTimersContainer.className = 'extra-timers-container';
        extraTimersContainer.style.display = 'none';
        
        // Προσθήκη του container δίπλα στο κύριο timer
        const timerDisplayContainer = document.querySelector('.timer-display-container');
        timerDisplayContainer.appendChild(extraTimersContainer);
        
        this.elements.extraTimersContainer = extraTimersContainer;
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
        // Only allow starting a setup when the timer is ready or the previous setup(s) were completed and a heist has not yet started.
        if (this.currentPhase !== 'ready' && this.currentPhase !== 'heist-ready') return;

        // If we are starting a new setup while we are in the 'heist-ready' phase, it means there are
        // existing setups recorded for a heist attempt that has not yet transitioned to the heist phase.
        // Only consider those setups as failed and remove them when the name of the new attempt matches
        // the name of the previous attempt. If the user has changed the heist name, we keep the existing
        // setup times so they can still proceed with the previous attempt or choose to complete it.
        if (this.currentPhase === 'heist-ready' && this.setupTimes.length > 0) {
            const currentName = (this.heistName || '').trim();
            const lastName = (this.setupTimes[0].name || '').trim();
            if (lastName !== '' && currentName !== '' && currentName === lastName) {
                this.setupTimes = [];
                this.setupElapsedTotal = 0;
                this.lastSetupDuration = 0;
                this.updateSetupDisplay();
            }
        }

        this.currentPhase = 'setup';
        this.isRunning = true;
        this.setupStartTime = Date.now();
        this.mainTimerStoppedAt = 0; // Reset το stop time

        // Καθαρισμός παλιών extra timers
        this.clearExtraTimers();

        // Initialize the overall start time for the first setup in this session
        if (this.setupTimes.length === 0) {
            this.startTime = Date.now();
        }

        // Start the interval that updates the display and progress every 10ms
        this.interval = setInterval(() => {
            this.currentSetupTime = Date.now() - this.setupStartTime;
            this.elapsedTime = this.setupElapsedTotal + this.currentSetupTime;
            this.updateDisplay();
            
            // Update the progress ring only for the main timer when it hasn't been capped by extra timers
            if (this.mainTimerStoppedAt === 0) {
                this.updateProgress(this.currentSetupTime);
                
                // Check whether a new extra timer should be created at the 7 minute mark
                this.checkForExtraTimer(this.currentSetupTime);
            } else {
                // If the main timer is stopped, update only the extra timers
                this.updateExtraTimers(this.currentSetupTime);
            }
        }, 10);

        // Update button states and status text
        this.updateButtonStates();
        this.updateStatus();

        // When a new setup begins, clear the current setup display so that
        // previous setup times are not shown during an ongoing or aborted setup.
        if (this.elements.currentSetupTime) {
            this.elements.currentSetupTime.textContent = '--:--';
            this.elements.currentSetupTime.className = 'setup-time';
        }
    }

    checkForExtraTimer(currentTime) {
        const sevenMinutes = 7 * 60 * 1000;
        const timerCount = Math.floor(currentTime / sevenMinutes);
        
        // Αν υπάρχει τουλάχιστον ένα extra timer, σταμάτα το κύριο timer
        if (timerCount > 0 && this.mainTimerStoppedAt === 0) {
            this.mainTimerStoppedAt = currentTime;
            // Κράτα το κύριο timer στα 7 λεπτά
            this.elements.timerProgress.style.strokeDashoffset = '0';
            this.updateTimerColor(this.elements.timerProgress, sevenMinutes);
        }
        
        // Δημιουργία νέων timers αν χρειάζεται
        while (this.extraTimers.length < timerCount) {
            this.createExtraTimer(this.extraTimers.length + 1);
        }
        
        // Ενημέρωση των extra timers
        this.updateExtraTimers(currentTime);
    }

    createExtraTimer(timerNumber) {
        const timerId = `extra-timer-${timerNumber}`;
        
        // Δημιουργία HTML για το νέο timer (ίδιο design με το κύριο)
        const timerElement = document.createElement('div');
        timerElement.className = 'extra-timer';
        timerElement.id = timerId;
        timerElement.innerHTML = `
            <div class="timer-circle">
                <svg class="timer-progress" width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
                    <circle class="timer-progress-bg" cx="100" cy="100" r="90"></circle>
                    <circle class="timer-progress-fill" cx="100" cy="100" r="90"></circle>
                </svg>
                <div class="timer-display extra-timer-display">00.00</div>
            </div>
            <div class="extra-timer-title">Timer ${timerNumber}</div>
        `;
        
        // Προσθήκη στο container
        this.elements.extraTimersContainer.appendChild(timerElement);
        this.elements.extraTimersContainer.style.display = 'flex';
        
        // Αποθήκευση στο array
        this.extraTimers.push({
            id: timerId,
            element: timerElement,
            startTime: this.setupStartTime + (timerNumber * 7 * 60 * 1000),
            progressFill: timerElement.querySelector('.timer-progress-fill'),
            timeDisplay: timerElement.querySelector('.extra-timer-display')
        });

        // Αρχικοποίηση του progress circle
        const progressFill = timerElement.querySelector('.timer-progress-fill');
        const circumference = 2 * Math.PI * 90;
        progressFill.style.strokeDasharray = circumference;
        progressFill.style.strokeDashoffset = circumference;
    }

    updateExtraTimers(currentTime) {
        const sevenMinutes = 7 * 60 * 1000;
        
        this.extraTimers.forEach((timer, index) => {
            const timerElapsed = Math.max(0, currentTime - (index + 1) * sevenMinutes);
            const timerProgress = Math.min(timerElapsed / sevenMinutes, 1);
            
            if (timer.timeDisplay) {
                timer.timeDisplay.textContent = this.formatTime(timerElapsed);
            }
            
            if (timer.progressFill) {
                this.updateExtraTimerProgress(timer.progressFill, timerProgress, timerElapsed);
            }
        });
    }

    updateExtraTimerProgress(progressElement, progress, time) {
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - progress);
        progressElement.style.strokeDashoffset = offset;
        
        // Ομαλή μετάβαση χρωμάτων για τα extra timers
        this.updateTimerColor(progressElement, time);
    }

    updateTimerColor(progressElement, time) {
        // Ομαλή μετάβαση χρωμάτων από πράσινο → κίτρινο → πορτοκαλί → κόκκινο → σκούρο κόκκινο
        let r, g, b;
        
        if (time < 60000) {
            // Πράσινο προς κίτρινο (0-1 λεπτό)
            const progress = time / 60000;
            r = Math.floor(56 + (255 - 56) * progress);
            g = 184;
            b = Math.floor(184 - 184 * progress);
        } else if (time < 180000) {
            // Κίτρινο προς πορτοκαλί (1-3 λεπτά)
            const progress = (time - 60000) / 120000;
            r = 255;
            g = Math.floor(184 - (184 - 100) * progress);
            b = 0;
        } else if (time < 300000) {
            // Πορτοκαλί προς κόκκινο (3-5 λεπτά)
            const progress = (time - 180000) / 120000;
            r = 255;
            g = Math.floor(100 - 100 * progress);
            b = 0;
        } else if (time < 420000) {
            // Κόκκινο προς σκούρο κόκκινο (5-7 λεπτά)
            const progress = (time - 300000) / 120000;
            r = Math.floor(255 - (255 - 139) * progress);
            g = 0;
            b = 0;
        } else {
            // Σκούρο κόκκινο μετά τα 7 λεπτά
            r = 139;
            g = 0;
            b = 0;
        }
        
        progressElement.style.stroke = `rgb(${r}, ${g}, ${b})`;
    }

    clearExtraTimers() {
        this.extraTimers = [];
        this.mainTimerStoppedAt = 0;
        if (this.elements.extraTimersContainer) {
            this.elements.extraTimersContainer.innerHTML = '';
            this.elements.extraTimersContainer.style.display = 'none';
        }
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
        this.clearExtraTimers();
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
            // Ενημέρωση του progress για το heist phase
            this.updateHeistProgress();
        }, 10);
        this.updateButtonStates();
        this.updateStatus();
    }

    updateHeistProgress() {
        if (this.currentPhase !== 'heist') return;
        
        const heistTime = Date.now() - this.heistStartTime;
        const totalTime = this.setupElapsedTotal + heistTime;
        
        // Για το heist phase, θέλουμε το progress circle να είναι πάντα πλήρες
        // αλλά με χρώμα που αλλάζει ανάλογα με τον συνολικό χρόνο
        const circumference = 2 * Math.PI * 90;
        this.elements.timerProgress.style.strokeDashoffset = '0'; // Πλήρες circle
        
        // Αλλαγή χρώματος βασισμένη στον συνολικό χρόνο του heist
        this.updateTimerColor(this.elements.timerProgress, totalTime);
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
        // Always record the latest heist attempt at the beginning of the list.
        this.heistTimes.unshift(heistData);

        // Mark previous attempts with the same name as failed instead of removing them.
        // When multiple heists share the same non-empty name, only the most recent
        // (first in the array) is considered successful; all earlier entries are
        // flagged with a `failed` property. These failed attempts will remain in
        // the history list but can be styled differently or excluded from totals.
        if (heistData.name && heistData.name.trim() !== '') {
            const seenNames = new Set();
            this.heistTimes.forEach(entry => {
                const name = (entry.name || '').trim();
                if (name === '') {
                    entry.failed = false;
                    return;
                }
                if (seenNames.has(name)) {
                    entry.failed = true;
                } else {
                    entry.failed = false;
                    seenNames.add(name);
                }
            });
        }
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
        this.clearExtraTimers();
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
        this.clearExtraTimers();
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
            return;
        }
        
        // Αν το κύριο timer έχει σταματήσει (υπάρχουν extra timers), μην ενημερώσεις το progress
        if (this.mainTimerStoppedAt > 0) {
            return;
        }
        
        const circumference = 2 * Math.PI * 90;
        const sevenMinutes = 7 * 60 * 1000;
        
        let progress;
        if (time <= sevenMinutes) {
            progress = time / sevenMinutes;
        } else {
            progress = 1;
        }
        
        const offset = circumference * (1 - Math.min(progress, 1));
        this.elements.timerProgress.style.strokeDashoffset = offset;
        
        // Ομαλή μετάβαση χρωμάτων για το κύριο timer
        this.updateTimerColor(this.elements.timerProgress, time);
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
        // Show all setup entries instead of limiting to the latest five.
        // Previously the list was truncated with .slice(0, 5), which prevented
        // users from scrolling through longer histories. Now we iterate over
        // the entire array, allowing the CSS to handle scrolling when necessary.
        this.setupTimes.forEach((setup, index) => {
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
            // If a dedicated heist-phase timer element exists, update it with
            // the heist-only duration (not including setups). The `formatted`
            // property holds the display string for the heist phase.
            if (this.elements.heistPhaseTime) {
                this.elements.heistPhaseTime.textContent = latest.formatted;
            }
        } else {
            this.elements.totalHeistTime.textContent = '--:--';
            if (this.elements.heistPhaseTime) {
                this.elements.heistPhaseTime.textContent = '--:--';
            }
        }
        this.elements.heistList.innerHTML = '';
        if (this.heistTimes.length === 0) {
            this.elements.heistList.innerHTML = '<div class="empty-state">No heists completed yet</div>';
            return;
        }
        // Show all heist entries instead of limiting to the latest five.
        // Removing the .slice(0, 5) call ensures that the entire history is
        // rendered and can be scrolled through by the user.
        this.heistTimes.forEach((heist, index) => {
            const heistLabel = heist.name && heist.name.trim()
                ? heist.name
                : `Heist ${this.heistTimes.length - index}`;
            const detailsEl = document.createElement('details');
            // Add a `failed` class to heist items that represent aborted or
            // superseded attempts with the same name. This class allows
            // styling to differentiate them in the history list.
            detailsEl.className = 'heist-item' + (heist.failed ? ' failed' : '');
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

        // Ensure that all heist items are collapsed by default when the list is (re)rendered.
        // This prevents previously expanded details from remaining open after adding a new heist.
        const detailEls = this.elements.heistList.querySelectorAll('details');
        detailEls.forEach(detail => {
            detail.open = false;
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
            // After loading heistTimes, mark any earlier attempts with the same
            // name as failed so they remain in history but are identified.
            if (Array.isArray(this.heistTimes)) {
                const seenNames = new Set();
                this.heistTimes.forEach(entry => {
                    const name = (entry.name || '').trim();
                    if (name === '') {
                        entry.failed = false;
                        return;
                    }
                    if (seenNames.has(name)) {
                        entry.failed = true;
                    } else {
                        entry.failed = false;
                        seenNames.add(name);
                    }
                });
            }
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