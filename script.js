import { auth, db, provider, firebase } from './js/firebase.js';
import {
    showToast,
    showUndoToast,
    playSound,
} from './js/utils.js';
import { StreakTracker } from './js/streak.js';
import { ConnectionManager } from './js/connection.js';
import { FocusMode } from './js/focus.js';
import { AchievementSystem } from './js/achievements.js';
import { UI } from './js/ui.js';
new ConnectionManager;
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✅SW registered.'))
            .catch(err => console.log('❌SW registration failed:', err));
    });
}



// =================================================================================
// SECTION 1: GLOBAL STATE & UI ELEMENTS
// =================================================================================



let appState = {
    currentView: 'dashboard',
    tasks: [],
    skills: {},
    timers: {},
    isLoading: true,
    activeFilter: 'active'
};
window.appState = appState;
window.tasksUnsubscribe = null;
let focusMode = null;
let achievementSystem = null;
let ui = null;
const mainContent = document.getElementById('main-content');
const modalContainer = document.getElementById('modal-container');
const navDashboard = document.getElementById('nav-dashboard');
const navSkills = document.getElementById('nav-skills');
const signInBtn = document.getElementById('sign-in-btn');
if (signInBtn) {
    signInBtn.onclick = () => {
        document.getElementById('auth-loader-overlay')?.classList.remove('hidden');
        auth.signInWithPopup(provider).catch(error => {
            console.warn("Sign-in popup closed or failed:", error.message);
            document.getElementById('auth-loader-overlay')?.classList.add('hidden');
        });
    };
}

// Initialize the master UI controller
ui = new UI({
    appState: appState,
    auth: auth,
    mainContent: mainContent,
    modalContainer: modalContainer
});

// We must re-create the global functions that the empty-state HTML
// and weekly report modal need to work
window.handleQuickAction = (action) => {
    const uid = auth.currentUser.uid;
    switch (action) {
        case 'addTask':
            ui.showTaskModal(db.collection('users').doc(uid).collection('tasks'));
            break;
        case 'importTasks':
            showToast("Import feature coming soon!"); // This util is still global
            break;
        case 'viewStats':
            ui.navigate('insights');
            break;
        case 'viewActive':
            appState.activeFilter = 'active';
            ui.render();
            break;
        case 'viewCompleted':
            appState.activeFilter = 'completed';
            ui.render();
            break;
    }
};

window.updateMobileUserInfo = () => {
    if (ui) {
        ui.updateMobileUserInfo();
    }
};


// ════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ════════════════════════════════════════════════════════════════
const DEFAULT_CATEGORIES = {
    icons: ['💻', '🎓', '🚀', '📋'],
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#6B7280']
};

const DEFAULT_APP_STATE = {
    currentView: 'dashboard',
    tasks: [],
    skills: {},
    timers: {},
    isLoading: false,
    userCategories: [],
    userProfile: null
};

// ════════════════════════════════════════════════════════════════
// DOM CACHE (Query once, use everywhere)
// ════════════════════════════════════════════════════════════════
const DOM = {
    get authLoader() { return document.getElementById('auth-loader-overlay'); },
    get onboardingModal() { return document.getElementById('onboarding-modal'); },
    get onboardingForm() { return document.getElementById('onboarding-form'); },
    get userInfo() { return document.getElementById('user-info'); },
    get userPic() { return document.getElementById('user-pic'); },
    get userName() { return document.getElementById('user-name'); },
    get signInBtn() { return document.getElementById('sign-in-btn'); },
    get addTaskBtn() { return document.getElementById('add-task-btn'); },
    get mainContent() { return document.getElementById('main-content'); },

    getCategoryInputs() {
        return [
            document.getElementById('category1'),
            document.getElementById('category2'),
            document.getElementById('category3')
        ];
    }
};

// ════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

/**
 * Shows/hides the loading overlay
 */
function setAuthLoading(isLoading) {
    DOM.authLoader?.classList.toggle('hidden', !isLoading);
}

