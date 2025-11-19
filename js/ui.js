import {
    showToast,
    closeModal,
    getWeekRange,
    hexToRgba,
    convertSecondsToMinutes,
    formatTime,
    triggerConfettiAnimation,
    getCompletionRate,
    getCategoryName,
    showLoadingOverlay,
    hideLoadingOverlay
} from './utils.js';
import { db } from './firebase.js';

export class UI {
    constructor(config) {
        // Store state and core elements from the main script
        this.appState = config.appState;
        this.auth = config.auth;
        this.mainContent = config.mainContent;
        this.modalContainer = config.modalContainer;

        // Find and store all other elements the UI will manage
        this.navDashboard = document.getElementById('nav-dashboard');
        this.navSkills = document.getElementById('nav-skills');
        this.navInsights = document.getElementById('nav-insights');
        this.navButtons = document.getElementById('nav-buttons');
        this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
        this.userInfo = document.getElementById('user-info');
        this.signInBtn = document.getElementById('sign-in-btn');
        this.addTaskBtn = document.getElementById('add-task-btn');
        
        // Store globals from the window
        this.confetti = window.confetti;
        this.Chart = window.Chart;
        this.anime = window.anime;

        // A place to store the heatmap tooltip
        this.heatmapTooltip = null;

        // Define empty states
        this.emptyStates = {
            default: { title: "Ready to Level Up?", description: "Your dashboard is clear. Click the '+' button to add your first task and start your journey.", icon: "start" },
            completed: { title: "No Completed Tasks Yet", description: "Complete some tasks to see them here and earn your rewards!", icon: "trophy" },
            active: { title: "All Tasks Completed! 🎉", description: "Great job! You've completed all your tasks. Add new ones to keep the momentum going.", icon: "checkmark" },
            overdue: { title: "You're All Caught Up!", description: "No overdue tasks. Keep up the great work!", icon: "clock" }
        };

        // Initialize mobile menu events immediately
        this.initializeMobileMenu();
    }

    // --- Core Rendering ---

    render() {
        if (this.appState.currentView === 'dashboard') this.renderDashboard();
        else if (this.appState.currentView === 'skills') this.renderSkillsDashboard();
        else if (this.appState.currentView === 'insights') {
            const uid = this.auth.currentUser.uid;
            this.renderInsightsDashboard(
                db.collection('users').doc(uid).collection('tasks')
            );
        }
    }

    navigate = (view) =>{
        this.appState.currentView = view;
        this.navDashboard.classList.toggle('bg-gray-700', view === 'dashboard');
        this.navDashboard.classList.toggle('text-white', view === 'dashboard');
        this.navSkills.classList.toggle('bg-gray-700', view === 'skills');
        this.navSkills.classList.toggle('text-white', view === 'skills');
        this.navInsights.classList.toggle('bg-gray-700', view === 'insights');
        this.navInsights.classList.toggle('text-white', view === 'insights');
        this.render();
    }

    // --- Navigation & Header UI ---

    updateNavigationVisibility(isLoggedIn) {
        document.body.classList.add('auth-ready');
        
        if (isLoggedIn) {
            // LOGGED IN STATE
            if (this.navButtons) {
                this.navButtons.className = 'hidden lg:flex items-center space-x-4';
                this.navButtons.style.opacity = '1';
                this.navButtons.style.visibility = 'visible';
            }
            if (this.mobileMenuBtn) {
                this.mobileMenuBtn.classList.remove('hidden');
                this.mobileMenuBtn.classList.add('flex', 'lg:hidden');
                this.mobileMenuBtn.style.opacity = '1';
                this.mobileMenuBtn.style.visibility = 'visible';
            }
            if (this.userInfo) {
                this.userInfo.classList.remove('hidden');
                this.userInfo.classList.add('flex');
            }
            if (this.signInBtn) {
                this.signInBtn.classList.add('hidden');
            }
            if (this.addTaskBtn) {
                this.addTaskBtn.classList.remove('hidden');
            }
        } else {
            // LOGGED OUT STATE
            if (this.navButtons) {
                this.navButtons.className = 'hidden';
            }
            if (this.mobileMenuBtn) {
                this.mobileMenuBtn.classList.add('hidden');
            }
            if (this.userInfo) {
                this.userInfo.classList.add('hidden');
            }
            if (this.signInBtn) {
                this.signInBtn.classList.remove('hidden');
                // signInBtn.onclick is handled in script.js
            }
            if (this.addTaskBtn) {
                this.addTaskBtn.classList.add('hidden');
            }
        }
    }

    initializeMobileMenu= () =>{
        if (this.mobileMenuBound) return;
        this.mobileMenuBound = true;
        const mobileMenuClose = document.getElementById('mobile-menu-close');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
        
        // Open mobile menu
        this.mobileMenuBtn?.addEventListener('click', () => {
            mobileMenu.classList.remove('hidden');
            mobileMenuOverlay.classList.remove('hidden');
            setTimeout(() => {
                mobileMenu.classList.remove('translate-x-full');
            }, 10);
        });
        
        // Close mobile menu
        const closeMobileMenu = () => {
            mobileMenu.classList.add('translate-x-full');
            setTimeout(() => {
                mobileMenu.classList.add('hidden');
                mobileMenuOverlay.classList.add('hidden');
            }, 300);
        };
        
        mobileMenuClose?.addEventListener('click', closeMobileMenu);
        mobileMenuOverlay?.addEventListener('click', closeMobileMenu);
        
        // Mobile navigation buttons
        document.getElementById('mobile-nav-dashboard')?.addEventListener('click', () => {
            closeMobileMenu();
            this.navigate('dashboard');
        });
        
        document.getElementById('mobile-nav-skills')?.addEventListener('click', () => {
            closeMobileMenu();
            this.navigate('skills');
        });
        
        document.getElementById('mobile-nav-insights')?.addEventListener('click', () => {
            closeMobileMenu();
            this.navigate('insights');
        });
        
        document.getElementById('mobile-report-btn')?.addEventListener('click', () => {
            closeMobileMenu();
            const uid = this.auth.currentUser.uid;
            this.showWeeklyReportModal(
                db.collection('users').doc(uid).collection('timeLogs'), 
                db.collection('users').doc(uid).collection('tasks')
            );
        });
        document.getElementById('mobile-achievements-btn')?.addEventListener('click', () => {
            closeMobileMenu();
            document.getElementById('achievements-btn')?.click();
        });
        
        document.getElementById('mobile-sign-out-btn')?.addEventListener('click', () => {
            closeMobileMenu();
            document.getElementById('sign-out-btn')?.click();
        });
    }

