// The Notepad class handles the mission notes textarea, including
// character counting, saving to localStorage, clearing notes and
// providing feedback on save operations. It automatically saves
// content after a short debounce when the user types.

class Notepad {
    constructor() {
        this.elements = {
            notepad: document.getElementById('notepad'),
            saveBtn: document.getElementById('saveNoteBtn'),
            clearBtn: document.getElementById('clearNoteBtn'),
            charCount: document.getElementById('charCount')
        };
        this.init();
    }
    init() {
        this.bindEvents();
        this.loadFromStorage();
        this.updateStats();
    }
    bindEvents() {
        this.elements.notepad.addEventListener('input', () => {
            this.updateStats();
            this.debouncedSave();
        });
        this.elements.saveBtn.addEventListener('click', () => this.save());
        this.elements.clearBtn.addEventListener('click', () => this.clear());
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.code === 'KeyS') {
                e.preventDefault();
                this.save();
            }
        });
    }
    updateStats() {
        const charCount = this.elements.notepad.value.length;
        this.elements.charCount.textContent = `${charCount} chars`;
    }
    save() {
        const content = this.elements.notepad.value;
        localStorage.setItem('heistNotes', content);
        this.showSaveFeedback();
    }
    debouncedSave() {
        clearTimeout(this.autoSave);
        this.autoSave = setTimeout(() => this.save(), 1000);
    }
    showSaveFeedback() {
        const originalText = this.elements.saveBtn.innerHTML;
        this.elements.saveBtn.innerHTML = '<span class="btn-icon">✅</span> Saved!';
        setTimeout(() => {
            this.elements.saveBtn.innerHTML = originalText;
        }, 2000);
    }
    clear() {
        if (this.elements.notepad.value && confirm('Clear all notes?')) {
            this.elements.notepad.value = '';
            this.updateStats();
            this.save();
        }
    }
    loadFromStorage() {
        const saved = localStorage.getItem('heistNotes');
        if (saved) {
            this.elements.notepad.value = saved;
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.notepad = new Notepad();
});