/**
 * Creates focus area objects from user input
 */
function createFocusAreas(categoryNames) {
    return categoryNames
        .map(name => name.trim())
        .filter(name => name !== '')
        .map((name, index) => ({
            id: `focus_${Date.now()}_${index}`,
            name: name,
            icon: DEFAULT_CATEGORIES.icons[index] || '📋',
            color: DEFAULT_CATEGORIES.colors[index] || '#6B7280',
            order: index + 1,
            createdAt: new Date().toISOString()
        }));
}

/**
 * Updates UI to show user information
 */
function displayUserInfo(user) {
    if (DOM.userPic) {
        DOM.userPic.src = user.photoURL || 'assets/default-avatar.png';
        DOM.userPic.alt = `${user.displayName}'s avatar`;
    }
    if (DOM.userName) {
        DOM.userName.textContent = user.displayName || user.email?.split('@')[0] || 'User';
    }
}

/**
 * Shows the welcome screen for logged-out users
 */
function showLoggedOutScreen() {
    if (DOM.mainContent) {
        DOM.mainContent.innerHTML = `
            <div class="text-center p-8 bg-gray-800 rounded-lg max-w-md mx-auto mt-20">
                <div class="text-6xl mb-4">👋</div>
                <h2 class="text-2xl font-bold text-cyan-400 mb-2">
                    Welcome to Level Up Hub
                </h2>
                <p class="text-gray-300 mb-6">
                    Transform your tasks into achievements. Level up your productivity!
                </p>
                <button 
                    id="welcome-sign-in-btn"
                    class="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                    🚀 Sign in with Google
                </button>
            </div>
        `;

        document.getElementById('welcome-sign-in-btn').onclick = () => {
            const loader = document.getElementById('auth-loader-overlay');
            if (loader) loader.classList.remove('hidden');

            auth.signInWithPopup(provider).catch(error => {
                console.warn("Sign-in popup closed or failed:", error.message);
                if (loader) loader.classList.add('hidden');
            });
        };
    }
}


// Clears all active timers

function clearAllTimers() {
    if (appState?.timers) {
        Object.values(appState.timers).forEach(timerId => {
            clearInterval(timerId);
            clearTimeout(timerId);
        });
    }
}


// Triggers celebration confetti

function celebrate() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#3B82F6', '#10B981', '#F59E0B', '#EC4899']
        });
    }
}

// ════════════════════════════════════════════════════════════════
// ONBOARDING HANDLER 
// ════════════════════════════════════════════════════════════════
class OnboardingManager {
    constructor() {
        this.abortController = null;
    }

