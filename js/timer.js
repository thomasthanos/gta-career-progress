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
        this.currentPhase = 'ready'; // ready, setup, heist-ready, heist, completed
        this.startTime = 0;
        this.elapsedTime = 0;
        this.setupStartTime = 0;
        this.heistStartTime = 0;
        this.setupTimes = [];
        this.heistTimes = [];
        this.currentSetupTime = 0;
        // Store the most recently completed setup duration so it can be
        // displayed while in the 'heist-ready' phase. Without this
        // property the timer display would show the total elapsed time
        // from the very first setup start, which can be confusing for
        // users wanting to see the just-finished setup duration.
        this.lastSetupDuration = 0;

        // The cumulative duration of all completed setups. This value is
        // used to allow the clock to continue counting across multiple
        // setup phases without resetting to zero each time. When a
        // setup is completed, its duration is added to this total.
        this.setupElapsedTotal = 0;
        // Name for the current heist or mission. This can be assigned by
        // the user via an input field and is stored alongside each
        // setup entry.
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
        // Additional DOM elements used for custom interactions
        this.elements.heistNameInput = document.getElementById('heistNameInput');
        this.elements.resetModal = document.getElementById('resetModal');
        this.elements.confirmResetBtn = document.getElementById('confirmResetBtn');
        this.elements.cancelResetBtn = document.getElementById('cancelResetBtn');
        // Element to show the cumulative time of all completed setups
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
        // Use custom modal for reset instead of default confirm dialog
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        // Bind confirm and cancel buttons on the reset modal
        if (this.elements.confirmResetBtn) {
            this.elements.confirmResetBtn.addEventListener('click', () => {
                this.hideResetModal();
                this.reset(true);
            });
        }
        if (this.elements.cancelResetBtn) {
            this.elements.cancelResetBtn.addEventListener('click', () => this.hideResetModal());
        }
        // Bind heist name input to update the name property and persist it
        if (this.elements.heistNameInput) {
            this.elements.heistNameInput.addEventListener('input', () => {
                this.heistName = this.elements.heistNameInput.value;
                this.saveNameToStorage();
            });
        }
        // Global keyboard shortcuts. Ignore space presses when focused on input or textarea.
        document.addEventListener('keydown', (e) => {
            // Determine if the event target is an editable field
            const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
            const isEditable = targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable;
            if (e.code === 'Space' && !e.ctrlKey && !isEditable) {
                e.preventDefault();
                this.handleSpacePress();
            } else if (e.code === 'KeyR' && e.ctrlKey) {
                e.preventDefault();
                // Show custom reset modal on Ctrl+R
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
        // If this is the first setup, start the main timer
        if (this.setupTimes.length === 0) {
            this.startTime = Date.now();
        }
        this.interval = setInterval(() => {
            // Time elapsed since the beginning of this setup phase
            this.currentSetupTime = Date.now() - this.setupStartTime;
            // Total time across all setups so far, plus the current one
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
        // Add this setup's duration to the cumulative total so the
        // next setup can continue counting from where it left off.
        this.setupElapsedTotal += setupTime;
        const setupData = {
            time: setupTime,
            formatted: this.formatTime(setupTime),
            timestamp: Date.now(),
            // Rating will be assigned dynamically after all setups are evaluated
            rating: '',
            // Store the heist/mission name at the time of completion
            name: this.heistName || ''
        };
        this.setupTimes.unshift(setupData);
        // Remember this setup's duration for display while in 'heist-ready'
        this.lastSetupDuration = setupTime;
        // Update total elapsed time (across all completed setups). When the
        // timer is paused, updateDisplay will read this.elapsedTime.
        this.elapsedTime = this.setupElapsedTotal;
        this.currentSetupTime = 0;
        this.currentPhase = 'heist-ready';
        this.stopTimer();
        // Recompute ratings so the fastest lap is green and slowest is red
        this.updateSetupRatings();
        this.updateSetupDisplay();
        // Update the main display to reset the central timer after each setup
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus();
        this.updateProgress(0);
        this.saveToStorage();
        // Visual feedback removed; the 3D button styling handles pressed state
    }
    startHeist() {
        if (this.currentPhase !== 'heist-ready') return;
        this.currentPhase = 'heist';
        this.heistStartTime = Date.now();
        this.isRunning = true;
        this.interval = setInterval(() => {
            // Total time across setups and the current heist phase
            this.elapsedTime = this.setupElapsedTotal + (Date.now() - this.heistStartTime);
            this.updateDisplay();
        }, 10);
        this.updateButtonStates();
        this.updateStatus();
    }
    completeHeist() {
        if (this.currentPhase !== 'heist') return;
        const heistTime = Date.now() - this.heistStartTime;
        // Total time across all setups and the heist phase
        const totalTime = this.setupElapsedTotal + heistTime;
        const heistData = {
            time: heistTime,
            formatted: this.formatTime(heistTime),
            totalTime: this.formatTime(totalTime),
            timestamp: Date.now(),
            setupCount: this.setupTimes.length,
            // Preserve the heist name so it can be displayed in the history
            name: this.heistName || '',
            // Deep copy of the setup laps for this heist, including name and rating
            setups: this.setupTimes.map(s => Object.assign({}, s))
        };
        // Append this heist run to the history at the top
        this.heistTimes.unshift(heistData);
        // Stop the current timer interval
        this.stopTimer();
        // Reset state for a new heist without clearing history
        this.currentPhase = 'ready';
        this.setupTimes = [];
        this.setupElapsedTotal = 0;
        this.lastSetupDuration = 0;
        this.currentSetupTime = 0;
        this.startTime = 0;
        this.setupStartTime = 0;
        this.heistStartTime = 0;
        // Update UI to reflect the reset state and show the new heist history
        this.updateSetupDisplay();
        this.updateHeistDisplay();
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus();
        this.updateProgress(0);
        // Persist new state to local storage
        this.saveToStorage();
    }
    stopTimer() {
        this.isRunning = false;
        clearInterval(this.interval);
        this.interval = null;
    }
    reset(force = false) {
        // Without force, show the custom confirmation modal
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
        // Persist the current heist name (do not clear it on reset)
        this.saveNameToStorage();
    }

    /**
     * Show the custom reset confirmation modal
     */
    showResetModal() {
        if (this.elements.resetModal) {
            this.elements.resetModal.classList.add('show');
        }
    }

    /**
     * Hide the reset confirmation modal
     */
    hideResetModal() {
        if (this.elements.resetModal) {
            this.elements.resetModal.classList.remove('show');
        }
    }
    updateDisplay() {
        // Determine which time to display based on the current phase
        let displayTime = 0;
        switch (this.currentPhase) {
            case 'setup':
                // During setup, only show the time elapsed in the current lap
                displayTime = this.currentSetupTime;
                break;
            case 'heist-ready':
                // Between setups and heist start, reset the display to zero
                displayTime = 0;
                break;
            case 'heist':
                // During the heist, add the cumulative setup time to the ongoing heist
                displayTime = this.setupElapsedTotal + (Date.now() - this.heistStartTime);
                break;
            case 'completed':
                // After a heist completes, display the sum of all setups plus the last heist
                if (this.heistTimes.length > 0) {
                    // heistTimes[0].time holds the duration of the last heist phase
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
        // Assuming 5 minutes max for setup
        const maxTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const progress = Math.min(time / maxTime, 1);
        const offset = 565.48 * (1 - progress);
        this.elements.timerProgress.style.strokeDashoffset = offset;
        // Change color based on time
        if (time < 60000) { // Under 1 minute - good
            this.elements.timerProgress.style.stroke = 'var(--success)';
        } else if (time < 180000) { // 1-3 minutes - average
            this.elements.timerProgress.style.stroke = 'var(--warning)';
        } else { // Over 3 minutes - slow
            this.elements.timerProgress.style.stroke = 'var(--danger)';
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
        // Update current setup time and cumulative setup total
        if (this.setupTimes.length > 0) {
            const latest = this.setupTimes[0];
            this.elements.currentSetupTime.textContent = latest.formatted;
            this.elements.currentSetupTime.className = 'setup-time ' + latest.rating;
        } else {
            this.elements.currentSetupTime.textContent = '--:--';
            this.elements.currentSetupTime.className = 'setup-time';
        }

        // Always update the total setup time display using the cumulative elapsed total
        if (this.elements.setupTotalTime) {
            if (this.setupElapsedTotal > 0) {
                this.elements.setupTotalTime.textContent = this.formatTime(this.setupElapsedTotal);
            } else {
                this.elements.setupTotalTime.textContent = '--:--';
            }
        }
        // Update setup list
        this.elements.setupList.innerHTML = '';
        if (this.setupTimes.length === 0) {
            this.elements.setupList.innerHTML = '<div class="empty-state">No setups recorded yet</div>';
            return;
        }
        this.setupTimes.slice(0, 5).forEach((setup, index) => {
            const item = document.createElement('div');
            item.className = 'setup-item';
            // Use provided name if available; otherwise fallback to numbered label
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
        // Update total heist time
        if (this.heistTimes.length > 0) {
            const latest = this.heistTimes[0];
            this.elements.totalHeistTime.textContent = latest.totalTime;
        } else {
            this.elements.totalHeistTime.textContent = '--:--';
        }
        // Update heist list with collapsible details
        this.elements.heistList.innerHTML = '';
        if (this.heistTimes.length === 0) {
            this.elements.heistList.innerHTML = '<div class="empty-state">No heists completed yet</div>';
            return;
        }
        // Only display the most recent 5 heists for brevity
        this.heistTimes.slice(0, 5).forEach((heist, index) => {
            // Determine a display name; fall back to sequential numbering if none provided
            const heistLabel = heist.name && heist.name.trim()
                ? heist.name
                : `Heist ${this.heistTimes.length - index}`;
            // Create a details element to allow collapsing/expanding
            const detailsEl = document.createElement('details');
            detailsEl.className = 'heist-item';
            // Construct the summary row with heist name and total time
            const summaryEl = document.createElement('summary');
            summaryEl.innerHTML = `
                <span>${heistLabel} (${heist.setupCount} setups)</span>
                <span class="heist-time-display">${heist.totalTime}</span>
            `;
            detailsEl.appendChild(summaryEl);
            // If this heist has recorded setup laps, list them below
            if (Array.isArray(heist.setups) && heist.setups.length > 0) {
                const setupsContainer = document.createElement('div');
                setupsContainer.className = 'heist-setups';
                // Iterate in reverse chronological order so the first recorded setup is at the bottom
                heist.setups.forEach((setup) => {
                    const setupItem = document.createElement('div');
                    setupItem.className = 'heist-setup-item';
                    // Use stored name or fallback label
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
        if (time < 60000) return 'good';      // Under 1 minute
        if (time < 180000) return 'average';  // 1-3 minutes
        return 'slow';                        // Over 3 minutes
    }

    /**
     * Dynamically assign ratings to setup laps based on relative performance.
     * The fastest lap (shortest time) is marked 'good', the slowest lap (longest time)
     * is marked 'slow', and all other laps are marked 'average'. This method
     * recalculates ratings each time a setup completes so that only one lap
     * holds each of the good/slow statuses.
     */
    updateSetupRatings() {
        if (!Array.isArray(this.setupTimes) || this.setupTimes.length === 0) {
            return;
        }
        // Identify the indices of the fastest (minimum time) and slowest (maximum time)
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
        // Assign ratings based on the min/max indices
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
            // Total time across setups and current heist phase
            elapsedTime: this.elapsedTime,
            // Sum of durations of all completed setups
            setupElapsedTotal: this.setupElapsedTotal,
            // Timestamp marking the overall timer start
            startTime: this.startTime,
            // Timestamp marking the current setup or heist start
            setupStartTime: this.setupStartTime,
            heistStartTime: this.heistStartTime,
            // The last completed setup duration
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
            // If the saved state was 'completed' (from a finished heist), switch to 'ready'
            if (this.currentPhase === 'completed') {
                this.currentPhase = 'ready';
            }
            // Sum all completed setup durations to compute cumulative total
            this.setupElapsedTotal = 0;
            this.setupTimes.forEach(s => {
                if (typeof s.time === 'number') {
                    this.setupElapsedTotal += s.time;
                }
            });
            // Load total elapsed time if available; otherwise derive from
            // setupElapsedTotal (heist time will be added during a running heist)
            this.elapsedTime = timerData.elapsedTime || this.setupElapsedTotal;
            // Restore start timestamps if available
            this.startTime = timerData.startTime || 0;
            this.setupStartTime = timerData.setupStartTime || 0;
            this.heistStartTime = timerData.heistStartTime || 0;
            // Determine the last setup duration from saved setupTimes or saved value
            if (this.setupTimes.length > 0) {
                this.lastSetupDuration = this.setupTimes[0].time || 0;
            } else {
                this.lastSetupDuration = timerData.lastSetupDuration || 0;
            }
            // Recompute ratings in case the best or worst laps have changed
            this.updateSetupRatings();
            this.updateSetupDisplay();
            this.updateHeistDisplay();
            this.updateButtonStates();
            this.updateStatus();
            this.updateDisplay();
        }
    }
    /**
     * Persist the current heist name to localStorage under a separate key.
     * This allows the name to be restored after a page reload.
     */
    saveNameToStorage() {
        localStorage.setItem('currentHeistName', this.heistName || '');
    }
    /**
     * Load the heist name from localStorage and populate the input field.
     */
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