    updateMobileUserInfo() {
        const userPic = document.getElementById('user-pic')?.src;
        const userName = document.getElementById('user-name')?.textContent;
        const streakCount = document.getElementById('streak-count')?.textContent;
        
        const mobileUserPic = document.getElementById('mobile-user-pic');
        const mobileUserName = document.getElementById('mobile-user-name');
        const mobileStreakCount = document.getElementById('mobile-streak-count');

        if (userPic && mobileUserPic) mobileUserPic.src = userPic;
        if (userName && mobileUserName) mobileUserName.textContent = userName;
        if (streakCount && mobileStreakCount) mobileStreakCount.textContent = streakCount;
        
        const mobileUserSection = document.getElementById('mobile-user-section');
        const userInfo = document.getElementById('user-info');
        if (userInfo && !userInfo.classList.contains('hidden')) {
            mobileUserSection.classList.remove('hidden');
        } else {
            mobileUserSection.classList.add('hidden');
        }
    }

    // --- Dashboard Rendering ---

    renderDashboard() {
        
        if (this.appState.isLoading) {
            this.renderSkeletons();
            return;
        }
        if (!this.appState.userCategories || this.appState.userCategories.length === 0) {
            this.mainContent.innerHTML = `<div class="text-center p-8"><p class="text-gray-400">Loading your personalized dashboard...</p></div>`;
            return;
        }

        this.cleanupTimers();

        const columnsHTML = this.appState.userCategories.map(cat => `
            <div id="col-${cat.id}" class="bg-gray-800 rounded-lg p-4">
                <h2 class="text-lg font-bold mb-4" style="color: ${cat.color};">${cat.icon || '🎯'} ${cat.name}</h2>
                <div class="space-y-4"></div>
            </div>
        `).join('');

        this.mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-${this.appState.userCategories.length} gap-6">${columnsHTML}</div>`;
        let tasksToRender = [];
        if (this.appState.activeFilter === 'completed') {
            tasksToRender = this.appState.tasks.filter(t => t.completed);
        } else {
            const { startOfWeek } = getWeekRange(new Date());
            const overdue = this.appState.tasks.filter(t => !t.completed && new Date(t.dueDate) < startOfWeek);
            const thisWeek = this.appState.tasks.filter(t => !t.completed && new Date(t.dueDate) >= startOfWeek);
            tasksToRender = [...overdue, ...thisWeek];
        }

        if (tasksToRender.length === 0) {
            let stateKey = this.appState.activeFilter;
            if (this.appState.tasks.length === 0 && this.appState.activeFilter === 'active') {
                stateKey = 'default';
            }
            if (this.appState.tasks.length === 0) stateKey = 'default';
            this.mainContent.innerHTML = this.renderEmptyState(stateKey);
            if (stateKey === 'active') triggerConfettiAnimation();
            this.updateAlertBanner();
            return; 
        }
        
        tasksToRender.forEach(task => {
            const column = this.mainContent.querySelector(`#col-${task.category} .space-y-4`);
            if (column) {
                column.appendChild(this.createTaskCard(task));
            } else {
                const firstColumn = this.mainContent.querySelector('.space-y-4');
                if(firstColumn) firstColumn.appendChild(this.createTaskCard(task));
            }
        });

        this.updateAlertBanner();
        this.setupTimers();
    }

