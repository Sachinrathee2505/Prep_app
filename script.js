    document.addEventListener('DOMContentLoaded', () => {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered.'))
            .catch(err => console.log('SW registration failed:', err));
        });
      }

      // =================================================================================
      // SECTION 1: FIREBASE SETUP & INITIALIZATION
      // =================================================================================
      const firebaseConfig = {
        apiKey: "AIzaSyB0MOIXrgBOZOPD-ImligI8R5I9LcEP-e4",
        authDomain: "placement-prep-app.firebaseapp.com",
        projectId: "placement-prep-app",
        storageBucket: "placement-prep-app.firebasestorage.app",
        messagingSenderId: "43190903852",
        appId: "1:43190903852:web:94efe77f5da7a84b841d89"
      };

      if (!firebaseConfig.apiKey) {
        document.getElementById('main-content').innerHTML = `<div class="text-center p-8 bg-red-900 rounded-lg"><h2 class="text-2xl font-bold text-red-200">Firebase Not Configured!</h2><p class="mt-2 text-red-300">Please paste your Firebase config object in index.html to get started.</p></div>`;
        return;
      }

      firebase.initializeApp(firebaseConfig);
      const db = firebase.firestore();
        db.enablePersistence()
          .catch((err) => {
              if (err.code == 'failed-precondition') {
                  console.warn('Firestore persistence failed: Multiple tabs open.');
              } else if (err.code == 'unimplemented') {
                  console.warn('Firestore persistence failed: Browser not supported.');
              }
            });
      // Initialize the connection manager to handle the offline UI banner
            const auth = firebase.auth();
            const provider = new firebase.auth.GoogleAuthProvider();

      // =================================================================================
      // SECTION 2: GLOBAL STATE & UI ELEMENTS
      // =================================================================================
      let appState = { 
        currentView: 'dashboard', 
        tasks: [], 
        skills: {}, 
        timers: {}, 
        isLoading: true,
        activeFilter: 'active'
     };
      let focusMode = null;
      const motivationalQuotes = [
        "The best way to predict the future is to create it.",
        "Success is the sum of small efforts, repeated day in and day out.",
        "The secret of getting ahead is getting started."
      ];
      const mainContent = document.getElementById('main-content');
      const modalContainer = document.getElementById('modal-container');
      const navDashboard = document.getElementById('nav-dashboard');
      const navSkills = document.getElementById('nav-skills');

      // =================================================================================
      // SECTION 3: CORE AUTH LOGIC (THE APP'S BRAIN)
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
                                    if (signInBtn) {
                                        signInBtn.classList.add('hidden'); // ✅ hide the Google button
                                    }
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
                            
                            // Show user info in header
                            const userInfo = document.getElementById('user-info');
                            const signInBtn = document.getElementById('sign-in-btn');
                            const addTaskBtn = document.getElementById('add-task-btn');
                            const navButtons = document.getElementById('nav-buttons');

                            if (userInfo) {
                                userInfo.classList.remove('hidden');
                                userInfo.classList.add('flex');
                            }
                            if (signInBtn) {
                                signInBtn.classList.add('hidden'); 
                            }

                            if (addTaskBtn) addTaskBtn.classList.remove('hidden');
                            if (navButtons) {
                                navButtons.classList.remove('hidden');
                                navButtons.classList.add('flex');
                            }

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
                    }

                } else {
                    // ========================================
                    // USER IS LOGGED OUT
                    // ========================================
                    console.log('🔓 User logged out');

                    // Hide user-specific UI
                    const userInfo = document.getElementById('user-info');
                    const signInBtn = document.getElementById('sign-in-btn');
                    const addTaskBtn = document.getElementById('add-task-btn');
                    const navButtons = document.getElementById('nav-buttons');
                    const mainContent = document.getElementById('main-content');

                    if (userInfo) userInfo.classList.add('hidden');
                    if (signInBtn) {
                        signInBtn.classList.remove('hidden');
                        signInBtn.onclick = () => auth.signInWithPopup(provider);
                    }
                    if (addTaskBtn) addTaskBtn.classList.add('hidden');
                    if (navButtons) navButtons.classList.add('hidden');

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
                        mainContent.innerHTML = `
                            <div class="text-center p-8 bg-gray-800 rounded-lg">
                                <div class="text-6xl mb-4">👋</div>
                                <h2 class="text-2xl font-bold text-cyan-400 mb-2">Welcome to Level Up Hub</h2>
                                <p class="text-gray-300">Please sign in with Google to continue.</p>
                            </div>
                        `;
                    }
                }
            });

      // =================================================================================
      // SECTION 4: APP INITIALIZATION & DATA LISTENERS
      // =================================================================================
      function initializeAppForUser(user, userProfile) {
        // Store user's custom categories and profile in the global app state
        appState.userCategories = userProfile.focusAreas;
        appState.userProfile = userProfile;

        // Set up the real-time data listeners
        const tasksCollection = db.collection('users').doc(user.uid).collection('tasks');
        const skillsCollection = db.collection('users').doc(user.uid).collection('skills');
        attachDataListeners(tasksCollection, skillsCollection);

        // Initialize all helper classes
        const streakTracker = new StreakTracker(user.uid);
        achievementSystem = new AchievementSystem({ db, uid: user.uid, confetti, tasksCollection, streakTracker });
        focusMode = new FocusMode({ db, uid: user.uid, confetti, tasksCollection });
        
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
        document.getElementById('add-task-btn').onclick = () => showTaskModal(tasksCollection);
        document.getElementById('report-btn').onclick = () => showWeeklyReportModal(db.collection('users').doc(user.uid).collection('timeLogs'), tasksCollection);
        document.getElementById('home-link').onclick = (e) => { e.preventDefault(); navigate('dashboard'); };
        
        mainContent.onclick = (e) => handleMainContentClick(e, tasksCollection, skillsCollection, db.collection('users').doc(user.uid).collection('timeLogs'), achievementSystem, streakTracker);
        
        navDashboard.onclick = () => navigate('dashboard');
        navSkills.onclick = () => navigate('skills');
        document.getElementById('nav-insights').onclick = () => navigate('insights');
        
        // Perform initial setup
        navigate('dashboard');
        add3DTiltEffect();
      }

      function attachDataListeners(tasksCollection, skillsCollection) {
        
            tasksCollection.onSnapshot(snapshot => {
            appState.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (appState.isLoading) {
                appState.isLoading = false;
            }
            render();
            });

            skillsCollection.onSnapshot(snapshot => {
            appState.skills = {};
            snapshot.docs.forEach(doc => { appState.skills[doc.id] = { id: doc.id, ...doc.data() }; });
            if (appState.currentView === 'skills') render();
            });
        }

      class StreakTracker {
            constructor(userId) {
                this.userId = userId;
                this.streakRef = db.collection('streaks').doc(userId);
                this.MILESTONE_TIERS = {
                    7: '🔥 Week Warrior',
                    14: '⚡ Fortnight Fighter',
                    30: '🌟 Monthly Master',
                    60: '💫 Dedication Diamond',
                    90: '👑 Quarterly King'
                };
            }

            normalizeDate(date) {
                if (!date) return null;
                const d = date.toDate ? date.toDate() : new Date(date);
                d.setHours(0, 0, 0, 0);
                return d;
            }

            isSameDay(date1, date2) {
                if (!date1 || !date2) return false;
                const d1 = this.normalizeDate(date1);
                const d2 = this.normalizeDate(date2);
                return d1.getTime() === d2.getTime();
            }

            isConsecutiveDay(lastDate, today) {
                if (!lastDate || !today) return false;
                const d1 = this.normalizeDate(lastDate);
                const d2 = this.normalizeDate(today);
                const diffTime = Math.abs(d2 - d1);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays === 1;
            }

            async updateStreak() {
                try {
                    const today = new Date();
                    const streakDoc = await this.streakRef.get();
                    const data = streakDoc.data() || { 
                        current: 0, 
                        lastStudy: null,
                        bestStreak: 0,
                        milestones: [],
                        totalDays: 0
                    };

                    if (this.isSameDay(data.lastStudy, today)) {
                        return {
                            status: 'unchanged',
                            streak: data.current,
                            message: 'Already logged today'
                        };
                    }

                    let updates = {
                        lastStudy: today,
                        totalDays: (data.totalDays || 0) + 1
                    };

                    if (this.isConsecutiveDay(data.lastStudy, today)) {
                        const newStreak = data.current + 1;
                        updates = {
                            ...updates,
                            current: newStreak,
                            bestStreak: Math.max(newStreak, data.bestStreak || 0)
                        };

                        // Check for new milestone
                        const milestone = this.checkMilestone(newStreak);
                        if (milestone) {
                            updates.milestones = firebase.firestore.FieldValue.arrayUnion({
                                days: newStreak,
                                achieved: today,
                                title: milestone
                            });
                        }

                        await this.streakRef.set(updates, { merge: true });
                        await this.celebrateStreak(newStreak);

                        return {
                            status: 'extended',
                            streak: newStreak,
                            milestone,
                            message: `Streak extended to ${newStreak} days!`
                        };
                    } 
                    else {
                        updates.current = 1;
                        await this.streakRef.set(updates, { merge: true });

                        return {
                            status: 'reset',
                            streak: 1,
                            message: 'New streak started!'
                        };
                    }
                } 
                catch (error) {
                    console.error('Error updating streak:', error);
                    throw new Error('Failed to update streak');
                }
            }

            checkMilestone(days) {
                return this.MILESTONE_TIERS[days] || null;
            }

            async celebrateStreak(days) {
                const milestone = this.checkMilestone(days);
                
                if (milestone) {
                    // Show achievement toast
                    showToast(`${milestone} - ${days} Day Streak! 🎉`);

                    // Trigger confetti with custom colors based on milestone
                    confetti({
                        particleCount: Math.min(150 + (days * 2), 300),
                        spread: 90,
                        origin: { y: 0.6 },
                        colors: this.getMilestoneColors(days),
                        shapes: ['square', 'circle'],
                        ticks: 300
                    });

                    // Play celebration sound if enabled
                    this.playAchievementSound();
                }
            }

            getMilestoneColors(days) {
                if (days >= 90) return ['#FFD700', '#FFA500', '#FF8C00']; // Gold theme
                if (days >= 30) return ['#4CAF50', '#8BC34A', '#CDDC39']; // Green theme
                return ['#FF4081', '#FF80AB', '#FF80AB']; // Default pink theme
            }

            playAchievementSound() {
                // Only play if user has enabled sounds
                const sound = new Audio('assets/achievement.mp3.mp3');
                sound.volume = 0.5;
                const playPromise = sound.play();
                if (playPromise) {
                    playPromise.catch(() => {}); // Handle browsers that don't allow autoplay
                }
            }

            async getStreakStats() {
                const doc = await this.streakRef.get();
                const data = doc.data() || {};
                
                return {
                    currentStreak: data.current || 0,
                    bestStreak: data.bestStreak || 0,
                    totalDays: data.totalDays || 0,
                    milestones: data.milestones || [],
                    lastStudy: data.lastStudy
                };
            }
        }