    reset() {
        const inputs = DOM.getCategoryInputs();
        inputs.forEach(input => {
            if (input) input.value = '';
        });
        const submitBtn = DOM.onboardingForm?.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Get Started 🚀';
            submitBtn.disabled = false;
        }
    }

    show() {
        setAuthLoading(false);
        this.reset(); // ✅ Clear previous state
        DOM.onboardingModal?.classList.remove('hidden');
        this.attachFormHandler();
    }

    hide() {
        DOM.onboardingModal?.classList.add('hidden');
        this.cleanup();
    }

    cleanup() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    attachFormHandler() {
        // Cleanup previous listeners
        this.cleanup();
        this.abortController = new AbortController();

        const form = DOM.onboardingForm;
        if (!form) return;

        form.addEventListener('submit', (e) => this.handleSubmit(e), {
            signal: this.abortController.signal
        });
    }

    async handleSubmit(e) {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            // UI: Show loading state
            submitBtn.textContent = 'Setting up...';
            submitBtn.disabled = true;

            // Get category values
            const categoryInputs = DOM.getCategoryInputs();
            const categoryNames = categoryInputs.map(input => input?.value || '');
            const focusAreas = createFocusAreas(categoryNames);

            // Validate
            if (focusAreas.length === 0) {
                throw new Error('Please enter at least one focus area');
            }

            // Get current user
            const user = auth.currentUser;
            if (!user) {
                throw new Error('No authenticated user found');
            }

            // Create user profile
            const userProfile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                onboarded: true,
                focusAreas: focusAreas,
                dailyGoal: 3,
                settings: {
                    notifications: true,
                    theme: 'dark',
                    soundEnabled: true
                }
            };

            // Save to Firestore
            await db.collection('users').doc(user.uid).set(userProfile);
            console.log('✅ User profile created:', user.uid);

            // Success!
            this.hide();
            celebrate();
            showToast('🎉 Welcome to Level Up Hub!', 'success');

            // Initialize app
            ui.updateNavigationVisibility(true);
            displayUserInfo(user);
            initializeAppForUser(user, userProfile);

        } catch (error) {
            console.error('❌ Onboarding error:', error);
            showToast(error.message || 'Failed to save preferences', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
}

const onboarding = new OnboardingManager();

// ════════════════════════════════════════════════════════════════
// USER PROFILE LOADER
// ════════════════════════════════════════════════════════════════
async function loadUserProfile(user) {
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        return { exists: false, needsOnboarding: true };
    }

    const data = userDoc.data();

    return {
        exists: true,
        needsOnboarding: !data.onboarded || !data.focusAreas?.length,
        profile: {
            ...data,
            focusAreas: data.focusAreas || [],
            dailyGoal: data.dailyGoal || 3,
            settings: data.settings || {}
        }
    };
}

// ════════════════════════════════════════════════════════════════
// MAIN AUTH STATE HANDLER
// ════════════════════════════════════════════════════════════════
let authStateProcessing = false;

auth.onAuthStateChanged(async (user) => {
    // Prevent race conditions from rapid auth changes
    if (authStateProcessing) {
        console.log('⏳ Auth state change already processing...');
        return;
    }

    authStateProcessing = true;

    try {
        if (user) {
            await handleUserSignedIn(user);
        } else {
            handleUserSignedOut();
        }
    } catch (error) {
        console.error('❌ Auth state error:', error);
        showToast('Authentication error. Please refresh.', 'error');
        setAuthLoading(false);
    } finally {
        authStateProcessing = false;
        document.body.classList.add('auth-ready');
    }
});

// ────────────────────────────────────────────────────────────────
// Handler: User Signed In
// ────────────────────────────────────────────────────────────────
async function handleUserSignedIn(user) {
    console.log('✅ User authenticated:', user.email);
    setAuthLoading(true);

    try {
        const { exists, needsOnboarding, profile } = await loadUserProfile(user);

        if (needsOnboarding) {
            // ══════════════════════════════════════════
            // NEW USER → Show Onboarding
            // ══════════════════════════════════════════
            console.log('🆕 New user detected - showing onboarding');
            onboarding.show();
            return;
        }

        // ══════════════════════════════════════════════
        // EXISTING USER → Load App
        // ══════════════════════════════════════════════
        console.log('✅ Existing user - loading profile');

        setAuthLoading(false);
        ui.updateNavigationVisibility(true);
        displayUserInfo(user);

        // Update mobile UI if available
        window.updateMobileUserInfo?.();

        // Initialize the main application
        initializeAppForUser(user, profile);

    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        setAuthLoading(false);

        // Decide: show onboarding or error?
        if (error.code === 'permission-denied') {
            showToast('Access denied. Please sign in again.', 'error');
            auth.signOut();
        } else {
            showToast('Failed to load profile. Please refresh.', 'error');
        }
    }
}

