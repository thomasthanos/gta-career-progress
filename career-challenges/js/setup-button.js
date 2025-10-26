// The SetupButton class manages a button that records challenge setups.
// Each click records the date and time, updates counters and history,
// and animates the button. Data is persisted in localStorage to
// survive page reloads.

class SetupButton {
    constructor() {
        this.setupCount = 0;
        this.todayCount = 0;
        this.setupHistory = [];
        this.buttonTexts = [
            { text: "Κάνε Κλικ για Setup", emoji: "🚀" },
            { text: "Setup Ολοκληρώθηκε!", emoji: "✅" },
            { text: "Νέο Setup", emoji: "🆕" },
            { text: "Έτοιμο για Επόμενο", emoji: "⚡" },
            { text: "Challenge Accepted!", emoji: "🎯" },
            { text: "Let's Do This!", emoji: "💪" },
            { text: "Next Challenge", emoji: "🏆" },
            { text: "Go for It!", emoji: "🔥" },
            { text: "You Got This!", emoji: "🌟" },
            { text: "Making Progress!", emoji: "📈" },
            { text: "Level Up!", emoji: "🔼" },
            { text: "Achievement Unlocked!", emoji: "🏅" }
        ];
        this.elements = {
            button: document.getElementById('setupBtn'),
            buttonText: document.querySelector('.setup-btn-text'),
            buttonEmoji: document.querySelector('.setup-btn-emoji'),
            setupList: document.getElementById('setupList'),
            totalSetups: document.getElementById('totalSetups'),
            todaySetups: document.getElementById('todaySetups'),
            clearHistory: document.getElementById('clearHistory')
        };
        this.init();
    }
    init() {
        this.bindEvents();
        this.loadFromStorage();
        this.updateDisplay();
    }
    bindEvents() {
        this.elements.button.addEventListener('click', () => this.handleClick());
        this.elements.clearHistory.addEventListener('click', () => this.clearHistory());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.handleClick();
            }
        });
    }
    handleClick() {
        this.setupCount++;
        this.todayCount++;
        const now = new Date();
        const setupData = {
            id: Date.now(),
            timestamp: now.getTime(),
            date: now.toLocaleDateString('el-GR'),
            time: now.toLocaleTimeString('el-GR'),
            text: this.getRandomButtonText(),
            emoji: this.getRandomEmoji()
        };
        this.setupHistory.unshift(setupData);
        this.updateButton();
        this.updateDisplay();
        this.addToHistory(setupData);
        this.saveToStorage();
        this.animateButton();
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    getRandomButtonText() {
        const randomIndex = Math.floor(Math.random() * this.buttonTexts.length);
        return this.buttonTexts[randomIndex];
    }
    getRandomEmoji() {
        const emojis = ["🚀", "⭐", "🔥", "💎", "🎯", "⚡", "🏆", "🌟", "💪", "🎉"];
        return emojis[Math.floor(Math.random() * emojis.length)];
    }
    updateButton() {
        const randomText = this.getRandomButtonText();
        this.elements.buttonText.textContent = randomText.text;
        this.elements.buttonEmoji.textContent = randomText.emoji;
    }
    animateButton() {
        this.elements.button.style.transform = 'scale(0.95)';
        this.elements.buttonEmoji.style.transform = 'scale(1.3) rotate(10deg)';
        setTimeout(() => {
            this.elements.button.style.transform = 'scale(1)';
            this.elements.buttonEmoji.style.transform = 'scale(1) rotate(0deg)';
        }, 150);
    }
    addToHistory(setupData) {
        const historyItem = document.createElement('li');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-item-content">
                <span class="history-item-title">${setupData.text.text}</span>
                <span class="history-item-time">${setupData.date} ${setupData.time}</span>
            </div>
            <span class="history-item-emoji">${setupData.text.emoji}</span>
        `;
        this.elements.setupList.prepend(historyItem);
        if (this.elements.setupList.children.length > 20) {
            this.elements.setupList.removeChild(this.elements.setupList.lastChild);
        }
        historyItem.style.opacity = '0';
        historyItem.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            historyItem.style.transition = 'all 0.3s ease';
            historyItem.style.opacity = '1';
            historyItem.style.transform = 'translateX(0)';
        }, 10);
    }
    updateDisplay() {
        this.elements.totalSetups.textContent = this.setupCount;
        this.elements.todaySetups.textContent = this.todayCount;
    }
    clearHistory() {
        if (confirm('Είσαι σίγουρος ότι θέλεις να διαγράψεις όλο το ιστορικό;')) {
            this.setupHistory = [];
            this.elements.setupList.innerHTML = '';
            this.setupCount = 0;
            this.todayCount = 0;
            this.updateDisplay();
            this.clearStorage();
        }
    }
    saveToStorage() {
        const setupData = {
            count: this.setupCount,
            todayCount: this.todayCount,
            history: this.setupHistory,
            lastUpdate: new Date().toDateString()
        };
        localStorage.setItem('careerChallengesSetup', JSON.stringify(setupData));
    }
    loadFromStorage() {
        const saved = localStorage.getItem('careerChallengesSetup');
        if (saved) {
            const setupData = JSON.parse(saved);
            this.setupCount = setupData.count || 0;
            this.setupHistory = setupData.history || [];
            const today = new Date().toDateString();
            this.todayCount = (setupData.lastUpdate === today) ? (setupData.todayCount || 0) : 0;
            this.setupHistory.slice(0, 20).forEach(setup => {
                this.addToHistory(setup);
            });
        }
    }
    clearStorage() {
        localStorage.removeItem('careerChallengesSetup');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.setupButton = new SetupButton();
});