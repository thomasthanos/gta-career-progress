// This script manages the theme toggling logic for the Career Challenges app.
// It persists the selected theme in localStorage and updates the icon
// accordingly. When the DOM is ready, it instantiates the class and
// attaches it to the global `window` object so it can be inspected if
// needed.

class CareerChallengesApp {
    constructor() {
        this.currentTheme = 'dark';
        this.elements = {
            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.querySelector('.theme-icon')
        };
        this.init();
    }
    init() {
        this.bindEvents();
        this.loadTheme();
    }
    bindEvents() {
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.saveTheme();
    }
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        // Update icon: sun when dark (user can switch to light), moon when light (switch to dark)
        // Use more distinctive icons: a bright sun when the current theme is dark (inviting a switch to light)
        // and a crescent moon when the current theme is light (inviting a switch to dark).
        this.elements.themeIcon.textContent = this.currentTheme === 'dark' ? '🌞' : '🌙';
    }
    saveTheme() {
        localStorage.setItem('careerChallengesTheme', this.currentTheme);
    }
    loadTheme() {
        const savedTheme = localStorage.getItem('careerChallengesTheme');
        this.currentTheme = savedTheme || 'dark';
        this.applyTheme();
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CareerChallengesApp();

    // Allow users to expand history lists by clicking their headers. When
    // clicking on the “Heist History” or “Last Setups” titles, toggle an
    // `expanded` class on the respective list to reveal the full history.
    const heistHeaders = document.querySelectorAll('.heist-history h3');
    heistHeaders.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            const list = header.parentElement.querySelector('.heist-list');
            if (list) {
                list.classList.toggle('expanded');
            }
        });
    });
    const setupHeaders = document.querySelectorAll('.setup-history h3');
    setupHeaders.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            const list = header.parentElement.querySelector('.setup-list');
            if (list) {
                list.classList.toggle('expanded');
            }
        });
    });
});