// ────────────────────────────────────────────────────────────────
// Handler: User Signed Out
// ────────────────────────────────────────────────────────────────
function handleUserSignedOut() {
    console.log('🔓 User logged out');

    // Cleanup
    clearAllTimers();
    if (onboarding) onboarding.cleanup();

    // ✅Mutate the existing object instead of replacing it
    // This keeps the reference inside 'ui' alive and correct
    appState.currentView = 'dashboard';
    appState.tasks = [];
    appState.skills = {};
    appState.timers = {};
    appState.isLoading = false;
    appState.userCategories = [];
    appState.userProfile = null;
    appState.activeFilter = 'active';

    // Update UI
    setAuthLoading(false);
    ui.updateNavigationVisibility(false);
    showLoggedOutScreen();
}

// =================================================================================
// SECTION 4: APP INITIALIZATION & DATA LISTENERS
// =================================================================================


async function initializeAppForUser(user, userProfile) {
    // Store user's custom categories and profile in the global app state
    appState.userCategories = userProfile.focusAreas;
    appState.userProfile = userProfile;
    // Set up the real-time data listeners
    const tasksCollection = db.collection('users').doc(user.uid).collection('tasks');
    const skillsCollection = db.collection('users').doc(user.uid).collection('skills');
    attachDataListeners(tasksCollection, skillsCollection);
    // Initialize all helper classes
    const streakTracker = new StreakTracker(user.uid);
    achievementSystem = new AchievementSystem({ db, uid: user.uid, confetti, tasksCollection, streakTracker, mainContent: mainContent });
    focusMode = new FocusMode({ db, uid: user.uid, confetti, tasksCollection, appState: appState });
    // Set up the real-time UI listener for the streak display
    streakTracker.streakRef.onSnapshot(doc => {
        const streakData = doc.data();
        const effectiveStreak = streakTracker.getEffectiveStreak(streakData);

        const streakDisplay = document.getElementById('streak-display');
        const streakCount = document.getElementById('streak-count');

        if (effectiveStreak > 0) {
            streakCount.textContent = effectiveStreak;
            streakDisplay.classList.remove('hidden');
            streakDisplay.classList.add('flex');
        } else {
            streakDisplay.classList.add('hidden');
        }

        if (window.updateMobileUserInfo) {
            window.updateMobileUserInfo();
        }
    });
    // Set up the logic for the user profile dropdown menu
    const userMenuButton = document.getElementById('user-menu-button');
    const userMenu = document.getElementById('user-menu');
    userMenuButton.addEventListener('click', () => userMenu.classList.toggle('hidden'));
    window.addEventListener('click', (event) => {
        if (!userMenu.classList.contains('hidden') && !userMenuButton.contains(event.target) && !userMenu.contains(event.target)) {
            userMenu.classList.add('hidden');
        }
    });
    // Attach all main event handlers for the app's buttons
    document.getElementById('sign-out-btn').onclick = () => auth.signOut();
    document.getElementById('achievements-btn').onclick = () => {
        userMenu.classList.add('hidden');
        achievementSystem.renderAchievementsPage();
    };
    const toggleTasksBtn = document.getElementById('toggle-tasks-btn');
    toggleTasksBtn.onclick = () => {
        userMenu.classList.add('hidden'); // Close the menu
        if (appState.activeFilter === 'active') {
            appState.activeFilter = 'completed';
            // Update button text (we need to get the text node)
            toggleTasksBtn.lastChild.nodeValue = ' Show Active Tasks';
        } else {
            appState.activeFilter = 'active';
            toggleTasksBtn.lastChild.nodeValue = ' Show Completed Tasks';
        }

        // Indicate loading state
        appState.isLoading = true;
        ui.render();

        // Fetch new optimized data set
        listenToTasks(tasksCollection, appState.activeFilter);
    };
    document.getElementById('add-task-btn').onclick = () => ui.showTaskModal(tasksCollection);
    document.getElementById('report-btn').onclick = () => ui.showWeeklyReportModal(db.collection('users').doc(user.uid).collection('timeLogs'), tasksCollection);
    document.getElementById('home-link').onclick = (e) => { e.preventDefault(); ui.navigate('dashboard'); };
    mainContent.onclick = (e) => handleMainContentClick(e, tasksCollection, skillsCollection, db.collection('users').doc(user.uid).collection('timeLogs'));
    navDashboard.onclick = () => ui.navigate('dashboard');
    navSkills.onclick = () => ui.navigate('skills');
    document.getElementById('nav-insights').onclick = () => ui.navigate('insights');
    // Perform initial setup
    ui.navigate('dashboard');
    ui.add3DTiltEffect();

}
function attachDataListeners(tasksCollection, skillsCollection) {
    // Mount the initial active tasks listener
    listenToTasks(tasksCollection, 'active');

    skillsCollection.onSnapshot(snapshot => {
        appState.skills = {};
        snapshot.docs.forEach(doc => { appState.skills[doc.id] = { id: doc.id, ...doc.data() }; });
        if (appState.currentView === 'skills') ui.render();
    });
}