    renderSkeletons() {
        this.mainContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${Array(6).fill('').map(() => `
                    <div class="col-span-1 bg-gray-800 rounded-lg p-4">
                        <div class="skeleton-card">
                            <div class="skeleton" style="height: 20px; width: 75%; margin-bottom: 1rem;"></div>
                            <div class="skeleton" style="height: 14px; width: 50%;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    createTaskCard(task) {
        const card = document.createElement('div');
        let cardClasses = 'task-card relative';
        if (task.priority === 'High') {
            cardClasses += ' priority-high';
        }
        card.className = cardClasses;
        card.dataset.id = task.id;
    
        const totalTime = task.totalTimeLogged || 0;
        const timeDisplay = `${String(Math.floor(totalTime / 3600)).padStart(2, '0')}:${String(Math.floor((totalTime % 3600) / 60)).padStart(2, '0')}:${String(totalTime % 60).padStart(2, '0')}`;
    
        const categoryObj = this.appState.userCategories?.find(c => c.id === task.category);
        const categoryName = categoryObj ? categoryObj.name : "Uncategorized";
        const categoryIcon = categoryObj ? categoryObj.icon : "📋";
    
        let projectHTML = '';
    
        if (task.type === 'project' && task.subtasks) {
            const completedSubtasks = task.subtasks.filter(st => st.completed).length;
            const progress = task.subtasks.length > 0 ? (completedSubtasks / task.subtasks.length) * 100 : 0;
            projectHTML = `<div class="mt-2"><div class="w-full bg-gray-600 rounded-full h-2.5"><div class="bg-cyan-600 h-2.5 rounded-full transition-all duration-500 ease-out" style="width: ${progress}%"></div></div><ul class="mt-2 text-sm space-y-1">${task.subtasks.map((st, index) => `<li class="flex items-center"><input type="checkbox" data-subtask-index="${index}" class="mr-2 h-4 w-4 rounded bg-gray-800 border-gray-600 text-cyan-500 focus:ring-cyan-600" ${st.completed ? 'checked' : ''}><span class="${st.completed ? 'line-through text-gray-400' : ''}">${st.text}</span></li>`).join('')}</ul></div>`;
        }
    
        card.innerHTML = `
            <div class="card-transform-layer"></div>
    
            <div class="card-content relative z-10 ${task.priority === 'High' ? 'border-red-500' : task.priority === 'Medium' ? 'border-yellow-500' : 'border-green-500'} border-l-4 pl-4 ${task.completed ? 'completed' : ''}">
    
                <div class="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <span>${categoryIcon}</span> ${categoryName}
                </div>
    
                <div class="flex justify-between items-start">
                    <div class="flex-grow">
                        <h3 class="font-bold">${task.title}</h3>
                        <p class="text-sm text-gray-400">Due: ${new Date(task.dueDate).toLocaleDateString()}</p>
                        ${task.url ? `<a href="${task.url}" target="_blank" class="text-sm text-cyan-400 hover:underline">Resource Link</a>` : ''}
                        <div class="mt-2 flex flex-wrap gap-2">${(task.skills || []).map(skill => `<span class="text-xs bg-gray-600 px-2 py-1 rounded-full">${skill}</span>`).join('')}</div>
                    </div>
                    <div class="flex-shrink-0 relative z-20">
                        <input type="checkbox" class="task-checkbox h-5 w-5 rounded bg-gray-800 border-gray-600 text-cyan-500 focus:ring-cyan-600" ${task.completed ? 'checked' : ''}>
                        <div class="starburst-container absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none"></div>
                    </div>
                </div>
                ${projectHTML}
                <div class="mt-4 flex justify-between items-center text-sm">
                    <div class="flex items-center space-x-2">
                        <button class="timer-btn p-1 rounded-md ${task.timerRunning ? 'bg-red-500' : 'bg-green-500'} hover:opacity-80" title="${task.timerRunning ? 'Stop Timer' : 'Start Timer'}">${task.timerRunning ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" /></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>'}</button>
                        <button class="focus-btn p-1 rounded-md bg-purple-500 hover:opacity-80" title="Start Focus Session">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                        <span class="timer-display font-mono">${timeDisplay}</span>
                    </div>
                    <div>
                        <button class="edit-btn text-gray-400 hover:text-cyan-400 p-1 rounded-md" title="Edit Task">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                        </button>
                        <button class="delete-btn text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                </div>
            </div>`;
    
        return card;
    }

    // --- Dashboard Helpers ---

    cleanupTimers() {
        if (this.appState.timers) {
            Object.values(this.appState.timers).forEach(timerId => {
                if (timerId) clearInterval(timerId);
            });
            this.appState.timers = {};
        }
        console.log('✅ All task timers cleaned up');
    }
    
    updateAlertBanner() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueTodayOrOverdue = this.appState.tasks.filter(t => {
            if (t.completed) return false;
            const dueDate = new Date(t.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate <= today;
        });
    
        const alertBanner = document.getElementById('alert-banner');
        if (!alertBanner) return;
        
        alertBanner.classList.toggle('hidden', dueTodayOrOverdue.length === 0);
        if (dueTodayOrOverdue.length > 0) {
            alertBanner.textContent = `🔔 You have ${dueTodayOrOverdue.length} task(s) due today or overdue!`;
        }
    }
    
    setupTimers() {
        this.appState.tasks
            .filter(t => t.timerRunning)
            .forEach(task => {
                const card = document.querySelector(`.task-card[data-id="${task.id}"]`);
                const timerDisplay = card?.querySelector('.timer-display');
                
                if (!timerDisplay) return;
    
                this.appState.timers[task.id] = setInterval(() => {
                    let startTime;
                    if (task.lastStartTime?.toDate) startTime = task.lastStartTime.toDate();
                    else startTime = new Date(task.lastStartTime);

                    if (!startTime || isNaN(startTime.getTime())) return;
    
                    const elapsed = Math.round((new Date() - startTime) / 1000);
                    const totalTime = (task.totalTimeLogged || 0) + elapsed;
                    
                    const h = Math.floor(totalTime / 3600);
                    const m = Math.floor((totalTime % 3600) / 60);
                    const s = totalTime % 60;
    
                    timerDisplay.textContent = [h, m, s]
                        .map(n => String(n).padStart(2, '0'))
                        .join(':');
                }, 1000);
            });
    }

    add3DTiltEffect() {
        if (this.tiltBound) return;
        this.tiltBound = true;
        if (!this.mainContent) return;
        let lastTransformLayer = null;
    
        this.mainContent.addEventListener('mousemove', e => {
            const card = e.target.closest('.task-card');
            const currentLayer = card ? card.querySelector('.card-transform-layer') : null;
    
            if (lastTransformLayer && lastTransformLayer !== currentLayer) {
                lastTransformLayer.style.transform = `translateZ(0) rotateX(0deg) rotateY(0deg)`;
            }
    
            if (currentLayer) {
                const rect = currentLayer.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 15;
                const rotateY = (centerX - x) / 15;
    
                currentLayer.style.setProperty('--mouse-x', `${x}px`);
                currentLayer.style.setProperty('--mouse-y', `${y}px`);
                currentLayer.style.transform = `translateZ(20px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    
                lastTransformLayer = currentLayer;
            } else {
                lastTransformLayer = null;
            }
        });
    
        this.mainContent.addEventListener('mouseleave', () => {
            if (lastTransformLayer) {
                lastTransformLayer.style.transform = `translateZ(0) rotateX(0deg) rotateY(0deg)`;
                lastTransformLayer = null;
            }
        });
    }

    createShatterEffect(cardElement) {
        if (!this.anime) {
            console.warn('anime.js not loaded');
            return;
        }
        const rect = cardElement.getBoundingClientRect();
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        container.style.width = `${rect.width}px`;
        container.style.height = `${rect.height}px`;
        container.style.zIndex = '100';
        document.body.appendChild(container);
    
        cardElement.style.opacity = '0';
    
        const gridSize = 10;
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const particle = document.createElement('div');
                particle.style.position = 'absolute';
                particle.style.left = `${(i / gridSize) * 100}%`;
                particle.style.top = `${(j / gridSize) * 100}%`;
                particle.style.width = `${100 / gridSize}%`;
                particle.style.height = `${100 / gridSize}%`;
                particle.style.background = 'rgb(75 85 99)';
                container.appendChild(particle);
            }
        }
    
