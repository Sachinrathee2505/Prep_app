import { showToast } from './utils.js';
export class FocusMode {
  constructor({ db, uid, confetti }) {
        this.db = db;
        this.uid = uid;
        this.confetti = confetti;
        
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

        // ✅ Call init after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }    
    init() { // DOM elements 
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
        
        // ✅ Add null checks
        if (!this.overlay) {
            console.warn('⚠️ Focus mode elements not found in DOM');
            return;
        }
        
        this.content = this.overlay.querySelector('.focus-content');
        
        // Setup event listeners
        this.setupEventListeners();
    }
    setupEventListeners() {    // Preset buttons
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
        
        // Control buttons
        this.toggleBtn.addEventListener('click', () => this.toggleTimer());
        this.endBtn.addEventListener('click', () => this.endSession(false)); // Don't mark task as complete
        this.closeBtn.addEventListener('click', () => this.close());
        this.skipBreakBtn.addEventListener('click', () => this.skipBreak());
        
        // Prevent accidental close
        this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay && this.startTime && !this.isPaused) {
            if (confirm('Are you sure you want to end this focus session?')) {
            this.endSession(false);
            }
        }
        });
        
        // Visibility change (auto-pause)
        document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.startTime && !this.isPaused && !this.isBreak) this.pause();
        });
    }

    open(task) {
        // Restore session if one exists for this task
        if (this.restoreSession(task.id)) {
            return;
        }
        // Otherwise, start a new one
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
        this.saveSession(); // Save state when we start/resume
        
        this.interval = setInterval(() => this.tick(), 250); // Update 4 times a second
    }
  
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        this.elapsed = Date.now() - this.startTime;
        clearInterval(this.interval);
        this.toggleBtn.textContent = 'Resume';
        this.status.textContent = 'Paused';
        this.saveSession(); // Save state when paused
    }
  
    toggleTimer() {
        if (this.isPaused) this.start();
        else this.pause();
    }
  
    tick() {
        this.elapsed = Date.now() - this.startTime;
        this.updateDisplay();
        const seconds = Math.floor(this.elapsed / 1000);
        if (seconds % 10 === 0 && (this.elapsed % 1000) < 250) { // Update once per 10s
            const motivationEl = document.getElementById('focusMotivation');
            if (motivationEl) {
                const newMotivation = this.motivations[Math.floor(Math.random() * this.motivations.length)];
                motivationEl.textContent = newMotivation;
            }
        }
        if (this.elapsed >= this.targetMinutes * 60 * 1000) {
        this.endSession(true); // Mark task as complete
        }
    }

    updateDisplay() {
        const totalSeconds = this.targetMinutes * 60;
        const elapsedSeconds = this.elapsed / 1000;
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = Math.floor(remainingSeconds % 60);
        
        this.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.progressBar.style.width = `${(elapsedSeconds / totalSeconds) * 100}%`;
    }
  
    async endSession(markComplete) {
        clearInterval(this.interval);
        const timeLogged = Math.round(this.elapsed / 1000);

        if (timeLogged > 60) { // Only log if more than a minute
        const timeLogsCollection = this.db.collection('users').doc(this.uid).collection('timeLogs');
        await timeLogsCollection.add({
            taskId: this.currentTask.id,
            duration: timeLogged,
            category: this.currentTask.category,
            timestamp: new Date()
        });

        if (markComplete) {
            const tasksCollection = this.db.collection('users').doc(this.uid).collection('tasks');
            await tasksCollection.doc(this.currentTask.id).update({ completed: true });
            showToast(`Task "${this.currentTask.title}" marked as complete!`);
            this.confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        }
        }
        
        this.clearSession();
        this.isBreak ? this.close() : this.startBreak();
    }

    startBreak() {
        this.isBreak = true;
        this.breakOverlay.classList.remove('hidden');
        let breakSeconds = 5 * 60; // 5 minute break
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
        this.close();
    }

    close() {
        if (this.startTime && !this.isPaused) this.endSession(false);
        this.overlay.classList.add('hidden');
        this.clearSession();
    }

    saveSession() {
        const sessionData = {
            taskId: this.currentTask.id,
            taskTitle: this.currentTask.title,
            sessionId: this.sessionId,
            elapsed: this.elapsed,
            targetMinutes: this.targetMinutes,
            startTime: this.startTime
        };
        localStorage.setItem('focusSession', JSON.stringify(sessionData));
    }

    restoreSession(taskId) {
        const saved = localStorage.getItem('focusSession');
        if (!saved) return false;
        
        const sessionData = JSON.parse(saved);
        if (sessionData.taskId !== taskId) return false;

        this.currentTask = { id: sessionData.taskId, title: sessionData.taskTitle };
        this.taskName.textContent = this.currentTask.title;
        this.sessionId = sessionData.sessionId;
        this.elapsed = sessionData.elapsed;
        this.targetMinutes = sessionData.targetMinutes;
        
        this.overlay.classList.remove('hidden');
        this.presets.style.display = 'none';
        this.content.style.display = 'block';

        this.pause(); // Start in a paused state
        this.updateDisplay();
        return true;
    }

    clearSession() {
        this.startTime = null;
        this.isPaused = true;
        this.currentTask = null;
        localStorage.removeItem('focusSession');
    }
}