function listenToTasks(tasksCollection, filterMode) {
    // 1. Unsubscribe from any previous listener to prevent memory leaks / duplicate data
    if (window.tasksUnsubscribe) {
        window.tasksUnsubscribe();
    }

    // 2. Build the query based on the active filter
    let query = tasksCollection;
    if (filterMode === 'active') {
        query = query.where('completed', '==', false);
    } else {
        query = query.where('completed', '==', true).limit(10);
    }

    // 3. Attach the new listener
    window.tasksUnsubscribe = query.onSnapshot(snapshot => {
        // Map new data but PROTECT our optimistic updates
        appState.tasks = snapshot.docs.map(doc => {
            const serverData = doc.data();
            const localTask = appState.tasks.find(t => t.id === doc.id);

            if (localTask && (localTask.totalTimeLogged || 0) > (serverData.totalTimeLogged || 0)) {
                serverData.totalTimeLogged = localTask.totalTimeLogged;
            }

            return { id: doc.id, ...serverData };
        });

        if (appState.isLoading) {
            appState.isLoading = false;
        }
        const loader = document.getElementById('auth-loader-overlay');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
        ui.render();
    }, (error) => {
        console.error("Firebase Tasks Query Error:", error);
        appState.isLoading = false;
        ui.render();
        if (typeof showToast === 'function') {
            showToast("Error loading tasks: " + error.message, 'error');
        }
    });
}




// =================================================================================
// SECTION 6: EVENT HANDLERS
// =================================================================================