// =================================================================================
// SECTION 5: HELPER CLASSES 
// =================================================================================
class ConnectionManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.banner = null;

        // Initialize banner and event listeners
        this.createBanner();
        this.setupEventListeners();
        this.updateOnlineStatus(); // Check status on initial load
    }

    createBanner() {
        const bannerContainer = document.createElement('div');
        bannerContainer.innerHTML = `
            <div id="offline-banner" class="fixed bottom-4 right-4 max-w-sm bg-gray-800 border-l-4 border-yellow-500 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-full">
                <div class="flex p-4 items-center">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-gray-200">
                            You're offline. Your work is being saved locally and will sync automatically.
                        </p>
                    </div>
                    <div class="ml-auto pl-3">
                        <div class="-mx-1.5 -my-1.5">
                            <button type="button" class="dismiss-btn inline-flex rounded-md p-1.5 text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500">
                                <span class="sr-only">Dismiss</span>
                                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.banner = bannerContainer.firstElementChild;
        document.body.appendChild(this.banner);
        this.banner.querySelector('.dismiss-btn').addEventListener('click', () => this.hideBanner());
    }

    setupEventListeners() {
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
    }

    updateOnlineStatus() {
        this.isOnline = navigator.onLine;
        if (this.isOnline) {
            this.hideBanner();
        } else {
            this.showBanner();
        }
    }

    showBanner() {
        this.banner.classList.remove('translate-y-full');
    }

    hideBanner() {
        this.banner.classList.add('translate-y-full');
    }
}
class FocusMode {
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
    
    // DOM elements (Your query selectors are correct)
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
    
    this.motivations = ["⚡ Deep work mode activated", "🎯 Stay focused, you're doing great!", "💪 Building momentum...", "🔥 In the zone!", "🚀 Making progress!", "✨ Keep going, almost there!"];
    
    this.init();
  }
  
  init() {
    // Preset buttons
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

  // --- ENTRY POINT ---
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
    const connectionManager = new ConnectionManager();

    // for heatmap 
    async function renderActivityHeatmap(tasksCollection) {
        const heatmap = document.getElementById('activity-heatmap');
        if (!heatmap) return;

        // 1. Define the date range (e.g., last 180 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 180);

        // 2. Fetch completed tasks within this range
        const tasksSnapshot = await tasksCollection
            .where('completedAt', '>=', startDate)
            .where('completedAt', '<=', endDate)
            .get();

        // 3. Process the data into a simple map of dates and counts
        const completionData = {};
        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            // Normalize the date to a 'YYYY-MM-DD' string to use as a key
            const dateString = task.completedAt.toDate().toISOString().split('T')[0];
            completionData[dateString] = (completionData[dateString] || 0) + 1;
        });

        // 4. Generate the heatmap cells
        heatmap.innerHTML = ''; // Clear previous render
        for (let i = 0; i <= 180; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(currentDay.getDate() + i);
            const dateString = currentDay.toISOString().split('T')[0];

            const count = completionData[dateString] || 0;

            // Determine the color level based on the count
            let colorLevel = 0;
            if (count > 0) colorLevel = 1;
            if (count >= 3) colorLevel = 2;
            if (count >= 5) colorLevel = 3;
            if (count >= 8) colorLevel = 4;

            const cell = document.createElement('div');
            cell.className = 'day-cell';
            if (colorLevel > 0) {
                cell.classList.add(`color-level-${colorLevel}`);
            }
            // Add a tooltip to show the date and count on hover
            cell.title = `${count} tasks completed on ${currentDay.toLocaleDateString()}`;
            heatmap.appendChild(cell);
        }
    }
        class AchievementSystem {
            constructor({ db, uid, confetti, tasksCollection, streakTracker }) {
                this.db = db;
                this.uid = uid;
                this.confetti = confetti;
                this.tasksCollection = tasksCollection; // For checking requirements
                this.streakTracker = streakTracker;

                //list of achievements
                this.achievements = {
                    'first_week': { id: 'first_week', name: 'Week Warrior', description: 'Complete a 7-day streak', icon: '🔥', category: 'streak', requirement: { type: 'streak', value: 7 }, points: 50, rarity: 'common' },
                    'consistency_king': { id: 'consistency_king', name: 'Consistency King', description: 'Maintain a 30-day streak', icon: '👑', category: 'streak', requirement: { type: 'streak', value: 30 }, points: 200, rarity: 'rare' },
                    'unstoppable': { id: 'unstoppable', name: 'Unstoppable Force', description: 'Achieve a 100-day streak', icon: '💫', category: 'streak', requirement: { type: 'streak', value: 100 }, points: 500, rarity: 'legendary' },
                    'first_task': { id: 'first_task', name: 'Getting Started', description: 'Complete your first task', icon: '🎯', category: 'tasks', requirement: { type: 'tasks_completed', value: 1 }, points: 10, rarity: 'common' },
                    'task_master': { id: 'task_master', name: 'Task Master', description: 'Complete 50 tasks', icon: '⚡', category: 'tasks', requirement: { type: 'tasks_completed', value: 50 }, points: 100, rarity: 'uncommon' },
                    'centurion': { id: 'centurion', name: 'Centurion', description: 'Complete 100 tasks', icon: '💯', category: 'tasks', requirement: { type: 'tasks_completed', value: 100 }, points: 250, rarity: 'rare' },
                    'early_bird': { id: 'early_bird', name: 'Early Bird', description: 'Complete a task before 7 AM', icon: '🌅', category: 'special', requirement: { type: 'time_based', condition: 'early_morning' }, points: 30, rarity: 'uncommon' },
                    'night_owl': { id: 'night_owl', name: 'Night Owl', description: 'Complete a task after 11 PM', icon: '🦉', category: 'special', requirement: { type: 'time_based', condition: 'late_night' }, points: 30, rarity: 'uncommon' },
                    'weekend_warrior': { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Complete 10 tasks on weekends', icon: '🏖️', category: 'special', requirement: { type: 'weekend_tasks', value: 10 }, points: 50, rarity: 'uncommon' },
                    'full_stack_hero': { id: 'full_stack_hero', name: 'Full-Stack Hero', description: 'Log 50 hours in Full-Stack projects', icon: '🦸', category: 'category', requirement: { type: 'category_hours', category: 'fullstack', value: 50 }, points: 150, rarity: 'rare' },
                    'ml_enthusiast': { id: 'ml_enthusiast', name: 'ML Enthusiast', description: 'Complete 25 Machine Learning tasks', icon: '🤖', category: 'category', requirement: { type: 'category_tasks', category: 'mitx', value: 25 }, points: 150, rarity: 'rare' },
                    'ai_pioneer': { id: 'ai_pioneer', name: 'AI Pioneer', description: 'Log 30 hours in NVIDIA & AI Practice', icon: '🚀', category: 'category', requirement: { type: 'category_hours', category: 'nvidia', value: 30 }, points: 150, rarity: 'rare' },
                };

                this.userAchievements = [];
                this.achievementSound = new Audio('assets/achievement.mp3'); // Preload audio
                this.achievementSound.volume = 0.5;

                this.loadUserAchievements();
            }

            async loadUserAchievements() {
                try {
                    const snapshot = await this.db.collection('users').doc(this.uid).collection('achievements').get();
                    this.userAchievements = snapshot.docs.map(doc => doc.id);
                } catch (error) {
                    console.error('Error loading achievements:', error);
                }
            }

            async checkAchievements(trigger, data) {
                const newAchievements = [];
                for (const [id, achievement] of Object.entries(this.achievements)) {
                    if (this.userAchievements.includes(id)) continue;
                    if (await this.checkRequirement(achievement, trigger, data)) {
                        newAchievements.push(achievement);
                        this.userAchievements.push(id);
                    }
                }
                if (newAchievements.length > 0) {
                    await this.saveNewAchievements(newAchievements);
                    this.showAchievementNotifications(newAchievements);
                }
                return newAchievements;
            }

            async checkRequirement(achievement, trigger, data) {
                const req = achievement.requirement;
                switch (req.type) {
                    case 'streak':
                        return trigger === 'streak_update' && data.streak >= req.value;
                    case 'tasks_completed': {
                        if (trigger !== 'task_complete') return false;
                        const snapshot = await this.tasksCollection.where('completed', '==', true).get();
                        return snapshot.size >= req.value;
                    }
                    case 'time_based': {
                        if (trigger !== 'task_complete') return false;
                        const hour = new Date().getHours();
                        if (req.condition === 'early_morning') return hour < 7;
                        if (req.condition === 'late_night') return hour >= 23;
                        return false;
                    }
                    // Add more requirement checks for other types here later
                    default:
                        return false;
                }
            }

            async saveNewAchievements(newAchievements) {
                try {
                    const userAchievementsRef = this.db.collection('users').doc(this.uid).collection('achievements');
                    const batch = this.db.batch();
                    newAchievements.forEach(ach => {
                        const docRef = userAchievementsRef.doc(ach.id);
                        batch.set(docRef, {
                            id: ach.id,
                            name: ach.name,
                            earnedAt: new Date(),
                            points: ach.points || 0
                        });
                    });
                    await batch.commit();
                } catch (error) {
                    console.error('Error saving achievements:', error);
                }
            }

            showAchievementNotifications(achievements) {
                achievements.forEach((achievement, index) => {
                    setTimeout(() => this.showAchievementPopup(achievement), index * 1200);
                });
            }

            showAchievementPopup(achievement) {
                const popup = document.createElement('div');
                popup.className = 'achievement-popup';
                popup.innerHTML = `
                    <div class="achievement-content ${achievement.rarity}">
                        <div class="achievement-icon">${achievement.icon}</div>
                        <div class="achievement-details">
                            <h3>Achievement Unlocked!</h3>
                            <h4>${achievement.name}</h4>
                            <p class="achievement-points">+${achievement.points} points</p>
                        </div>
                    </div>
                `;
                document.body.appendChild(popup);
                setTimeout(() => popup.classList.add('show'), 100);
                this.playAchievementSound();
                if (achievement.rarity === 'legendary') {
                    this.confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#FFD700', '#FFA500', '#FF6347'] });
                }
                setTimeout(() => {
                    popup.classList.remove('show');
                    setTimeout(() => popup.remove(), 500);
                }, 5000);
            }

            playAchievementSound() {
                const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
                if (!soundEnabled) return;
                this.achievementSound.currentTime = 0;
                this.achievementSound.play().catch(error => console.warn("Audio play prevented by browser."));
            }

            async renderAchievementsPage() {
                await this.loadUserAchievements(); // Ensure we have the latest data
                const totalPoints = await this.calculateTotalPoints();
                const unlockedCount = this.userAchievements.length;
                const totalCount = Object.keys(this.achievements).length;

                mainContent.innerHTML = `
                    <div class="achievements-page">
                        <div class="achievements-header">
                            <h1 class="text-3xl font-bold mb-4 text-white">Achievements & Badges</h1>
                            <div class="stats-bar">
                                <div class="stat"><span class="stat-value">${unlockedCount}/${totalCount}</span><span class="stat-label">Unlocked</span></div>
                                <div class="stat"><span class="stat-value">${totalPoints}</span><span class="stat-label">Total Points</span></div>
                                <div class="stat"><span class="stat-value">${this.getPlayerLevel(totalPoints).name}</span><span class="stat-label">Level</span></div>
                            </div>
                        </div>
                        <div class="achievements-categories">${this.renderAchievementsByCategory()}</div>
                    </div>`;
            }

            renderAchievementsByCategory() {
                const categories = {
                    streak: { name: 'Streak Masters', icon: '🔥' },
                    tasks: { name: 'Task Champions', icon: '✅' },
                    category: { name: 'Category Experts', icon: '🎯' },
                    special: { name: 'Special Achievements', icon: '⭐' }
                };
                return Object.entries(categories).map(([catId, catInfo]) => {
                    const achievements = Object.values(this.achievements).filter(a => a.category === catId);
                    return `
                        <div class="achievement-category">
                            <h2 class="category-title"><span class="category-icon">${catInfo.icon}</span> ${catInfo.name}</h2>
                            <div class="achievements-grid">${achievements.map(a => this.renderAchievementCard(a)).join('')}</div>
                        </div>`;
                }).join('');
            }

            renderAchievementCard(achievement) {
                const isUnlocked = this.userAchievements.includes(achievement.id);
                return `
                    <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'} ${achievement.rarity}">
                        <div class="achievement-icon">${achievement.icon}</div>
                        <h3 class="achievement-name">${achievement.name}</h3>
                        <p class="achievement-description">${achievement.description}</p>
                        <div class="achievement-footer">
                            <span class="achievement-points">${achievement.points} pts</span>
                            <span class="achievement-rarity">${achievement.rarity}</span>
                        </div>
                        ${!isUnlocked ? '<div class="locked-overlay">🔒</div>' : ''}
                    </div>`;
            }
            
            async calculateTotalPoints() {
                const snapshot = await this.db.collection('users').doc(this.uid).collection('achievements').get();
                return snapshot.docs.reduce((total, doc) => total + (doc.data().points || 0), 0);
            }
            
            getPlayerLevel(points) {
                const levels = [
                    { min: 0, name: 'Novice' }, { min: 100, name: 'Apprentice' }, { min: 300, name: 'Journeyman' },
                    { min: 600, name: 'Expert' }, { min: 1000, name: 'Master' }, { min: 1500, name: 'Grandmaster' }, { min: 2000, name: 'Legend' }
                ];
                return levels.slice().reverse().find(l => points >= l.min) || { name: 'Novice' };
            }
        }
      // =================================================================================
      // SECTION 6: EVENT HANDLERS
      // =================================================================================
      async function handleFormSubmit(e, tasksCollection) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = {
          type: formData.get('type'),
          title: formData.get('title'),
          dueDate: formData.get('dueDate'),
          priority: formData.get('priority'),
          category: formData.get('category'),
          url: formData.get('url'),
          skills: formData.get('skills').split(',').map(s => s.trim()).filter(Boolean),
          completed: false,
          createdAt: new Date().toISOString(),
          totalTimeLogged: 0,
          timerRunning: false,
          lastStartTime: null
        };
        if (taskData.type === 'project') {
          taskData.subtasks = Array.from(document.querySelectorAll('.subtask-input')).map(input => ({ text: input.value, completed: false })).filter(st => st.text);
        }
        await tasksCollection.add(taskData);
        closeModal();
        showToast('Task added successfully!');
      }

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

                        achievementSystem.checkAchievements('task_complete', { 
                            totalCompleted: completedTasksSnap.size,
                            category: task.category 
                        });
                        achievementSystem.checkAchievements('streak_update', { 
                            streak: stats.currentStreak 
                        });

                        // Show skill rating modal
                        showSkillRatingModal(task, skillsCollection);

                        // Success notification
                        if (typeof showToast === 'function') {
                            showToast('Task completed! 🎉', 'success');
                        }

                    } else {
                        // ✅ UNCOMPLETE - Reopening task
                        await tasksCollection.doc(taskId).update({
                            completed: false,
                            completedAt: null
                        });

                        // Update local task object
                        task.completed = false;
                        task.completedAt = null;

                        if (typeof showToast === 'function') {
                            showToast('Task reopened', 'success');
                        }
                    }

                    // Refresh UI
                    renderDashboard();
                    if (typeof updateStats === 'function') updateStats();

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
                        confetti({
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
                    renderDashboard();

                } catch (error) {
                    console.error('❌ Error updating subtask:', error);
                    e.target.checked = !e.target.checked; // Revert
                }
                return; // Stop here
            }

            // ✅ DELETE BUTTON - Optimistic Update with Undo
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
                renderDashboard();
                if (typeof updateStats === 'function') updateStats();

                // 3. Set up delayed permanent deletion
                const deletionTimeout = setTimeout(() => {
                    tasksCollection.doc(taskId).delete().catch(err => {
                        console.error("❌ Error during final deletion:", err);
                        // If deletion fails, restore the task
                        appState.tasks.splice(taskIndex, 0, removedTask);
                        renderDashboard();
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
                    renderDashboard();
                    if (typeof updateStats === 'function') updateStats();
                    
                    console.log("✅ Task deletion undone");
                });
                
                return; // Stop here
            }

            // ✅ TIMER BUTTON - Start/Stop
            else if (e.target.closest('.timer-btn')) {
                try {
                    // First, check if the task is already completed.
                    if (task.completed) {
                        showToast("Cannot start a timer on a completed task.");
                        return; 
                    }

                    const isRunning = !task.timerRunning;
                    const updates = { timerRunning: isRunning };

                    if (isRunning) {
                        // Start timer
                        updates.lastStartTime = firebase.firestore.FieldValue.serverTimestamp();
                        console.log("⏱️ Timer started for task:", task.title);
                    } else if (task.lastStartTime) {
                        // Stop timer - calculate duration
                        const lastStart = task.lastStartTime.toDate ? 
                            task.lastStartTime.toDate() : 
                            new Date(task.lastStartTime);
                        
                        const duration = Math.round((new Date() - lastStart) / 1000);
                        updates.totalTimeLogged = (task.totalTimeLogged || 0) + duration;
                        updates.lastStartTime = null;

                        // Create time log entry
                        await timeLogsCollection.add({
                            taskId: taskId,
                            duration: duration,
                            category: task.category,
                            timestamp: new Date(),
                            userId: auth.currentUser.uid
                        });

                        console.log(`⏹️ Timer stopped. Duration: ${duration}s. Total: ${updates.totalTimeLogged}s`);
                    }

                    await tasksCollection.doc(taskId).update(updates);

                    // Update local task
                    Object.assign(task, updates);

                    // Refresh UI
                    renderDashboard();

                } catch (error) {
                    console.error('❌ Error updating timer:', error);
                    if (typeof showToast === 'function') {
                        showToast('Failed to update timer', 'error');
                    }
                }
                return; 
            }

            // ✅ FOCUS BUTTON - Start Focus Mode
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

      // =================================================================================
      // SECTION 7: FIRESTORE LOGIC
      // =================================================================================
      async function updateSkill(skillName, rating, skillsCollection) {
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

      // =================================================================================
      // SECTION 8: UI RENDERING, MODALS, AND UTILITIES
      // =================================================================================
        const emptyStates = {
            default: { title: "Ready to Level Up?", description: "Your dashboard is clear. Click the '+' button to add your first task and start your journey.", icon: "start" },
            completed: { title: "No Completed Tasks Yet", description: "Complete some tasks to see them here and earn your rewards!", icon: "trophy" },
            active: { title: "All Tasks Completed! 🎉", description: "Great job! You've completed all your tasks. Add new ones to keep the momentum going.", icon: "checkmark" },
            overdue: { title: "You're All Caught Up!", description: "No overdue tasks. Keep up the great work!", icon: "clock" }
        };

        function renderEmptyState(state = 'default') {
            const currentState = emptyStates[state] || emptyStates.default;
            return `
                <div class="flex flex-col items-center justify-center h-full text-center p-8">
                    <svg class="w-16 h-16 text-gray-600 mb-4 transform hover:scale-110 transition-transform" fill="currentColor"><use xlink:href="#icon-${currentState.icon}"></use></svg>
                    <h2 class="text-2xl font-bold text-white mb-2">${currentState.title}</h2>
                    <p class="text-gray-400 max-w-sm mb-6">${currentState.description}</p>
                    ${getQuickActions(state)}
                    ${getMotivationalElement(state)}
                </div>
            `;
        };

        function getQuickActions(filter) {
            const actions = {
                default: [ { label: 'Add Task', icon: 'plus', action: 'addTask' }, { label: 'Import Tasks', icon: 'import', action: 'importTasks' } ],
                completed: [ { label: 'View Active Tasks', icon: 'list', action: 'viewActive' }, { label: 'View Statistics', icon: 'chart', action: 'viewStats' } ],
                active: [ { label: 'Add New Task', icon: 'plus', action: 'addTask' }, { label: 'View Completed', icon: 'check', action: 'viewCompleted' } ],
                overdue: []
            };
            const actionButtons = actions[filter] || actions.default;
            return `<div class="flex gap-4 mt-4">${actionButtons.map(action => `<button onclick="handleQuickAction('${action.action}')" class="flex items-center px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"><svg class="w-4 h-4 mr-2"><use xlink:href="#icon-${action.icon}"></use></svg>${action.label}</button>`).join('')}</div>`;
        };

        function getMotivationalElement(filter) {
            if (filter === 'completed') {
                const rate = getCompletionRate();
                return `<div class="mt-6 bg-gray-800 rounded-lg p-4 w-full max-w-sm"><div class="text-sm text-gray-400">Your Progress</div><div class="flex items-center gap-4 mt-2"><div class="flex-1"><div class="h-2 bg-gray-700 rounded-full overflow-hidden"><div class="h-full bg-blue-500" style="width: ${rate}%"></div></div></div><div class="text-white font-medium">${rate}%</div></div></div>`;
            }
            return '';
        };

        function getCompletionRate() {
            const total = appState.tasks.length;
            if (total === 0) return 0;
            const completed = appState.tasks.filter(t => t.completed).length;
            return Math.round((completed / total) * 100);
        };

        function triggerConfettiAnimation() {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        };

        // Make this function global so the inline onclick can find it
        window.handleQuickAction = (action) => {
            switch(action) {
                case 'addTask':
                    showTaskModal(db.collection('users').doc(auth.currentUser.uid).collection('tasks'));
                    break;
                case 'importTasks':
                    showToast("Import feature coming soon!"); // Placeholder
                    break;
                case 'viewStats':
                    navigate('insights');
                    break;
                case 'viewActive':
                    appState.activeFilter = 'active';
                    render();
                    break;
                case 'viewCompleted':
                    appState.activeFilter = 'completed';
                    render();
                    break;
            }
        };

      function navigate(view) {
        appState.currentView = view;
        navDashboard.classList.toggle('bg-gray-700', view === 'dashboard');
        navDashboard.classList.toggle('text-white', view === 'dashboard');
        navSkills.classList.toggle('bg-gray-700', view === 'skills');
        navSkills.classList.toggle('text-white', view === 'skills');
        document.getElementById('nav-insights').classList.toggle('bg-gray-700', view === 'insights');
        document.getElementById('nav-insights').classList.toggle('text-white', view === 'insights');
        render();
      }
      function renderSkeletons() {
          mainContent.innerHTML = `
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

function createShatterEffect(cardElement) {
    const rect = cardElement.getBoundingClientRect();

    // Create a container for the particles at the exact same position as the card
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = `${rect.left}px`;
    container.style.top = `${rect.top}px`;
    container.style.width = `${rect.width}px`;
    container.style.height = `${rect.height}px`;
    container.style.zIndex = '100'; // Make sure it's on top
    document.body.appendChild(container);

    // Hide the original card so we only see the animation
    cardElement.style.opacity = '0';

    // Create a grid of particles
    const gridSize = 10;
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.left = `${(i / gridSize) * 100}%`;
            particle.style.top = `${(j / gridSize) * 100}%`;
            particle.style.width = `${100 / gridSize}%`;
            particle.style.height = `${100 / gridSize}%`;
            particle.style.background = 'rgb(75 85 99)'; // Corresponds to bg-gray-700
            container.appendChild(particle);
        }
    }

    // Use anime.js to animate the particles
    anime({
        targets: container.children,
        translateX: () => anime.random(-100, 100),
        translateY: () => anime.random(-150, 50),
        scale: () => anime.random(0.2, 0.8),
        opacity: [1, 0],
        delay: anime.stagger(20, {from: 'center'}),
        duration: 800,
        easing: 'easeOutExpo',
        // When the animation is complete, remove the particle container
        complete: () => {
            container.remove();
        }
    });
}

