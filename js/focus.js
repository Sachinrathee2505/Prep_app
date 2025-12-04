import { showToast, formatTime } from './utils.js'; // ✅ Added formatTime
import { firebase } from './firebase.js';

export class FocusMode {
    constructor({ db, uid, confetti, tasksCollection, appState }) {
        this.db = db;
        this.uid = uid;
        this.confetti = confetti;
        this.tasksCollection = tasksCollection;
        this.appState = appState;
        
        // State
        this.currentTask = null;
        this.sessionId = null;
        this.startTime = null;
        this.targetMinutes = 25;
        this.isPaused = false;
        this.isBreak = false;
        this.elapsed = 0;
        this.interval = null;
        this.motivations = [
            "⚡ Deep work mode activated", 
            "🎯 Stay focused, you're doing great!", 
            "💪 Building momentum...", 
            "🔥 In the zone!", 
            "🚀 Making progress!", 
            "✨ Keep going, almost there!"
        ];

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }    

    init() {
        this.overlay = document.getElementById('focusMode');
        this.taskName = document.getElementById('focusTaskName');
        this.timerDisplay = document.getElementById('focusTimerDisplay');
        this.progressBar = document.getElementById('focusProgressBar');
        this.status = document.getElementById('focusStatus');
        this.toggleBtn = document.getElementById('focusToggleBtn');
        this.endBtn = document.getElementById('focusEndBtn');
        this.presets = document.getElementById('focusPresets');
        this.content = this.overlay.querySelector('.focus-content');
        this.closeBtn = this.overlay.querySelector('.focus-close');
        this.breakOverlay = document.getElementById('breakOverlay');
        this.breakTimer = document.getElementById('breakTimer');
        this.skipBreakBtn = document.getElementById('skipBreakBtn');
        
        if (!this.overlay) return;
        
        this.setupEventListeners();
        
        // Auto-restore session
        const saved = localStorage.getItem('focusSession');
        if (saved) {
            try {
                const sessionData = JSON.parse(saved);
                const minimalTask = {
                    id: sessionData.taskId,
                    title: sessionData.taskTitle,
                    category: sessionData.taskCategory
                };
                this.restoreExistingSession(sessionData, minimalTask);
            } catch (e) {
                console.error('Error auto-restoring session:', e);
                localStorage.removeItem('focusSession');
            }
        }
    }