async function handleMainContentClick(e, tasksCollection, skillsCollection, timeLogsCollection) {
    const quickActionBtn = e.target.closest('.quick-action-btn');
    if (quickActionBtn) {
        const action = quickActionBtn.dataset.quickAction;
        if (action && typeof window.handleQuickAction === 'function') {
            window.handleQuickAction(action);
        }
        return;
    }

    const card = e.target.closest('.task-card');
    if (!card) return;
    const taskId = card.dataset.id;
    const task = appState.tasks.find(t => t.id === taskId);
    if (!task) return;
    // ✅ CHECKBOX - Task Completion
    if (e.target.matches('.task-checkbox')) {
        const isCompleted = e.target.checked;
        try {
            if (isCompleted) {
                // Success notification
                if (typeof showToast === 'function') {
                    showToast('Task completed! 🎉', 'success');
                }
                // Initialize updates object
                const updates = {
                    completed: true,
                    completedAt: new Date()
                };
                // ✨ AUTO-STOP TIMER ON COMPLETION
                if (task.timerRunning && task.lastStartTime) {
                    console.log("⏹️ Task completed with timer running. Stopping timer now.");
                    // Calculate the final duration
                    const lastStart = task.lastStartTime.toDate ?
                        task.lastStartTime.toDate() :
                        new Date(task.lastStartTime);
                    const duration = Math.round((new Date() - lastStart) / 1000);
                    // Add timer stop updates
                    updates.totalTimeLogged = (task.totalTimeLogged || 0) + duration;
                    updates.timerRunning = false;
                    updates.lastStartTime = null;
                    // Create the final time log entry
                    await timeLogsCollection.add({
                        taskId: taskId,
                        duration: duration,
                        category: task.category,
                        timestamp: new Date(),
                        userId: auth.currentUser.uid,
                        completionStop: true
                    });
                    console.log(`✅ Timer stopped. Duration: ${duration}s. Total: ${updates.totalTimeLogged}s`);
                }
                // 🔥 Update with ALL changes 
                await tasksCollection.doc(taskId).update(updates);
                // Update local task object
                Object.assign(task, updates);
                // Update streak
                const streakTracker = new StreakTracker(auth.currentUser.uid);
                const streakResult = await streakTracker.updateStreak();
                console.log('Streak update result:', streakResult);
                // Check achievements — compute live stats from real data
                const streakStats = await streakTracker.getStreakStats();
                const completedTasksSnap = await tasksCollection
                    .where('completed', '==', true)
                    .get();

                // Build tasksByCategory from actual completed tasks
                const tasksByCategory = {};
                completedTasksSnap.forEach(doc => {
                    const cat = doc.data().category || 'general';
                    tasksByCategory[cat] = (tasksByCategory[cat] || 0) + 1;
                });

                // Build hoursByCategory from actual time logs (timeLogs store duration in SECONDS)
                const timeLogsSnap = await db.collection('users').doc(auth.currentUser.uid)
                    .collection('timeLogs').get();
                const hoursByCategory = {};
                timeLogsSnap.forEach(doc => {
                    const log = doc.data();
                    const cat = log.category || 'general';
                    const durationSeconds = Number(log.duration) || 0;
                    hoursByCategory[cat] = (hoursByCategory[cat] || 0) + (durationSeconds / 3600); // Convert seconds to hours
                });

                // Check if today is a weekend for weekend achievement
                const today = new Date();
                const isWeekend = today.getDay() === 0 || today.getDay() === 6;
                let weekendTasks = 0;
                if (isWeekend) {
                    completedTasksSnap.forEach(doc => {
                        const d = doc.data().completedAt;
                        if (!d) return;
                        const completedDate = d.toDate ? d.toDate() : new Date(d);
                        const day = completedDate.getDay();
                        if (day === 0 || day === 6) weekendTasks++;
                    });
                }

                const liveStats = {
                    tasksCompleted: completedTasksSnap.size,
                    streak: streakStats.currentStreak || 0,
                    tasksByCategory,
                    hoursByCategory,
                    weekendTasks
                };

                console.log('📊 Achievement stats (live):', liveStats);

                await achievementSystem.checkAchievements('task_complete', {
                    stats: liveStats,
                    taskTime: new Date()
                });
                await achievementSystem.checkAchievements('streak_update', {
                    stats: liveStats
                });
                // Show skill rating modal
                ui.showSkillRatingModal(task, skillsCollection);
            } else {
                if (typeof showToast === 'function') {
                    showToast('Task reopened', 'success');
                }
                // ✅ UNCOMPLETE - Reopening task
                await tasksCollection.doc(taskId).update({
                    completed: false,
                    completedAt: null
                });
                // Update local task object
                task.completed = false;
                task.completedAt = null;
            }
            // Refresh UI
            ui.render();
        } catch (error) {
            console.error('❌ Error updating task:', error);
            // Revert checkbox state on error
            e.target.checked = !isCompleted;
            if (typeof showToast === 'function') {
                showToast('Failed to update task. Please try again.', 'error');
            }
        }
        return; // Stop here
    }
    // ✅ SUBTASK COMPLETION - With Confetti
    if (e.target.matches('[data-subtask-index]')) {
        if (task.completed) {
            e.preventDefault(); // Prevents the checkbox from toggling visually
            return;
        }
        try {
            const index = parseInt(e.target.dataset.subtaskIndex);
            // Mark the subtask as completed in local state
            task.subtasks[index].completed = e.target.checked;
            // Check if ALL subtasks are now complete
            const allSubtasksCompleted = task.subtasks.every(st => st.completed);
            if (allSubtasksCompleted && typeof confetti === 'function') {
                console.log("🎉 Project complete! Firing confetti!");
                ui.confetti({
                    particleCount: 150,
                    spread: 90,
                    origin: { y: 0.6 }
                });
            }
            // Save updated subtasks to Firestore
            await tasksCollection.doc(taskId).update({
                subtasks: task.subtasks
            });
            // Refresh UI
            ui.render();
        } catch (error) {
            console.error('❌ Error updating subtask:', error);
            e.target.checked = !e.target.checked; // Revert
        }
        return;
    }

    // ✅ EDIT BUTTON - Open modal with task data
    if (e.target.closest('.edit-btn')) {
        // We pass the full task object to the modal function
        ui.showTaskModal(tasksCollection, task);
        return;
    }

    // ✅ DELETE BUTTON 
    if (e.target.closest('.delete-btn')) {
        playSound('assets/delete.mp3');
        // Find the task and its index in local data array
        const taskIndex = appState.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;
        // Store the task object before removing it
        const removedTask = appState.tasks[taskIndex];
        // 1. Immediately remove from local state
        appState.tasks.splice(taskIndex, 1);
        // 2. Immediately re-render (card disappears instantly)
        ui.render();
        if (typeof updateStats === 'function') updateStats();
        // 3. Set up delayed permanent deletion
        const deletionTimeout = setTimeout(() => {
            tasksCollection.doc(taskId).delete().catch(err => {
                console.error("❌ Error during final deletion:", err);
                // If deletion fails, restore the task
                appState.tasks.splice(taskIndex, 0, removedTask);
                ui.render();
                if (typeof updateStats === 'function') updateStats();
                showToast("Error: Could not delete task.");
            });
        }, 7000); // 7 seconds to undo
        // 4. Show toast with smart UNDO function
        showUndoToast("Task deleted.", () => {
            // UNDO LOGIC
            clearTimeout(deletionTimeout); // Cancel permanent deletion                    
            // Restore task to original position
            appState.tasks.splice(taskIndex, 0, removedTask);
            // Re-render to show the card again
            ui.render();
            if (typeof updateStats === 'function') updateStats();
            console.log("✅ Task deletion undone");
        });
        return;
    }
    // ✅ TIMER BUTTON - Start/Stop
    else if (e.target.closest('.timer-btn')) {
        try {
            if (task.completed) {
                showToast("Cannot start a timer on a completed task.");
                return;
            }

            const isRunning = !task.timerRunning; // Toggle status
            const updates = { timerRunning: isRunning };

            if (isRunning) {
                // --- START TIMER ---
                updates.lastStartTime = firebase.firestore.FieldValue.serverTimestamp();
                // Locally update Date so UI starts ticking immediately
                task.lastStartTime = new Date();
                console.log("⏱️ Timer started for task:", task.title);
            } else if (task.lastStartTime) {
                // --- STOP TIMER ---
                const lastStart = task.lastStartTime.toDate ?
                    task.lastStartTime.toDate() :
                    new Date(task.lastStartTime);
                const duration = Math.round((new Date() - lastStart) / 1000);

                // 1. Database: Atomic Increment
                updates.totalTimeLogged = firebase.firestore.FieldValue.increment(duration);
                updates.lastStartTime = null;

                // 2. Time Log
                await timeLogsCollection.add({
                    taskId: taskId,
                    duration: duration,
                    category: task.category,
                    timestamp: new Date(),
                    userId: auth.currentUser.uid
                });
                task.totalTimeLogged = (task.totalTimeLogged || 0) + duration;
                task.lastStartTime = null;

                console.log(`⏹️ Timer stopped. Duration: ${duration}s. New Total: ${task.totalTimeLogged}`);
            }

            // Update Firestore
            await tasksCollection.doc(taskId).update(updates);

            // Update Local Object Safely (Remove sentinels before merging)
            const localUpdates = { ...updates };
            delete localUpdates.totalTimeLogged;
            delete localUpdates.lastStartTime;

            Object.assign(task, localUpdates);
            ui.render();

        } catch (error) {
            console.error('❌ Error updating timer:', error);
            showToast('Failed to update timer', 'error');
        }
        return;
    }

    // ✅ FOCUS BUTTON
    if (e.target.closest('.focus-btn')) {
        if (focusMode && !task.completed) {
            focusMode.open(task);
        }
        else if (task.completed) {
            showToast("Cannot start a focus session on a completed task.");
            return;
        }
    }
}