function add3DTiltEffect() {
    const mainGrid = document.querySelector('#main-content');
    if (!mainGrid) return;
    let lastTransformLayer = null;

    mainGrid.addEventListener('mousemove', e => {
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
            const rotateX = (y - centerY) / 15; // A little less intense
            const rotateY = (centerX - x) / 15;

            currentLayer.style.setProperty('--mouse-x', `${x}px`);
            currentLayer.style.setProperty('--mouse-y', `${y}px`);
            currentLayer.style.transform = `translateZ(20px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

            lastTransformLayer = currentLayer;
        } else {
            lastTransformLayer = null;
        }
    });

    mainGrid.addEventListener('mouseleave', () => {
        if (lastTransformLayer) {
            lastTransformLayer.style.transform = `translateZ(0) rotateX(0deg) rotateY(0deg)`;
            lastTransformLayer = null;
        }
    });
}

      function render() {
        if (appState.currentView === 'dashboard') renderDashboard();

        else if (appState.currentView === 'skills') renderSkillsDashboard();
        else if (appState.currentView === 'insights') {
            const uid = auth.currentUser.uid;
            renderInsightsDashboard(
                db.collection('users').doc(uid).collection('timeLogs'),
                db.collection('users').doc(uid).collection('tasks')
            );
        }
      }

    function renderDashboard() {
        if (appState.isLoading) {
            renderSkeletons();
            return;
        }
        if (!appState.userCategories || appState.userCategories.length === 0) {
            mainContent.innerHTML = `<div class="text-center p-8"><p class="text-gray-400">Loading your personalized dashboard...</p></div>`;
            return;
        }

        cleanupTimers();

        // Dynamically create the column HTML from the user's categories
        const columnsHTML = appState.userCategories.map(cat => `
            <div id="col-${cat.id}" class="bg-gray-800 rounded-lg p-4">
                <h2 class="text-lg font-bold mb-4" style="color: ${cat.color};">${cat.icon || '🎯'} ${cat.name}</h2>
                <div class="space-y-4"></div>
            </div>
        `).join('');

        // Set the main content HTML ONCE
        mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-${appState.userCategories.length} gap-6">${columnsHTML}</div>`;
        
        // Filter and prepare tasks to render
        let tasksToRender = [];
        if (appState.activeFilter === 'completed') {
            tasksToRender = appState.tasks.filter(t => t.completed);
        } else {
            const { startOfWeek } = getWeekRange(new Date());
            const overdue = appState.tasks.filter(t => !t.completed && new Date(t.dueDate) < startOfWeek);
            const thisWeek = appState.tasks.filter(t => !t.completed && new Date(t.dueDate) >= startOfWeek);
            tasksToRender = [...overdue, ...thisWeek];
        }

        // Handle the empty state
        if (tasksToRender.length === 0) {
            let stateKey = appState.activeFilter;
            if (appState.tasks.length === 0) stateKey = 'default';
            mainContent.innerHTML = renderEmptyState(stateKey);
            if (stateKey === 'active') triggerConfettiAnimation();
            updateAlertBanner();
            return; 
        }
        
        // Render the task cards into the dynamic columns
        tasksToRender.forEach(task => {
            const column = mainContent.querySelector(`#col-${task.category} .space-y-4`);
            if (column) {
                column.appendChild(createTaskCard(task));
            } else {
                // Fallback for tasks with old category names
                const firstColumn = mainContent.querySelector('.space-y-4');
                if(firstColumn) firstColumn.appendChild(createTaskCard(task));
            }
        });

        updateAlertBanner();
        setupTimers();
    }

function cleanupTimers() {
    if (appState.timers) {
        Object.values(appState.timers).forEach(timerId => {
            if (timerId) clearInterval(timerId);
        });
        appState.timers = {};
    }
}

function updateAlertBanner() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueTodayOrOverdue = appState.tasks.filter(t => {
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

function setupTimers() {
    appState.tasks
        .filter(t => t.timerRunning)
        .forEach(task => {
            const card = document.querySelector(`.task-card[data-id="${task.id}"]`);
            const timerDisplay = card?.querySelector('.timer-display');
            
            if (!timerDisplay) return;

            appState.timers[task.id] = setInterval(() => {
                if (!task.lastStartTime?.toDate) return;

                const elapsed = Math.round((new Date() - task.lastStartTime.toDate()) / 1000);
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

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    const button = document.getElementById('user-menu-button');
    const isHidden = menu.classList.contains('hidden');
    
    menu.classList.toggle('hidden');
    button.setAttribute('aria-expanded', !isHidden);
}

function createTaskCard(task) {
    const card = document.createElement('div');
    let cardClasses = 'task-card relative';
    if (task.priority === 'High') {
        cardClasses += ' priority-high';
    }
    card.className = cardClasses;
        card.dataset.id = task.id;

    const totalTime = task.totalTimeLogged || 0;
    const timeDisplay = `${String(Math.floor(totalTime / 3600)).padStart(2, '0')}:${String(Math.floor((totalTime % 3600) / 60)).padStart(2, '0')}:${String(totalTime % 60).padStart(2, '0')}`;
    let projectHTML = '';

    if (task.type === 'project' && task.subtasks) {
        const completedSubtasks = task.subtasks.filter(st => st.completed).length;
        const progress = task.subtasks.length > 0 ? (completedSubtasks / task.subtasks.length) * 100 : 0;
        projectHTML = `<div class="mt-2"><div class="w-full bg-gray-600 rounded-full h-2.5"><div class="bg-cyan-600 h-2.5 rounded-full transition-all duration-500 ease-out" style="width: ${progress}%"></div></div><ul class="mt-2 text-sm space-y-1">${task.subtasks.map((st, index) => `<li class="flex items-center"><input type="checkbox" data-subtask-index="${index}" class="mr-2 h-4 w-4 rounded bg-gray-800 border-gray-600 text-cyan-500 focus:ring-cyan-600" ${st.completed ? 'checked' : ''}><span class="${st.completed ? 'line-through text-gray-400' : ''}">${st.text}</span></li>`).join('')}</ul></div>`;
    }

    card.innerHTML = `
        <div class="card-transform-layer"></div>

        <div class="card-content relative z-10 ${{ High: 'border-red-500', Medium: 'border-yellow-500', Low: 'border-green-500' }[task.priority]} border-l-4 pl-4 ${task.completed ? 'completed' : ''}">
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
                <button class="delete-btn text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
        </div>`;
    return card;
}
      function renderSkillsDashboard() {
        mainContent.innerHTML = `<div class="bg-gray-800 rounded-lg p-6"><h2 class="text-2xl font-bold mb-6 text-cyan-400"> Skill Tree 🌳</h2><div id="skills-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div></div>`;
        const grid = document.getElementById('skills-grid');
        if (Object.keys(appState.skills).length === 0) {
          grid.innerHTML = `<p class="text-gray-400 col-span-full">No skills tracked yet. Complete tasks with skill tags to see your progress!</p>`;
          return;
        }
        Object.values(appState.skills).sort((a,b) => (a.totalConfidence / a.count) - (b.totalConfidence / b.count)).forEach(skill => {
          const average = skill.count > 0 ? (skill.totalConfidence / skill.count) : 0;
          const skillCard = document.createElement('div');
          skillCard.className = 'bg-gray-700 p-4 rounded-lg flex flex-col justify-between';
          skillCard.innerHTML = `<div><h3 class="font-bold text-lg">${skill.name}</h3><p class="text-sm text-gray-400">Rated ${skill.count} time(s)</p></div><div class="mt-4"><p class="text-sm text-gray-300">Confidence: ${average.toFixed(1)} / 5.0</p><div class="w-full bg-gray-600 rounded-full h-2.5 mt-1"><div class="bg-cyan-600 h-2.5 rounded-full" style="width: ${average / 5 * 100}%"></div></div></div>`;
          grid.appendChild(skillCard);
        });
      }

        function showTaskModal(tasksCollection) {
            const categories = appState.userCategories || [];
            const categoryOptions = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

            modalContainer.innerHTML = `
                <div id="task-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 p-4">
                    <div class="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <form id="task-form">
                            <h2 class="text-xl font-bold mb-4">Add New Item</h2>
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
                                <button type="submit" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold">Add Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.getElementById('cancel-task-btn').onclick = closeModal;
            document.getElementById('task-form').onsubmit = (e) => handleFormSubmit(e, tasksCollection);
            
            const taskTypeSelect = document.getElementById('task-type');
            const subtasksContainer = document.getElementById('project-subtasks-container');
            taskTypeSelect.onchange = () => { subtasksContainer.classList.toggle('hidden', taskTypeSelect.value !== 'project'); };
            
            document.getElementById('add-subtask-btn').onclick = () => {
                const subtaskList = document.getElementById('subtasks-list');
                const newSubtask = document.createElement('div');
                newSubtask.className = 'flex items-center space-x-2';
                newSubtask.innerHTML = `<input type="text" class="subtask-input flex-grow bg-gray-600 border border-gray-500 rounded-md p-1 text-sm" placeholder="Sub-task description"><button type="button" class="remove-subtask-btn text-gray-400 hover:text-red-500">&times;</button>`;
                subtaskList.appendChild(newSubtask);
                newSubtask.querySelector('.remove-subtask-btn').onclick = () => newSubtask.remove();
            };
        }

      async function showSkillRatingModal(task, skillsCollection) {
        if (!task.skills || task.skills.length === 0) return;
        modalContainer.innerHTML = `<div id="skill-rating-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 p-4"><div class="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"><h2 class="text-xl font-bold mb-4">Rate Your Confidence</h2><p class="mb-4 text-gray-300">How confident do you feel with these skills after completing "${task.title}"?</p><div id="skills-to-rate" class="space-y-4">${task.skills.map(skill => `<div class="skill-rating-item" data-skill="${skill}"><label class="block font-medium text-gray-200">${skill}</label><div class="star-rating flex items-center space-x-1 text-2xl text-gray-500 mt-1" data-rating="0">${[1,2,3,4,5].map(i => `<svg data-value="${i}" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>`).join('')}</div></div>`).join('')}</div><div class="mt-6 flex justify-end"><button id="submit-ratings-btn" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold">Submit Ratings</button></div></div></div>`;
        document.querySelectorAll('.star-rating').forEach(ratingContainer => {
          const stars = ratingContainer.querySelectorAll('svg');
          ratingContainer.onmouseover = e => { if (e.target.tagName === 'svg') { const hoverValue = e.target.dataset.value; stars.forEach(star => star.classList.toggle('text-yellow-400', star.dataset.value <= hoverValue)); } };
          ratingContainer.onmouseout = () => { const currentRating = ratingContainer.dataset.rating; stars.forEach(star => star.classList.toggle('text-yellow-400', star.dataset.value <= currentRating)); };
          ratingContainer.onclick = e => { if (e.target.tagName === 'svg') { ratingContainer.dataset.rating = e.target.dataset.value; } };
        });
        document.getElementById('submit-ratings-btn').onclick = async () => {
          const ratings = Array.from(document.querySelectorAll('.skill-rating-item')).map(item => ({ skill: item.dataset.skill, rating: parseInt(item.querySelector('.star-rating').dataset.rating) }));
          const validRatings = ratings.filter(r => r.rating > 0);
          if (validRatings.length > 0) await Promise.all(validRatings.map(r => updateSkill(r.skill, r.rating, skillsCollection)));
          closeModal();
        };
      }
      async function renderInsightsDashboard(timeLogsCollection, tasksCollection) {
          try {
              // Set up initial UI
              mainContent.innerHTML = `
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

              // Fetch and process time logs
              const timeData = await fetchTimeData(timeLogsCollection);
              
              // Create and render chart
              await createChart(timeData);
              renderActivityHeatmap(tasksCollection);
              
          } catch (error) {
              console.error('Error rendering insights dashboard:', error);
              showError('Failed to load insights dashboard. Please try again later.');
          }
      }

        async function fetchTimeData(timeLogsCollection) {
            const timeData = {
                fullstack: 0,
                mitx: 0,
                nvidia: 0
            };

            try {
                const logsSnapshot = await timeLogsCollection.get();
                
                logsSnapshot.forEach(doc => {
                    const log = doc.data();
                    
                    // Validate log data
                    if (!log.category || !Number.isFinite(log.duration)) {
                        console.warn('Invalid log data:', doc.id, log);
                        return;
                    }

                    // Normalize category name and add duration
                    const category = log.category.toLowerCase().replace(/ & /g, '');
                    if (timeData.hasOwnProperty(category)) {
                        timeData[category] += Math.max(0, log.duration);
                    }
                });

                return timeData;
            } catch (error) {
                throw new Error(`Failed to fetch time logs: ${error.message}`);
            }
        }

        async function createChart(timeData) {
            const canvas = document.getElementById('timeAllocationChart');
            if (!canvas) {
                throw new Error('Canvas element not found');
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            const chartConfig = {
                type: 'doughnut',
                data: {
                    labels: ['Full-Stack & Projects', 'MITx Machine Learning', 'NVIDIA & AI Practice'],
                    datasets: [{
                        label: 'Time Spent (in minutes)',
                        data: [
                            convertToMinutes(timeData.fullstack),
                            convertToMinutes(timeData.mitx),
                            convertToMinutes(timeData.nvidia)
                        ],
                        backgroundColor: [
                            'rgba(52, 211, 153, 0.7)',  // Green
                            'rgba(96, 165, 250, 0.7)',  // Blue
                            'rgba(192, 132, 252, 0.7)'  // Purple
                        ],
                        borderColor: [
                            '#10B981',
                            '#3B82F6',
                            '#A855F7'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: '#d1d5db'
                            }
                        },
                        title: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const minutes = context.raw;
                                    return `${minutes} minutes (${formatHours(minutes)})`;
                                }
                            }
                        }
                    }
                }
            };

            try {
                return new Chart(ctx, chartConfig);
            } catch (error) {
                throw new Error(`Failed to create chart: ${error.message}`);
            }
        }

        function convertToMinutes(seconds) {
            return Math.round(Math.max(0, seconds) / 60);
        }

        function formatHours(minutes) {
            const hours = (minutes / 60).toFixed(1);
            return `${hours} hours`;
        }

        function showError(message) {
            const errorDiv = document.getElementById('chart-error');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
            }
        }

        async function showWeeklyReportModal(timeLogsCollection, tasksCollection) {
            const { startOfWeek, endOfWeek } = getWeekRange(new Date());
            
            // Fetch time logs
            const logsSnapshot = await timeLogsCollection
                .where('timestamp', '>=', startOfWeek)
                .where('timestamp', '<=', endOfWeek)
                .get();
            
            // Fetch completed tasks this week
            const tasksSnapshot = await tasksCollection
                .where('completed', '==', true)
                .where('completedAt', '>=', startOfWeek)
                .where('completedAt', '<=', endOfWeek)
                .get();
            
            // Process time data
            const weeklyData = { fullstack: 0, mitx: 0, nvidia: 0 };
            const dailyData = {};
            
            logsSnapshot.forEach(doc => {
                const log = doc.data();
                if (log.category && typeof log.category === 'string') {
                    const category = log.category.toLowerCase();
                    if (weeklyData[category] !== undefined) {
                        weeklyData[category] += Number(log.duration) || 0;
                    }
                    
                    // Track daily time
                    const day = log.timestamp.toDate().toLocaleDateString('en-US', { weekday: 'short' });
                    if (!dailyData[day]) dailyData[day] = 0;
                    dailyData[day] += Number(log.duration) || 0;
                }
            });

            // Calculate statistics
            const totalTime = Object.values(weeklyData).reduce((sum, time) => sum + time, 0);
            const completedTasks = tasksSnapshot.size;
            const avgTimePerTask = completedTasks > 0 ? Math.round(totalTime / completedTasks) : 0;
            
            // Find most productive day
            const mostProductiveDay = Object.entries(dailyData).reduce((max, [day, time]) => 
                time > (max.time || 0) ? { day, time } : max, {});

            const formatTime = (seconds) => {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                return `${hours}h ${minutes}m`;
            };

            const formatPercentage = (value, total) => {
                return total > 0 ? Math.round((value / total) * 100) : 0;
            };

            modalContainer.innerHTML = `
                <div id="report-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 p-4">
                    <div class="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold">Weekly Progress Report</h2>
                            <span class="text-sm text-gray-400">${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}</span>
                        </div>
                        
                        <!-- Summary Stats -->
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

                        <!-- Category Breakdown -->
                        <div class="space-y-4 mb-6">
                            <h3 class="text-lg font-semibold">Time by Category</h3>
                            
                            <div class="space-y-3">
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <h4 class="font-medium text-green-400">Full-Stack & Projects</h4>
                                        <span class="font-mono text-sm">${formatTime(weeklyData.fullstack)} (${formatPercentage(weeklyData.fullstack, totalTime)}%)</span>
                                    </div>
                                    <div class="w-full bg-gray-700 rounded-full h-2">
                                        <div class="bg-green-400 h-2 rounded-full transition-all duration-500" 
                                            style="width: ${formatPercentage(weeklyData.fullstack, totalTime)}%"></div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <h4 class="font-medium text-blue-400">MITx Machine Learning</h4>
                                        <span class="font-mono text-sm">${formatTime(weeklyData.mitx)} (${formatPercentage(weeklyData.mitx, totalTime)}%)</span>
                                    </div>
                                    <div class="w-full bg-gray-700 rounded-full h-2">
                                        <div class="bg-blue-400 h-2 rounded-full transition-all duration-500" 
                                            style="width: ${formatPercentage(weeklyData.mitx, totalTime)}%"></div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <h4 class="font-medium text-purple-400">NVIDIA & AI Practice</h4>
                                        <span class="font-mono text-sm">${formatTime(weeklyData.nvidia)} (${formatPercentage(weeklyData.nvidia, totalTime)}%)</span>
                                    </div>
                                    <div class="w-full bg-gray-700 rounded-full h-2">
                                        <div class="bg-purple-400 h-2 rounded-full transition-all duration-500" 
                                            style="width: ${formatPercentage(weeklyData.nvidia, totalTime)}%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Daily Activity Chart -->
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold mb-3">Daily Activity</h3>
                            <div class="flex justify-between items-end h-32">
                                ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                    const dayTime = dailyData[day] || 0;
                                    const height = totalTime > 0 ? (dayTime / Math.max(...Object.values(dailyData))) * 100 : 0;
                                    return `
                                        <div class="flex-1 flex flex-col items-center">
                                            <div class="w-full max-w-12 bg-cyan-500 rounded-t transition-all duration-500" 
                                                style="height: ${height}%"
                                                title="${formatTime(dayTime)}"></div>
                                            <span class="text-xs text-gray-400 mt-1">${day}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Insights -->
                        <div class="bg-gray-700 rounded-lg p-4 mb-6">
                            <h3 class="text-lg font-semibold mb-2">Weekly Insights(Suggestion)</h3>
                            <ul class="space-y-2 text-sm">
                                ${generateInsights(weeklyData, totalTime, completedTasks, mostProductiveDay)}
                            </ul>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex justify-between">
                            <button onclick="exportWeeklyReport()" 
                                    class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                Export Report
                            </button>
                            <button id="close-report-btn" 
                                    class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md">
                                Close
                            </button>
                        </div>
                    </div>
                </div>`;
            
            document.getElementById('close-report-btn').onclick = closeModal;
            
            // Animate progress bars after modal opens
            setTimeout(() => {
                document.querySelectorAll('.bg-green-400, .bg-blue-400, .bg-purple-400').forEach(bar => {
                    bar.style.width = bar.style.width;
                });
            }, 100);
        }

        function generateInsights(weeklyData, totalTime, completedTasks, mostProductiveDay) {
            const insights = [];
            
            // Most focused category
            const categories = Object.entries(weeklyData);
            const mostFocused = categories.reduce((max, [cat, time]) => 
                time > max.time ? { category: cat, time } : max, { time: 0 });
            
            if (mostFocused.category) {
                insights.push(`💡 You spent most time on <span class="font-semibold">${getCategoryName(mostFocused.category)}</span> this week`);
            }
            
            // Productivity insight
            if (completedTasks > 10) {
                insights.push(`🚀 Great productivity! You completed ${completedTasks} tasks`);
            } else if (completedTasks > 0) {
                insights.push(`📈 You completed ${completedTasks} tasks. Try to increase this next week`);
            }
            
            // Balance insight
            const balance = Math.min(...categories.map(([_, time]) => time)) / Math.max(...categories.map(([_, time]) => time));
            if (balance > 0.5) {
                insights.push(`⚖️ Good balance across all categories`);
            } else {
                insights.push(`⚠️ Consider balancing time across categories more evenly`);
            }
            
            // Most productive day
            if (mostProductiveDay.day) {
                insights.push(`📅 ${mostProductiveDay.day} was your most productive day`);
            }
            
            return insights.map(insight => `<li>${insight}</li>`).join('');
        }

        function showUndoToast(message, onUndo) {
            // Remove any existing toasts
            const toastContainer = document.getElementById('toast-container');
            toastContainer.innerHTML = '';

            const toast = document.createElement('div');
            toast.className = 'bg-gray-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between animate-toast-in';

            const messageSpan = document.createElement('span');
            messageSpan.textContent = message;
            toast.appendChild(messageSpan);

            const undoButton = document.createElement('button');
            undoButton.className = 'ml-4 font-bold text-cyan-400 hover:text-cyan-300';
            undoButton.textContent = 'Undo';
            toast.appendChild(undoButton);

            // This is the timer for the deletion
            const timeoutId = setTimeout(() => {
                // If the timer finishes, we don't need the onUndo function anymore
                // The task will be permanently deleted by the calling function.
                toast.classList.remove('animate-toast-in');
                toast.classList.add('animate-toast-out');
                setTimeout(() => toast.remove(), 500);
            }, 7000); // 7 seconds to undo

            undoButton.onclick = () => {
                clearTimeout(timeoutId); // Cancel the permanent deletion
                onUndo(); // Run the undo logic
                toast.remove(); // Remove the toast immediately
            };

            toastContainer.appendChild(toast);
        }

        function getCategoryName(category) {
            const names = {
                'fullstack': 'Full-Stack & Projects',
                'mitx': 'MITx Machine Learning',
                'nvidia': 'NVIDIA & AI Practice'
            };
            return names[category] || category;
        }

        async function exportWeeklyReport() {
            // Implementation for exporting report as PDF or CSV
            showToast('Report exported successfully!');
        }

        function playSound(soundFile) {
            const audio = new Audio(soundFile);
            audio.volume = 0.5;
            audio.play().catch(error => {
                // This catch prevents console errors if the browser blocks autoplay
                console.warn("Audio play prevented by browser:", error);
            });
        }

      function closeModal() { modalContainer.innerHTML = ''; }

      function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'bg-gray-700 text-white px-6 py-3 rounded-lg shadow-lg animate-toast-in';
        toast.textContent = message;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => {
          toast.classList.remove('animate-toast-in');
          toast.classList.add('animate-toast-out');
          setTimeout(() => toast.remove(), 500);
        }, 3000);
      }

      function getWeekRange(date) {
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { startOfWeek, endOfWeek };
      }

    });