        this.anime({
            targets: container.children,
            translateX: () => this.anime.random(-100, 100),
            translateY: () => this.anime.random(-150, 50),
            scale: () => this.anime.random(0.2, 0.8),
            opacity: [1, 0],
            delay: this.anime.stagger(20, {from: 'center'}),
            duration: 800,
            easing: 'easeOutExpo',
            complete: () => {
                container.remove();
            }
        });
    }

    // --- Empty State ---

    renderEmptyState(state = 'default') {
        const currentState = this.emptyStates[state] || this.emptyStates.default;
        return `
            <div class="flex flex-col items-center justify-center h-full text-center p-8">
                <svg class="w-16 h-16 text-gray-600 mb-4 transform hover:scale-110 transition-transform" fill="currentColor"><use xlink:href="#icon-${currentState.icon}"></use></svg>
                <h2 class="text-2xl font-bold text-white mb-2">${currentState.title}</h2>
                <p class="text-gray-400 max-w-sm mb-6">${currentState.description}</p>
                ${this._getQuickActions(state)}
                ${this._getMotivationalElement(state)}
            </div>
        `;
    }
    
    _getQuickActions(filter) {
        const actions = {
            default: [ { label: 'Add Task', icon: 'plus', action: 'addTask' }, { label: 'Import Tasks', icon: 'import', action: 'importTasks' } ],
            completed: [{ label: 'View Statistics', icon: 'chart', action: 'viewStats' } ],
            active: [ { label: 'Add New Task', icon: 'plus', action: 'addTask' } ],
            overdue: []
        };
        const actionButtons = actions[filter] || actions.default;
        // Note: onclick still calls a global function 'handleQuickAction'
        return `<div class="flex gap-4 mt-4">${actionButtons.map(action => `<button onclick="handleQuickAction('${action.action}')" class="flex items-center px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"><svg class="w-4 h-4 mr-2"><use xlink:href="#icon-${action.icon}"></use></svg>${action.label}</button>`).join('')}</div>`;
    }
    
    _getMotivationalElement(filter) {
        if (filter === 'completed') {
            const rate = getCompletionRate(this.appState); // Use util
            return `<div class="mt-6 bg-gray-800 rounded-lg p-4 w-full max-w-sm"><div class="text-sm text-gray-400">Your Progress</div><div class="flex items-center gap-4 mt-2"><div class="flex-1"><div class="h-2 bg-gray-700 rounded-full overflow-hidden"><div class="h-full bg-blue-500" style="width: ${rate}%"></div></div></div><div class="text-white font-medium">${rate}%</div></div></div>`;
        }
        return '';
    }

    // --- Skills Page ---

    renderSkillsDashboard() {
        this.mainContent.innerHTML = `<div class="bg-gray-800 rounded-lg p-6"><h2 class="text-2xl font-bold mb-6 text-cyan-400"> Skill Rating Matrix</h2><div id="skills-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div></div>`;
        const grid = document.getElementById('skills-grid');
        if (Object.keys(this.appState.skills).length === 0) {
          grid.innerHTML = `<p class="text-gray-400 col-span-full">No skills tracked yet. Complete tasks with skill tags to see your progress!</p>`;
          return;
        }
        const getSkillAvg = (skill) => {
            return skill.count > 0 ? (skill.totalConfidence / skill.count) : 0;
        };
        Object.values(this.appState.skills)
            .sort((a, b) => getSkillAvg(a) - getSkillAvg(b)) // Sort by the safe average
            .forEach(skill => {
          const average = getSkillAvg(skill);
          const skillCard = document.createElement('div');
          skillCard.className = 'bg-gray-700 p-4 rounded-lg flex flex-col justify-between';
          skillCard.innerHTML = `<div><h3 class="font-bold text-lg">${skill.name}</h3><p class="text-sm text-gray-400">Rated ${skill.count} time(s)</p></div><div class="mt-4"><p class="text-sm text-gray-300">Confidence: ${average.toFixed(1)} / 5.0</p><div class="w-full bg-gray-600 rounded-full h-2.5 mt-1"><div class="bg-cyan-600 h-2.5 rounded-full" style="width: ${average / 5 * 100}%"></div></div></div>`;
          grid.appendChild(skillCard);
        });
    }

    // --- Insights Page ---

    async renderInsightsDashboard(tasksCollection) {
        try {
            const userProfile = this.appState.userProfile;
            const userId = this.auth.currentUser?.uid;
     
            if (!userProfile || !userId) {
                this._showError('User profile not loaded');
                return;
            }

            this.mainContent.innerHTML = `
                <div class="bg-gray-800 rounded-lg p-6">
                    <h2 class="text-2xl font-bold mb-6 text-cyan-400">Insights Dashboard</h2>
                    <div class="max-w-md mx-auto">
                        <h3 class="text-lg font-semibold text-center mb-4">Total Time Allocation</h3>
                        <canvas id="timeAllocationChart"></canvas>
                    </div>
                    <div class="mt-8">
                        <h3 class="text-lg font-semibold text-center mb-4">Daily Activity Heatmap</h3>
                        <div id="activity-heatmap" class="activity-heatmap">
                        </div>
                   </div>                      
                    <div id="chart-error" class="hidden text-red-400 text-center mt-4"></div>
                </div>
            `;
     
            const timeData = await this._fetchTimeData(userId, userProfile);
            await this._createChart(timeData, userProfile);
            this.renderActivityHeatmap(tasksCollection);
             
        } catch (error) {
            console.error('Error rendering insights dashboard:', error);
            this._showError('Failed to load insights dashboard. Please try again later.');
        }
    }
     
    async _fetchTimeData(userId, userProfile) {
        const focusAreas = userProfile?.focusAreas || [];
        if (!Array.isArray(focusAreas) || focusAreas.length === 0) {
            console.warn("⚠️ No focus areas found. Returning empty dataset.");
            return {};
        }
     
        const timeData = {};
        focusAreas.forEach(area => {
            timeData[area.id] = 0;
        });
     
        const categoryMapping = this._createCategoryMapping(focusAreas);
     
        try {
            const logsSnapshot = await db.collection('users')
                .doc(userId)
                .collection('timeLogs')
                .get();
     
            logsSnapshot.forEach(doc => {
                const log = doc.data();
                let catId = log.categoryId || log.category;
                const duration = Number(log.duration) || 0;
     
                if (catId && !timeData.hasOwnProperty(catId)) {
                    const mappedId = categoryMapping[catId.toLowerCase()];
                    if (mappedId) catId = mappedId;
                }
     
                if (catId && timeData.hasOwnProperty(catId)) {
                    timeData[catId] += Math.max(0, duration);
                } else {
                    console.warn('⚠️ Skipping unknown category:', catId, 'in log:', doc.id);
                }
            });
     
            console.log('✅ Final Processed Time Data:', timeData);
            return timeData;
     
        } catch (error) {
            console.error('❌ Error fetching time data:', error);
            throw new Error(`Failed to fetch time logs: ${error.message}`);
        }
    }
     
    _createCategoryMapping(focusAreas) {
        const mapping = {};

        focusAreas.forEach(area => {
            // Map the display name (case-insensitive)
            mapping[area.name.toLowerCase()] = area.id;

            // Also map the ID itself for safety
            mapping[area.id.toLowerCase()] = area.id;
        });

        return mapping;
    }

     
    async _createChart(timeData, userProfile) {
        const canvas = document.getElementById('timeAllocationChart');
        if (!canvas) throw new Error('Canvas element not found');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');
     
        const focusAreas = userProfile?.focusAreas || [];
        if (focusAreas.length === 0) throw new Error('No focus areas found');
     
        const labels = focusAreas.map(area => area.name);
         
        const data = focusAreas.map(area => {
            let raw = timeData[area.id] || 0;
            return convertSecondsToMinutes(raw); // Use util function
        });
     
        const backgroundColor = focusAreas.map(area => hexToRgba(area.color || '#6B7280', 0.7));
        const borderColor = focusAreas.map(area => area.color || '#6B7280');
     
        const chartConfig = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Time Spent (in minutes)',
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { 
                            color: '#d1d5db',
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const minutes = context.raw;
                                const hours = Math.floor(minutes / 60);
                                const mins = minutes % 60;
                                return `${hours}h ${mins}m (${minutes} total minutes)`;
                            }
                        }
                    }
                }
            }
        };
     
        if (window.timeChartInstance) {
            window.timeChartInstance.destroy();
        }
     
        try {
            window.timeChartInstance = new this.Chart(ctx, chartConfig);
            return window.timeChartInstance;
        } catch (error) {
            throw new Error(`Failed to create chart: ${error.message}`);
        }
    }

    _showError(message) {
        const errorDiv = document.getElementById('chart-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    // --- Activity Heatmap ---

    async renderActivityHeatmap(tasksCollection) {
        const heatmap = document.getElementById('activity-heatmap');
        if (!heatmap) return;
    
        // Create and manage tooltip
        if (!this.heatmapTooltip) {
            this.heatmapTooltip = document.createElement('div');
            this.heatmapTooltip.className = 'heatmap-tooltip';
            this.heatmapTooltip.style.display = 'none';
            document.body.appendChild(this.heatmapTooltip);
        }
        const tooltip = this.heatmapTooltip;
    
        try {
            const endDate = new Date();
            const startDate = new Date();
            const isMobile = window.innerWidth < 640;
            const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
            const daysToShow = isMobile ? 90 : isTablet ? 120 : 180;
            startDate.setDate(endDate.getDate() - daysToShow);
    
            const tasksSnapshot = await tasksCollection
                .where('completed', '==', true)
                .get();
    
            const completionData = {};
            tasksSnapshot.forEach(doc => {
                const task = doc.data();
                if (!task.completedAt) return;
                let completedDate;
                try {
                    completedDate = task.completedAt.toDate ? 
                        task.completedAt.toDate() : 
                        new Date(task.completedAt);
                } catch (error) { return; }
                
                if (completedDate >= startDate && completedDate <= endDate) {
                    const dateString = completedDate.toISOString().split('T')[0];
                    completionData[dateString] = (completionData[dateString] || 0) + 1;
                }
            });
    
            heatmap.innerHTML = ''; 
            const wrapper = document.createElement('div');
            wrapper.className = 'heatmap-wrapper';
            const container = document.createElement('div');
            container.className = 'heatmap-container';
    
            const weeks = [];
            let currentDate = new Date(startDate);
            while (currentDate.getDay() !== 0) {
                currentDate.setDate(currentDate.getDate() - 1);
            }
    
            while (currentDate <= endDate) {
                const week = [];
                for (let i = 0; i < 7; i++) {
                    const dateString = currentDate.toISOString().split('T')[0];
                    const count = completionData[dateString] || 0;
                    const isInRange = currentDate >= startDate && currentDate <= endDate;
                    week.push({
                        date: new Date(currentDate),
                        dateString,
                        count,
                        isInRange,
                        dayOfWeek: currentDate.getDay()
                    });
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                weeks.push(week);
            }
    
            const dayLabels = document.createElement('div');
            dayLabels.className = 'day-labels';
            const days = isMobile ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            days.forEach(day => {
                const label = document.createElement('span');
                label.className = 'day-label';
                label.textContent = day;
                dayLabels.appendChild(label);
            });
            container.appendChild(dayLabels);
    
            const gridWrapper = document.createElement('div');
            gridWrapper.className = 'grid-wrapper';
            const monthLabels = document.createElement('div');
            monthLabels.className = 'month-labels';
            monthLabels.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;
            
            let lastMonth = -1;
            weeks.forEach((week, weekIndex) => {
                const firstDay = week[0].date;
                const month = firstDay.getMonth();
                if (month !== lastMonth && week[0].isInRange) {
                    const label = document.createElement('span');
                    label.className = 'month-label';
                    label.textContent = firstDay.toLocaleDateString('en-US', { month: 'short' });
                    label.style.gridColumn = `${weekIndex + 1}`;
                    monthLabels.appendChild(label);
                    lastMonth = month;
                }
            });
            gridWrapper.appendChild(monthLabels);
    
            const grid = document.createElement('div');
            grid.className = 'heatmap-grid';
            grid.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;
            
            weeks.forEach(week => {
                const weekColumn = document.createElement('div');
                weekColumn.className = 'week-column';
                week.forEach(day => {
                    const count = day.count;
                    let colorLevel = 0;
                    if (count > 0) colorLevel = 1;
                    if (count >= 3) colorLevel = 2;
                    if (count >= 5) colorLevel = 3;
                    if (count >= 8) colorLevel = 4;
    
                    const cell = document.createElement('div');
                    cell.className = 'day-cell';
                    if (!day.isInRange) {
                        cell.classList.add('inactive');
                    } else if (colorLevel > 0) {
                        cell.classList.add(`color-level-${colorLevel}`);
                    }
                    
                    const dateStr = day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    const tooltipText = !day.isInRange ? dateStr :
                        count === 0 ? `No tasks on ${dateStr}` : 
                        `${count} task${count !== 1 ? 's' : ''} completed on ${dateStr}`;
                    
                    cell.addEventListener('mouseenter', (e) => {
                        tooltip.textContent = tooltipText;
                        tooltip.style.display = 'block';
                        const rect = cell.getBoundingClientRect();
                        tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
                        tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
                    });
                    
                    cell.addEventListener('mouseleave', () => {
                        tooltip.style.display = 'none';
                    });
                    
                    cell.addEventListener('click', (e) => {
                        if (isMobile) {
                            tooltip.textContent = tooltipText;
                            tooltip.style.display = 'block';
                            const rect = cell.getBoundingClientRect();
                            tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
                            tooltip.style.top = `${rect.top - 10}px`;
                            setTimeout(() => { tooltip.style.display = 'none'; }, 2000);
                        }
                    });
                    weekColumn.appendChild(cell);
                });
                grid.appendChild(weekColumn);
            });
            gridWrapper.appendChild(grid);
            container.appendChild(gridWrapper);
    
            const legend = document.createElement('div');
            legend.className = 'heatmap-legend';
            legend.innerHTML = `
                <span class="legend-label">${isMobile ? 'Less' : 'Activity:'}</span>
                <div class="legend-item"><div class="day-cell"></div></div>
                <div class="legend-item"><div class="day-cell color-level-1"></div></div>
                <div class="legend-item"><div class="day-cell color-level-2"></div></div>
                <div class="legend-item"><div class="day-cell color-level-3"></div></div>
                <div class="legend-item"><div class="day-cell color-level-4"></div></div>
                <span class="legend-label">${isMobile ? 'More' : ''}</span>
            `;
            container.appendChild(legend);
            
            wrapper.appendChild(container);
            heatmap.appendChild(wrapper);
            
            console.log(`✅ Activity heatmap rendered (${daysToShow} days, ${weeks.length} weeks)`);
                
        } catch (error) {
            console.error('❌ Error rendering activity heatmap:', error);
            heatmap.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    <p>Unable to load activity data</p>
                    <p class="text-xs mt-2">${error.message}</p>
                </div>
            `;
        }
    }

    // --- Modal Functions ---

    async _handleFormSubmit(e, tasksCollection, taskId=null) {
        e.preventDefault();
        showLoadingOverlay();
        const formData = new FormData(e.target);
        const taskData = {
          type: formData.get('type'),
          title: formData.get('title'),
          dueDate: formData.get('dueDate'),
          priority: formData.get('priority'),
          category: formData.get('category'),
          url: formData.get('url'),
          skills: formData.get('skills').split(',').map(s => s.trim()).filter(Boolean),
        };
        if (taskData.type === 'project') {
        const subtaskInputs = e.target.querySelectorAll('.subtask-input');
        taskData.subtasks = Array.from(subtaskInputs)
            .map((input, index) => ({
                text: input.value,
                // Preserve completion state if editing
                completed: input.dataset.completed === 'true' || false 
            }))
            .filter(st => st.text.trim() !== '');
        }

        if (taskId) {
            await tasksCollection.doc(taskId).update(taskData);
            closeModal();
            showToast('Task updated successfully!');
        } else {
            taskData.completed = false;
            taskData.createdAt = new Date().toISOString();
            taskData.totalTimeLogged = 0;
            taskData.timerRunning = false;
            taskData.lastStartTime = null;

            await tasksCollection.add(taskData);
            closeModal();
            showToast('Task added successfully!');
        }
        setTimeout(() => hideLoadingOverlay(), 300);
    }

    showTaskModal(tasksCollection, taskToEdit = null) {
        const categories = this.appState.userCategories || [];
        const categoryOptions = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

        const isEditing = taskToEdit !== null;
        const modalTitle = isEditing ? "Edit Task" : "Add New Item";
        const buttonText = isEditing ? "Save Changes" : "Add Item";

        this.modalContainer.innerHTML = `
            <div id="task-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 p-4">
                <div class="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <form id="task-form">
                        <h2 class="text-xl font-bold mb-4">${modalTitle}</h2>
                        <div class="space-y-4">
                            <div>
                                <label for="task-type" class="block text-sm font-medium text-gray-300">Type</label>
                                <select id="task-type" name="type" class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500">
                                    <option value="task">Standard Task</option>
                                    <option value="project">Project</option>
                                    <option value="study_topic">Study Topic</option>
                                </select>
                            </div>
                            <div>
                                <label for="task-title" class="block text-sm font-medium text-gray-300">Title</label>
                                <input type="text" id="task-title" name="title" required class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500">
                            </div>
                            <div id="project-subtasks-container" class="hidden">
                                <label class="block text-sm font-medium text-gray-300">Sub-tasks</label>
                                <div id="subtasks-list" class="space-y-2 mt-1"></div>
                                <button type="button" id="add-subtask-btn" class="mt-2 text-sm text-cyan-400 hover:underline">+ Add sub-task</button>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="task-due-date" class="block text-sm font-medium text-gray-300">Due Date</label>
                                    <input type="date" id="task-due-date" name="dueDate" required class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500">
                                </div>
                                <div>
                                    <label for="task-priority" class="block text-sm font-medium text-gray-300">Priority</label>
                                    <select id="task-priority" name="priority" class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500">
                                        <option>High</option>
                                        <option selected>Medium</option>
                                        <option>Low</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label for="task-category" class="block text-sm font-medium text-gray-300">Category</label>
                                <select id="task-category" name="category" class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500">
                                    ${categoryOptions} 
                                </select>
                            </div>
                            <div>
                                <label for="task-url" class="block text-sm font-medium text-gray-300">Resource URL (Optional)</label>
                                <input type="url" id="task-url" name="url" class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500">
                            </div>
                            <div>
                                <label for="task-skills" class="block text-sm font-medium text-gray-300">Skills (comma-separated)</label>
                                <input type="text" id="task-skills" name="skills" placeholder="e.g., React, Python, CUDA" class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500">
                            </div>
                        </div>
                        <div class="mt-6 flex justify-end space-x-4">
                            <button type="button" id="cancel-task-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold">${buttonText}</button>                        </div>
                    </form>
                </div>
            </div>
        `;

        const taskId = isEditing ? taskToEdit.id : null;
        document.getElementById('task-form').onsubmit = (e) => this._handleFormSubmit(e, tasksCollection, taskId);
        if (isEditing) {
            document.getElementById('task-type').value = taskToEdit.type;
            document.getElementById('task-title').value = taskToEdit.title;
            document.getElementById('task-due-date').value = taskToEdit.dueDate;
            document.getElementById('task-priority').value = taskToEdit.priority;
            document.getElementById('task-category').value = taskToEdit.category;
            document.getElementById('task-url').value = taskToEdit.url || '';
            document.getElementById('task-skills').value = (taskToEdit.skills || []).join(', ');
        }
        const subtaskList = document.getElementById('subtasks-list');


        document.getElementById('cancel-task-btn').onclick = closeModal;
        
        const taskTypeSelect = document.getElementById('task-type');
        const subtasksContainer = document.getElementById('project-subtasks-container');
        taskTypeSelect.onchange = () => { subtasksContainer.classList.toggle('hidden', taskTypeSelect.value !== 'project'); };
        
        if (isEditing && taskToEdit.type === 'project' && taskToEdit.subtasks) {
            taskToEdit.subtasks.forEach(subtask => {
                const subtaskEl = this._createSubtaskInput(subtask.text, subtask.completed);
                subtaskList.appendChild(subtaskEl);
            });
        }
        // Also, make sure the container is visible if it's a project
        if (taskToEdit?.type === 'project') {
            subtasksContainer.classList.remove('hidden');
        }

        document.getElementById('add-subtask-btn').onclick = () => {
            const subtaskList = document.getElementById('subtasks-list');
            const newSubtask = document.createElement('div');
            newSubtask.className = 'flex items-center space-x-2';
            newSubtask.innerHTML = `<input type="text" class="subtask-input flex-grow bg-gray-600 border border-gray-500 rounded-md p-1 text-sm" placeholder="Sub-task description"><button type="button" class="remove-subtask-btn text-gray-400 hover:text-red-500">&times;</button>`;
            subtaskList.appendChild(newSubtask);
            newSubtask.querySelector('.remove-subtask-btn').onclick = () => newSubtask.remove();
        };
    }

    async _updateSkill(skillName, rating, skillsCollection) {
        const skillRef = skillsCollection.doc(skillName);
        return db.runTransaction(async (transaction) => {
          const skillDoc = await transaction.get(skillRef);
          if (!skillDoc.exists) {
            transaction.set(skillRef, { name: skillName, totalConfidence: rating, count: 1 });
          } else {
            const newCount = skillDoc.data().count + 1;
            const newTotalConfidence = skillDoc.data().totalConfidence + rating;
            transaction.update(skillRef, { count: newCount, totalConfidence: newTotalConfidence });
          }
        });
    }

    showSkillRatingModal(task, skillsCollection) {
        if (!task.skills || task.skills.length === 0) return;
        this.modalContainer.innerHTML = `<div id="skill-rating-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 p-4"><div class="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"><h2 class="text-xl font-bold mb-4">Rate Your Confidence</h2><p class="mb-4 text-gray-300">How confident do you feel with these skills after completing "${task.title}"?</p><div id="skills-to-rate" class="space-y-4">${task.skills.map(skill => `<div class="skill-rating-item" data-skill="${skill}"><label class="block font-medium text-gray-200">${skill}</label><div class="star-rating flex items-center space-x-1 text-2xl text-gray-500 mt-1" data-rating="0">${[1,2,3,4,5].map(i => `<svg data-value="${i}" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>`).join('')}</div></div>`).join('')}</div><div class="mt-6 flex justify-end"><button id="submit-ratings-btn" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold">Submit Ratings</button></div></div></div>`;
        
        document.querySelectorAll('.star-rating').forEach(ratingContainer => {
          const stars = ratingContainer.querySelectorAll('svg');
          ratingContainer.onmouseover = e => { if (e.target.tagName === 'svg') { const hoverValue = e.target.dataset.value; stars.forEach(star => star.classList.toggle('text-yellow-400', star.dataset.value <= hoverValue)); } };
          ratingContainer.onmouseout = () => { const currentRating = ratingContainer.dataset.rating; stars.forEach(star => star.classList.toggle('text-yellow-400', star.dataset.value <= currentRating)); };
          ratingContainer.onclick = e => { if (e.target.tagName === 'svg') { ratingContainer.dataset.rating = e.target.dataset.value; } };
        });
        document.getElementById('submit-ratings-btn').onclick = async () => {
          const ratings = Array.from(document.querySelectorAll('.skill-rating-item')).map(item => ({ skill: item.dataset.skill, rating: parseInt(item.querySelector('.star-rating').dataset.rating) }));
          const validRatings = ratings.filter(r => r.rating > 0);
          if (validRatings.length > 0) await Promise.all(validRatings.map(r => this._updateSkill(r.skill, r.rating, skillsCollection)));
          closeModal();
        };
    }

    showWeeklyReportModal = async (timeLogsCollection, tasksCollection) =>{
        const { startOfWeek, endOfWeek } = getWeekRange(new Date());
        const userProfile = this.appState.userProfile;
        if (!userProfile || !userProfile.focusAreas) {
            showToast('User profile not loaded', 'error');
            return;
        }

        // --- Render Loading Skeleton First ---
        this.modalContainer.innerHTML = `
            <div id="report-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 p-4">
                <div class="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold">Weekly Progress Report</h2>
                        <span class="text-sm text-gray-400">${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}</span>
                    </div>
                    
                    <div id="report-loading-state" class="text-center py-10">
                        <svg class="animate-spin h-8 w-8 text-cyan-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p class="mt-4 text-gray-400">Generating your report...</p>
                    </div>

                    <div id="report-content-area" class="hidden"></div>

                    <div class="flex justify-end mt-6">
                        <button id="close-report-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md">
                            Close
                        </button>
                    </div>
                </div>
            </div>`;
        
        document.getElementById('close-report-btn').onclick = closeModal;

        // --- Fetch Data in Parallel ---
        const [logsSnapshot, tasksSnapshot] = await Promise.all([
            timeLogsCollection.where('timestamp', '>=', startOfWeek).where('timestamp', '<=', endOfWeek).get(),
            tasksCollection.where('completed', '==', true).where('completedAt', '>=', startOfWeek).where('completedAt', '<=', endOfWeek).get()
        ]);

        // --- Process Data ---
        const weeklyData = {};
        userProfile.focusAreas.forEach(area => { weeklyData[area.id] = 0; });
        const dailyData = {};
        const categoryMapping = this._createCategoryMapping(userProfile.focusAreas);
        
        logsSnapshot.forEach(doc => {
            const log = doc.data();
            let catId = log.categoryId || log.category;
            
            if (catId && !weeklyData.hasOwnProperty(catId)) {
                const mappedId = categoryMapping[catId.toLowerCase()];
                if (mappedId) catId = mappedId;
            }
            
            if (catId && weeklyData.hasOwnProperty(catId)) {
                weeklyData[catId] += Number(log.duration) || 0;
            }
            
            const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
            const dayIndex = logDate.getDay();
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const day = dayNames[dayIndex];
            
            if (!dailyData[day]) dailyData[day] = 0;
            dailyData[day] += Number(log.duration) || 0;
        });

        const totalTime = Object.values(weeklyData).reduce((sum, time) => sum + time, 0);
        const completedTasks = tasksSnapshot.size;
        const avgTimePerTask = completedTasks > 0 ? Math.round(totalTime / completedTasks) : 0;
        
        const mostProductiveDay = Object.entries(dailyData).reduce((max, [day, time]) => 
            time > (max.time || 0) ? { day, time } : max, {});

        const formatPercentage = (value, total) => {
            return total > 0 ? Math.round((value / total) * 100) : 0;
        };
        // --- End Process Data ---


        // --- Build Final HTML ---
        const reportContentArea = document.getElementById('report-content-area');
        const reportLoadingState = document.getElementById('report-loading-state');
        
        reportContentArea.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-gray-700 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-cyan-400">${formatTime(totalTime)}</div>
                    <div class="text-sm text-gray-400">Total Time</div>
                </div>
                <div class="bg-gray-700 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-green-400">${completedTasks}</div>
                    <div class="text-sm text-gray-400">Tasks Completed</div>
                </div>
                <div class="bg-gray-700 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-yellow-400">${formatTime(avgTimePerTask)}</div>
                    <div class="text-sm text-gray-400">Avg per Task</div>
                </div>
                <div class="bg-gray-700 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-purple-400">${mostProductiveDay.day || 'N/A'}</div>
                    <div class="text-sm text-gray-400">Most Productive</div>
                </div>
            </div>

            <div class="space-y-3">
                ${userProfile.focusAreas.map(area => {
                    const areaTime = weeklyData[area.id] || 0;
                    const percentage = formatPercentage(areaTime, totalTime);
                    
                    return `
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <h4 class="font-medium" style="color: ${area.color}">
                                    ${area.icon} ${area.name}
                                </h4>
                                <span class="font-mono text-sm">
                                    ${formatTime(areaTime)} (${percentage}%)
                                </span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2">
                                <div class="h-2 rounded-full transition-all duration-500" 
                                    style="width: ${percentage}%; background-color: ${area.color}">
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="mb-6 bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mt-6">
                <h3 class="text-xl font-bold mb-4 text-white flex items-center gap-2">
                    <span>📊</span> Daily Activity
                </h3>
                
                <div class="flex justify-between items-end h-48 gap-3 px-4 py-3 bg-gray-950 rounded-lg">
                    ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                        const dayTime = dailyData[day] || 0;
                        const allDayValues = Object.values(dailyData).filter(v => v > 0);
                        const maxDayTime = allDayValues.length > 0 ? Math.max(...allDayValues) : 1;
                        const heightPercent = Math.round((dayTime / maxDayTime) * 100);
                        const displayHeight = dayTime > 0 ? Math.max(heightPercent, 12) : 0;
                        const today = new Date().getDay();
                        const isToday = today === index;
                        
                        return `
                            <div class="flex-1 flex flex-col items-center justify-end h-full group relative">
                                <div class="w-full rounded-t-xl transition-all duration-300 hover:scale-110 relative overflow-hidden
                                    ${dayTime > 0 
                                        ? 'bg-gradient-to-t from-cyan-600 via-cyan-500 to-cyan-400 shadow-2xl shadow-cyan-500/60 ring-2 ring-cyan-400/20' 
                                        : 'bg-gray-800 border border-gray-700'
                                    }" 
                                    style="height: ${displayHeight}%; min-height: ${dayTime > 0 ? '12px' : '4px'};">
                                    
                                    ${dayTime > 0 ? `
                                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent 
                                            -skew-x-12 group-hover:animate-shimmer"></div>
                                    ` : ''}
                                </div>
                                
                                <div class="text-center mt-3">
                                    <span class="text-sm font-bold transition-all duration-300
                                        ${isToday ? 'text-cyan-400 scale-110' : dayTime > 0 ? 'text-gray-300' : 'text-gray-600'}">
                                        ${day}
                                    </span>
                                    ${isToday ? '<div class="w-1 h-1 bg-cyan-400 rounded-full mx-auto mt-1"></div>' : ''}
                                </div>
                                
                                <div class="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 
                                    transition-opacity bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl 
                                    whitespace-nowrap z-10 border border-cyan-500/30">
                                    <div class="font-mono text-cyan-400">${formatTime(dayTime)}</div>
                                    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 
                                        w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-cyan-500/30"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="mt-4 flex justify-between items-center text-sm">
                    <div class="text-gray-400">
                        Total: <span class="text-white font-mono">${formatTime(Object.values(dailyData).reduce((a, b) => a + b, 0))}</span>
                    </div>
                    <div class="text-gray-400">
                        Average: <span class="text-white font-mono">${formatTime(Math.round(Object.values(dailyData).reduce((a, b) => a + b, 0) / 7))}</span>/day
                    </div>
                </div>
            </div>

            <div class="bg-gray-700 rounded-lg p-4 mb-6">
                <h3 class="text-lg font-semibold mb-2">Weekly Insights(Suggestion)</h3>
                <ul class="space-y-2 text-sm">
                    ${this._generateInsights(weeklyData, totalTime, completedTasks, mostProductiveDay)}
                </ul>
            </div>

            <div class="flex justify-between">
                <button onclick="exportWeeklyReport()" 
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export Report
                </button>
            </div>
        `;
        
        // --- Show Content ---
        if (reportLoadingState) reportLoadingState.classList.add('hidden');
        if (reportContentArea) reportContentArea.classList.remove('hidden');

        // Re-add the export function globally
        window.exportWeeklyReport = () => {
            showToast('Report exported successfully!');
        }

        // Animate progress bars
        setTimeout(() => {
            document.querySelectorAll('.bg-green-400, .bg-blue-400, .bg-purple-400').forEach(bar => {
                bar.style.width = bar.style.width;
            });
        }, 100);
    }

    _generateInsights(weeklyData, totalTime, completedTasks, mostProductiveDay) {
        const insights = [];
        
        const categories = Object.entries(weeklyData);
        const mostFocused = categories.reduce((max, [cat, time]) => 
            time > max.time ? { category: cat, time } : max, { time: 0 });
        
        if (mostFocused.category) {
            // Use the getCategoryName util, passing appState
            insights.push(`💡 You spent most time on <span class="font-semibold">${getCategoryName(mostFocused.category, this.appState)}</span> this week`);
        }
        
        if (completedTasks > 10) {
            insights.push(`🚀 Great productivity! You completed ${completedTasks} tasks`);
        } else if (completedTasks > 0) {
            insights.push(`📈 You completed ${completedTasks} tasks. Try to increase this next week`);
        }
        
        // This logic for balance might be flawed if one time is 0, let's protect against division by zero
        const maxTime = Math.max(...categories.map(([_, time]) => time));
        const minTime = Math.min(...categories.map(([_, time]) => time));
        const balance = maxTime > 0 ? minTime / maxTime : 0;

        if (balance > 0.5) {
            insights.push(`⚖️ Good balance across all categories`);
        } else {
            insights.push(`⚠️ Consider balancing time across categories more evenly`);
        }
        
        if (mostProductiveDay.day) {
            insights.push(`📅 ${mostProductiveDay.day} was your most productive day`);
        }
        
        return insights.map(insight => `<li>${insight}</li>`).join('');
    }
    _createSubtaskInput(text = '', completed = false) {
        const newSubtask = document.createElement('div');
        newSubtask.className = 'flex items-center space-x-2';
        newSubtask.innerHTML = `
            <input type="text" 
                class="subtask-input flex-grow bg-gray-600 border border-gray-500 rounded-md p-1 text-sm" 
                placeholder="Sub-task description" 
                value="${text}"
                data-completed="${completed}">
            <button type="button" class="remove-subtask-btn text-gray-400 hover:text-red-500">&times;</button>
        `;
        newSubtask.querySelector('.remove-subtask-btn').onclick = () => newSubtask.remove();
        return newSubtask;
    }
}