document.addEventListener('task-time-updated', (e) => {
    console.log('📨 Received task-time-updated event:', e.detail);
    const { taskId, addedSeconds, newTotal, markComplete } = e.detail;

    const updateLocalState = () => {
        if (!appState.tasks) {
            console.log('❌ appState.tasks not available');
            return false;
        }

        const task = appState.tasks.find(t => t.id === taskId);
        console.log('📍 Found task in appState:', task);

        if (task) {
            const oldTotal = task.totalTimeLogged || 0;
            if (newTotal !== undefined) {
                task.totalTimeLogged = newTotal;
            } else {
                task.totalTimeLogged = oldTotal + addedSeconds;
            }

            console.log(`✅ Updated: ${oldTotal}s → ${task.totalTimeLogged}s`);

            if (markComplete) {
                task.completed = true;
            }

            ui.render();
            return true;
        }
        console.log('❌ Task not found in appState');
        return false;
    };
    // Try immediately
    if (!updateLocalState()) {
        console.log("⚠️ Task not found in state yet. Retrying...");
        // Retry after 500ms
        setTimeout(() => {
            if (!updateLocalState()) {
                // Final retry after 1.5 seconds
                setTimeout(updateLocalState, 1000);
            }
        }, 500);
    }
});
// ✅ KEYBOARD SHORTCUTS
document.addEventListener('keydown', (e) => {
    const activeElement = document.activeElement;
    const isTyping = activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable;

    // Allow Escape even when typing
    if (isTyping && e.key !== 'Escape') return;

    // 1. Shift + N = Add New Task
    if (e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        window.handleQuickAction?.('addTask');
        return;
    }

    // 2. Escape = Smart Close (Priority-based)
    if (e.key === 'Escape') {
        handleEscapeKey();
        return;
    }

    // 3. Navigation Shortcuts (Shift + Key)
    if (e.shiftKey && !e.ctrlKey && !e.altKey) {
        handleNavigationShortcuts(e);
    }
});