    setupEventListeners() {
        this.presets.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const minutes = e.currentTarget.dataset.minutes;
                if (minutes === 'custom') {
                    const custom = prompt('Enter minutes (5-180):', '45');
                    const parsed = parseInt(custom);
                    if (parsed >= 5 && parsed <= 180) this.startSession(parsed);
                } else {
                    this.startSession(parseInt(minutes));
                }
            });
        });
        
        window.addEventListener('beforeunload', () => {
            this.saveSession();
        });
        
        this.toggleBtn.addEventListener('click', () => this.toggleTimer());
        this.endBtn.addEventListener('click', () => this.endSession(false));
        this.closeBtn.addEventListener('click', () => this.close());
        this.skipBreakBtn.addEventListener('click', () => this.skipBreak());
        
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay && this.startTime && !this.isPaused) {
                if (confirm('Are you sure you want to end this focus session?')) {
                    this.endSession(false);
                }
            }
        });
    }

    open(task) {
        const saved = localStorage.getItem('focusSession');
        if (saved) {
            try {
                const sessionData = JSON.parse(saved);
                if (sessionData.taskId === task.id) {
                    this.restoreExistingSession(sessionData, task);
                    return;
                }
                if (confirm('You have an active session for another task. Start a new session?')) {
                    this.clearSession();
                } else {
                    return; 
                }
            } catch (e) {
                console.error('Error restoring session:', e);
                localStorage.removeItem('focusSession');
            }
        }
        
        this.currentTask = task;
        this.taskName.textContent = task.title;
        this.overlay.classList.remove('hidden');
        this.presets.style.display = 'block';
        this.content.style.display = 'none';
    }
  
    startSession(minutes) {
        this.targetMinutes = minutes;
        this.sessionId = `focus_${Date.now()}`;
        this.elapsed = 0;
        this.isBreak = false;
        
        this.presets.style.display = 'none';
        this.content.style.display = 'block';
        
        this.updateDisplay();
        this.toggleBtn.textContent = 'Pause';
        this.status.textContent = 'Focus Session';
        
        this.start();
    }
  
    start() {
        this.startTime = Date.now() - this.elapsed;
        this.isPaused = false;
        this.toggleBtn.textContent = 'Pause';
        this.status.textContent = 'Focus Session';
        
        this.interval = setInterval(() => this.tick(), 250);
        this.saveSession();
    }
  
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        this.elapsed = Date.now() - this.startTime;
        clearInterval(this.interval);
        this.toggleBtn.textContent = 'Resume';
        this.status.textContent = 'Paused';
        this.saveSession();
    }
  
    toggleTimer() {
        if (this.isPaused) this.start();
        else this.pause();
    }
  
    tick() {
        this.elapsed = Date.now() - this.startTime;
        const seconds = Math.floor(this.elapsed / 1000);
        this.updateDisplay();
        
        if (seconds % 5 === 0) {
            this.saveSession();
        }
        
        if (seconds % 10 === 0 && (this.elapsed % 1000) < 250) {
            const motivationEl = document.getElementById('focusMotivation');
            if (motivationEl) {
                const newMotivation = this.motivations[Math.floor(Math.random() * this.motivations.length)];
                motivationEl.textContent = newMotivation;
            }
        }

        if (this.elapsed >= this.targetMinutes * 60 * 1000) {
            this.completeSession();
        }
    }

    updateDisplay() {
        const totalSeconds = this.targetMinutes * 60;
        const elapsedSeconds = Math.floor(this.elapsed / 1000);
        
        const minutes = Math.floor(Math.max(0, totalSeconds - elapsedSeconds) / 60);
        const seconds = Math.floor(Math.max(0, totalSeconds - elapsedSeconds) % 60);
        
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.timerDisplay.textContent = timeString;
        // ✅Update browser tab title
        document.title = `(${timeString}) ${this.currentTask.title}`;
        this.progressBar.style.width = `${Math.min(100, (elapsedSeconds / totalSeconds) * 100)}%`;
    }

    restoreExistingSession(sessionData, task) {
        this.currentTask = task;
        this.taskName.textContent = task.title;
        this.sessionId = sessionData.sessionId;
        this.targetMinutes = sessionData.targetMinutes;
        this.elapsed = sessionData.elapsed;
        this.isPaused = true;
        
        this.overlay.classList.remove('hidden');
        this.presets.style.display = 'none';
        this.content.style.display = 'block';
        this.updateDisplay();
        this.toggleBtn.textContent = 'Resume';
        this.status.textContent = 'Session Paused';
        showToast('📌 Previous session restored', 'info');
    }
    
    async completeSession() {
        clearInterval(this.interval);
        const timeLogged = Math.round(this.elapsed / 1000);
        
        // 1. Update UI Optimistically
        this.updateDashboardUI(timeLogged);

        // 2. Save to DB
        if (timeLogged > 0 && this.db && this.uid) {
            try {
                const tasksRef = this.tasksCollection || this.db.collection('users').doc(this.uid).collection('tasks');
                
                // Atomic increment
                await tasksRef.doc(this.currentTask.id).update({ 
                    completed: true,
                    totalTimeLogged: firebase.firestore.FieldValue.increment(timeLogged)
                });

                const timeLogsCollection = this.db.collection('users').doc(this.uid).collection('timeLogs');
                await timeLogsCollection.add({
                    taskId: this.currentTask.id,
                    duration: timeLogged,
                    category: this.currentTask.category,
                    timestamp: new Date()
                });
                
                showToast(`🎉 Task "${this.currentTask.title}" completed!`);
                this.confetti?.({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
            } catch (error) {
                console.error('Error saving to database:', error);
                showToast('⚠️ Completed! (offline mode)', 'warning');
            }
        } else {
            showToast(`🎉 Task "${this.currentTask.title}" completed! (${Math.round(timeLogged/60)}min)`);
            this.confetti?.({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        }
        
        this.clearSession();
        this.startBreak();
    }
  
    async endSession(markComplete) {
        clearInterval(this.interval);
        const timeLogged = Math.round(this.elapsed / 1000);
        
        // 1. Update UI Optimistically
        this.updateDashboardUI(timeLogged);

        // 2. Save to DB
        if (timeLogged > 0 && this.db && this.uid) {
            try {
                const tasksRef = this.tasksCollection || this.db.collection('users').doc(this.uid).collection('tasks');
                
                const updates = {
                    totalTimeLogged: firebase.firestore.FieldValue.increment(timeLogged)
                };
                if (markComplete) updates.completed = true;
                
                await tasksRef.doc(this.currentTask.id).update(updates);

                const timeLogsCollection = this.db.collection('users').doc(this.uid).collection('timeLogs');
                await timeLogsCollection.add({
                    taskId: this.currentTask.id,
                    duration: timeLogged,
                    category: this.currentTask.category,
                    timestamp: new Date()
                });

                showToast(`⏱️ Logged ${Math.round(timeLogged / 60)} minutes`);
            } catch (error) {
                console.error('Error saving to database:', error);
                showToast(`⏱️ Session ended (${Math.round(timeLogged / 60)}min - offline)`, 'warning');
            }
        }
        
        this.clearSession();
        this.close();
    }

    startBreak() {
        this.isBreak = true;
        this.startTime = null;
        this.isPaused = false;
        this.breakOverlay.classList.remove('hidden');
        let breakSeconds = 5 * 60;
        this.breakTimer.textContent = `5:00`;
        
        this.interval = setInterval(() => {
            breakSeconds--;
            const minutes = Math.floor(breakSeconds / 60);
            const seconds = Math.floor(breakSeconds % 60);
            this.breakTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            if (breakSeconds <= 0) this.skipBreak();
        }, 1000);
    }

    skipBreak() {
        clearInterval(this.interval);
        this.breakOverlay.classList.add('hidden');
        this.isBreak = false;
        this.overlay.classList.add('hidden');
    }

    close() {
        if (this.startTime && !this.isPaused && !this.isBreak) {
            if (confirm('End this focus session?')) {
                this.endSession(false);
                return;
            } else {
                return;
            }
        }
        clearInterval(this.interval);
        this.overlay.classList.add('hidden');
        this.clearSession();
    }

    saveSession() {
        if (!this.currentTask) return;
        try {
            const sessionData = {
                taskId: this.currentTask.id,
                taskTitle: this.currentTask.title,
                taskCategory: this.currentTask.category,
                sessionId: this.sessionId,
                elapsed: this.isPaused ? this.elapsed : (Date.now() - this.startTime),
                targetMinutes: this.targetMinutes,
                savedAt: Date.now()
            };
            localStorage.setItem('focusSession', JSON.stringify(sessionData));
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    clearSession() {
        this.startTime = null;
        this.isPaused = true;
        this.elapsed = 0;
        this.currentTask = null;
        this.sessionId = null;
        this.isBreak = false;
        clearInterval(this.interval);
        localStorage.removeItem('focusSession');
        document.title = "Level Up Hub 🌟";
    }

    updateDashboardUI(addedSeconds) {
        if (!this.currentTask) return;

        // 1. Calculate new total securely
        let currentTotal = 0;
        
        // Try to find local state first
        if (this.appState && this.appState.tasks) {
            const task = this.appState.tasks.find(t => t.id === this.currentTask.id);
            if (task) currentTotal = task.totalTimeLogged || 0;
        }

        // Fallback to DOM if state isn't ready (prevents 0 overwrites)
        if (currentTotal === 0) {
            const card = document.querySelector(`.task-card[data-id="${this.currentTask.id}"]`);
            if (card) {
                const timerDisplay = card.querySelector('.timer-display');
                if (timerDisplay) {
                    const currentText = timerDisplay.textContent.trim();
                    const parts = currentText.split(':').map(Number);
                    if (parts.length === 3) {
                        currentTotal = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                    } else if (parts.length === 2) {
                        currentTotal = (parts[0] * 60) + parts[1];
                    }
                }
            }
        }

        // 2. Dispatch Event (This updates script.js -> appState -> UI)
        document.dispatchEvent(new CustomEvent('task-time-updated', {
            detail: {
                taskId: this.currentTask.id,
                addedSeconds: addedSeconds
            }
        }));
    }
}