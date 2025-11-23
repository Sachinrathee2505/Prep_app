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
    switch(action) {
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



// =================================================================================
// SECTION 2: CORE AUTH LOGIC (THE APP'S BRAIN)
// =================================================================================



auth.onAuthStateChanged(async (user) => {         
    if (user) {
        // ========================================
        // USER IS LOGGED IN
        // ========================================
        console.log('✅ User authenticated:', user.email);
        try {
            // Reference to user profile document
            const userProfileRef = db.collection('users').doc(user.uid);
            const userDoc = await userProfileRef.get();
            if (!userDoc.exists || !userDoc.data().onboarded) {
                // ========================================
                // SCENARIO 1: NEW USER (No profile found)
                // ========================================
                console.log('🆕 New user detected - showing onboarding');
                document.getElementById('auth-loader-overlay')?.classList.add('hidden');
                const onboardingModal = document.getElementById('onboarding-modal');
                onboardingModal.classList.remove('hidden');
                // Setup onboarding form submission (only once)
                const onboardingForm = document.getElementById('onboarding-form');                           
                // Remove any existing listeners to prevent duplicates
                const newForm = onboardingForm.cloneNode(true);
                onboardingForm.parentNode.replaceChild(newForm, onboardingForm);
                newForm.addEventListener('submit', async (e) => {
                    e.preventDefault();                                
                    const submitButton = newForm.querySelector('button[type="submit"]');
                    submitButton.textContent = 'Setting up...';
                    submitButton.disabled = true;
                    try {
                        // Get category names from form
                        const categoryNames = [
                            document.getElementById('category1').value.trim(),
                            document.getElementById('category2').value.trim(),
                            document.getElementById('category3').value.trim()
                        ];
                        // Create category objects with icons and colors
                        const focusAreas = categoryNames
                            .filter(name => name !== '') // Remove empty entries
                            .map((name, index) => ({
                                id: `focus_${index + 1}`,
                                name: name,
                                icon: ['💻', '🎓', '🚀'][index] || '📋',
                                color: ['#3B82F6', '#10B981', '#F59E0B'][index] || '#6B7280',
                                order: index + 1
                            }));
                        // Validate at least one category
                        if (focusAreas.length === 0) {
                            showToast('Please enter at least one focus area', 'error');
                            submitButton.textContent = 'Get Started 🚀';
                            submitButton.disabled = false;
                            return;
                        }
                        // Save user profile to Firestore
                        await userProfileRef.set({
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
                                theme: 'dark'
                            }
                        });
                        console.log('✅ User profile created:', focusAreas);
                        ui.updateNavigationVisibility(true);
                        // Hide modal
                        onboardingModal.classList.add('hidden');
                        // Show celebration
                        if (typeof confetti === 'function') {
                            confetti({
                                particleCount: 150,
                                spread: 80,
                                origin: { y: 0.6 }
                            });
                        }
                        showToast('🎉 Welcome to Level Up Hub!', 'success');
                        // Initialize app with new profile
                        const userProfile = {
                            focusAreas,
                            dailyGoal: 3,
                            onboarded: true
                        };
                        initializeAppForUser(user, userProfile);
                    } catch (error) {
                        console.error('❌ Error saving onboarding data:', error);
                        showToast('Failed to save preferences. Please try again.', 'error');
                        submitButton.textContent = 'Get Started 🚀';
                        submitButton.disabled = false;
                    }
                });
            } else {
                // ========================================
                // SCENARIO 2: EXISTING USER (Profile exists)
                // ========================================
                console.log('✅ Existing user - loading profile');
                const userData = userDoc.data();
                const focusAreas = userData.focusAreas || [];
                // Validate profile data
                if (!focusAreas || focusAreas.length === 0) {
                    console.warn('⚠️ User has no focus areas - showing onboarding');
                    document.getElementById('onboarding-modal').classList.remove('hidden');
                    return;
                }
                ui.updateNavigationVisibility(true);
                if (window.updateMobileUserInfo) {
                    window.updateMobileUserInfo();
                }
                // Show user info in header
                const userInfo = document.getElementById('user-info');
                const signInBtn = document.getElementById('sign-in-btn');
                const addTaskBtn = document.getElementById('add-task-btn');
                const navButtons = document.getElementById('nav-buttons');
                // Update user display
                const userPic = document.getElementById('user-pic');
                const userName = document.getElementById('user-name');
                if (userPic) userPic.src = user.photoURL || 'assets/default-avatar.png';
                if (userName) userName.textContent = user.displayName || user.email.split('@')[0];
                // Initialize app with user profile
                const userProfile = {
                    focusAreas: focusAreas,
                    dailyGoal: userData.dailyGoal || 3,
                    onboarded: true,
                    settings: userData.settings || {}
                };
                initializeAppForUser(user, userProfile);
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            showToast('Failed to load profile. Please refresh the page.', 'error');
            document.getElementById('auth-loader-overlay')?.classList.add('hidden');
        }
    } else {
        // ========================================
        // USER IS LOGGED OUT
        // ========================================
        console.log('🔓 User logged out');              
        ui.updateNavigationVisibility(false);
        document.getElementById('auth-loader-overlay')?.classList.add('hidden');
        // Reset app state
        appState = { 
            currentView: 'dashboard', 
            tasks: [], 
            skills: {}, 
            timers: {}, 
            isLoading: false,
            userCategories: [],
            userProfile: null
        };
        // Clear any running timers
        Object.values(appState.timers).forEach(clearInterval);
        // Show logged out message
        if (mainContent) {
            ui.mainContent.innerHTML = `
                <div class="text-center p-8 bg-gray-800 rounded-lg">
                    <div class="text-6xl mb-4">👋</div>
                    <h2 class="text-2xl font-bold text-cyan-400 mb-2">Welcome to Level Up Hub</h2>
                    <p class="text-gray-300">Please sign in with Google to continue.</p>
                </div>
            `;
        }
    }
    document.body.classList.add('auth-ready');
});


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
        const streakData = doc.data() || { current: 0 };
        const streakDisplay = document.getElementById('streak-display');
        const streakCount = document.getElementById('streak-count');
        if (streakData.current > 0) {
            streakCount.textContent = streakData.current;
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
        ui.render(); // Re-render the dashboard
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
    tasksCollection.onSnapshot(snapshot => {
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
    });

    skillsCollection.onSnapshot(snapshot => {
        appState.skills = {};
        snapshot.docs.forEach(doc => { appState.skills[doc.id] = { id: doc.id, ...doc.data() }; });
        if (appState.currentView === 'skills') ui.render();
    });
}




// =================================================================================
// SECTION 6: EVENT HANDLERS
// =================================================================================



async function handleMainContentClick(e, tasksCollection, skillsCollection, timeLogsCollection) {
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
                // Check achievements
                const stats = await streakTracker.getStreakStats();
                const completedTasksSnap = await tasksCollection
                    .where('completed', '==', true)
                    .get();
                await achievementSystem.checkAchievements('task_complete', { 
                    totalCompleted: completedTasksSnap.size,
                    category: task.category 
                });
                await achievementSystem.checkAchievements('streak_update', { 
                    streak: stats.currentStreak 
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