// ✅ Extracted for cleaner main handler
function handleEscapeKey() {
    // Priority 1: Focus Mode - Protected
    const focusOverlay = document.getElementById('focusMode');
    if (focusOverlay && !focusOverlay.classList.contains('hidden')) {
        console.log('🎯 Focus mode active - use button to exit');
        return;
    }

    // Priority 2: Modals
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer && modalContainer.innerHTML.trim() !== '') {
        ui?.closeModal?.() ?? (modalContainer.innerHTML = '');
        return;
    }

    // Priority 3: Dropdowns & Menus
    closeAllDropdowns();
}

// ✅ Navigation shortcuts handler
function handleNavigationShortcuts(e) {
    const shortcuts = {
        'd': 'dashboard',
        's': 'skills',
        'i': 'insights',
    };

    const page = shortcuts[e.key.toLowerCase()];
    if (page) {
        e.preventDefault();
        ui?.navigate?.(page);
    }
}

// ✅ Dropdown closer
function closeAllDropdowns() {
    // User Menu
    document.getElementById('user-menu')?.classList.add('hidden');

    // Mobile Menu (trigger close button for animations)
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        document.getElementById('mobile-menu-close')?.click();
    }

    // Generic: Close any other open dropdowns
    document.querySelectorAll('[data-dropdown].open')
        .forEach(el => el.classList.add('hidden'));
}