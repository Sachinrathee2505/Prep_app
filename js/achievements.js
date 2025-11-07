export class AchievementSystem {
    constructor({ db, uid, confetti, tasksCollection, streakTracker, mainContent }) {
        this.db = db;
        this.uid = uid;
        this.confetti = confetti;
        this.tasksCollection = tasksCollection;
        this.streakTracker = streakTracker;
        this.mainContent = mainContent;

        this.staticAchievements = this.getStaticAchievements();
        this.dynamicAchievements = {};
        this.achievements = {};
        this.userAchievements = [];
        this.userFocusAreas = [];

        this.achievementSound = new Audio('assets/achievement.mp3');
        this.achievementSound.volume = 0.5;

        this.initialize(); // auto async init
    }

    async initialize() {
        try {
            await this.loadUserFocusAreas();
            this.generateDynamicAchievements();
            this.achievements = { ...this.staticAchievements, ...this.dynamicAchievements };
            await this.loadUserAchievements();
        } catch (error) {
            console.error('Error initializing AchievementSystem:', error);
        }
    }

    // 🧩 Normalize and load user's focus areas
    async loadUserFocusAreas() {
        try {
            const userDoc = await this.db.collection('users').doc(this.uid).get();
            const raw = userDoc.exists ? (userDoc.data()?.focusAreas || []) : [];

            // normalize all possible formats → [{ id, name, icon }]
            this.userFocusAreas = Array.isArray(raw)
                ? raw.map((area, i) => {
                    if (typeof area === 'string') {
                        const clean = area.trim();
                        return { id: clean.toLowerCase().replace(/\s+/g, '_'), name: clean };
                    }
                    if (area && typeof area === 'object') {
                        const name = area.name || `Focus ${i + 1}`;
                        const id = (area.id || name).toLowerCase().replace(/\s+/g, '_');
                        return { id, name, icon: area.icon || null };
                    }
                    return null;
                }).filter(Boolean)
                : [];
        } catch (error) {
            console.error('Error loading user focus areas:', error);
            this.userFocusAreas = [];
        }
    }

    // 🎯 Define static/global achievements
    getStaticAchievements() {
        return {
            'first_week': { id: 'first_week', name: 'Week Warrior', description: 'Complete a 7-day streak', icon: '🔥', category: 'streak', requirement: { type: 'streak', value: 7 }, points: 50, rarity: 'common' },
            'consistency_king': { id: 'consistency_king', name: 'Consistency King', description: 'Maintain a 30-day streak', icon: '👑', category: 'streak', requirement: { type: 'streak', value: 30 }, points: 200, rarity: 'rare' },
            'unstoppable': { id: 'unstoppable', name: 'Unstoppable Force', description: 'Achieve a 100-day streak', icon: '💫', category: 'streak', requirement: { type: 'streak', value: 100 }, points: 500, rarity: 'legendary' },
            'first_task': { id: 'first_task', name: 'Getting Started', description: 'Complete your first task', icon: '🎯', category: 'tasks', requirement: { type: 'tasks_completed', value: 1 }, points: 10, rarity: 'common' },
            'task_master': { id: 'task_master', name: 'Task Master', description: 'Complete 50 tasks', icon: '⚡', category: 'tasks', requirement: { type: 'tasks_completed', value: 50 }, points: 100, rarity: 'uncommon' },
            'centurion': { id: 'centurion', name: 'Centurion', description: 'Complete 100 tasks', icon: '💯', category: 'tasks', requirement: { type: 'tasks_completed', value: 100 }, points: 250, rarity: 'rare' },
            'task_legend': { id: 'task_legend', name: 'Task Legend', description: 'Complete 500 tasks', icon: '🏆', category: 'tasks', requirement: { type: 'tasks_completed', value: 500 }, points: 1000, rarity: 'legendary' },
            'early_bird': { id: 'early_bird', name: 'Early Bird', description: 'Complete a task before 7 AM', icon: '🌅', category: 'special', requirement: { type: 'time_based', condition: 'early_morning' }, points: 30, rarity: 'uncommon' },
            'night_owl': { id: 'night_owl', name: 'Night Owl', description: 'Complete a task after 11 PM', icon: '🦉', category: 'special', requirement: { type: 'time_based', condition: 'late_night' }, points: 30, rarity: 'uncommon' },
            'weekend_warrior': { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Complete 10 tasks on weekends', icon: '🏖️', category: 'special', requirement: { type: 'weekend_tasks', value: 10 }, points: 50, rarity: 'uncommon' },
        };
    }

    // 💡 Generate dynamic focus area-based achievements
    generateDynamicAchievements() {
        this.dynamicAchievements = {};

        const iconMap = {
            development: '💻', coding: '⌨️', design: '🎨', business: '💼',
            fitness: '💪', health: '🏥', learning: '📚', language: '🗣️',
            music: '🎵', writing: '✍️', reading: '📖', ai: '🤖', ml: '🧠', data: '📊'
        };

        const getIcon = (name) => {
            const lower = name.toLowerCase();
            for (const [key, icon] of Object.entries(iconMap)) {
                if (lower.includes(key)) return icon;
            }
            return '🎯';
        };

        this.userFocusAreas.forEach((area) => {
            const { id, name, icon } = area;
            const emoji = icon || getIcon(name);

            const taskLevels = [
                { suffix: 'beginner', label: 'Beginner', value: 10, points: 50, rarity: 'common' },
                { suffix: 'enthusiast', label: 'Enthusiast', value: 25, points: 100, rarity: 'uncommon' },
                { suffix: 'expert', label: 'Expert', value: 50, points: 200, rarity: 'rare' },
            ];

            const hourLevels = [
                { suffix: 'dedicated', label: 'Dedicated', value: 25, points: 150, rarity: 'uncommon' },
                { suffix: 'master', label: 'Master', value: 50, points: 300, rarity: 'rare' },
                { suffix: 'legend', label: 'Legend', value: 100, points: 500, rarity: 'legendary' },
            ];

            taskLevels.forEach(lvl => {
                this.dynamicAchievements[`${id}_${lvl.suffix}`] = {
                    id: `${id}_${lvl.suffix}`,
                    name: `${name} ${lvl.label}`,
                    description: `Complete ${lvl.value} tasks in ${name}`,
                    icon: emoji,
                    category: 'category',
                    requirement: { type: 'category_tasks', category: id, value: lvl.value },
                    points: lvl.points,
                    rarity: lvl.rarity
                };
            });

            hourLevels.forEach(lvl => {
                this.dynamicAchievements[`${id}_${lvl.suffix}`] = {
                    id: `${id}_${lvl.suffix}`,
                    name: `${name} ${lvl.label}`,
                    description: `Log ${lvl.value} hours in ${name}`,
                    icon: emoji,
                    category: 'category',
                    requirement: { type: 'category_hours', category: id, value: lvl.value },
                    points: lvl.points,
                    rarity: lvl.rarity
                };
            });
        });
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

    checkRequirement(achievement, trigger, data) {
        const req = achievement.requirement;
        const stats = data.stats || {}; // Get the stats object you just passed in!

        // Get the time of the task that was just completed
        const taskTime = data.taskTime || new Date(); 

        switch (req.type) {
            case 'streak':
                // Check the streak from the stats object
                return trigger === 'streak_update' && stats.streak >= req.value;
            
            case 'tasks_completed': {
                // No query! Just check the counter.
                return trigger === 'task_complete' && stats.tasksCompleted >= req.value;
            }
            
            case 'time_based': {
                if (trigger !== 'task_complete') return false;
                const hour = taskTime.getHours(); // Use the time from the data object
                if (req.condition === 'early_morning') return hour < 7;
                if (req.condition === 'late_night') return hour >= 23;
                return false;
            }
            
            case 'weekend_tasks': {
                // No query! Just check the counter.
                return trigger === 'task_complete' && stats.weekendTasks >= req.value;
            }
            
            case 'category_tasks': {
                // No query! Just check the counter for that specific category.
                const categoryCount = stats.tasksByCategory?.[req.category] || 0;
                return trigger === 'task_complete' && categoryCount >= req.value;
            }
            
            case 'category_hours': {
                // No query!
                const categoryHours = stats.hoursByCategory?.[req.category] || 0;
                return trigger === 'task_complete' && categoryHours >= req.value;
            }
            
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
            this.confetti({ 
                particleCount: 200, 
                spread: 100, 
                origin: { y: 0.6 }, 
                colors: ['#FFD700', '#FFA500', '#FF6347'] 
            });
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
        await this.loadUserAchievements();
        const totalPoints = await this.calculateTotalPoints();
        const unlockedCount = this.userAchievements.length;
        const totalCount = Object.keys(this.achievements).length;
        
        this.mainContent.innerHTML = `
            <div class="achievements-page">
                <div class="achievements-header">
                    <h1 class="text-3xl font-bold mb-4 text-white">Achievements & Badges</h1>
                    <div class="stats-bar">
                        <div class="stat">
                            <span class="stat-value">${unlockedCount}/${totalCount}</span>
                            <span class="stat-label">Unlocked</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${totalPoints}</span>
                            <span class="stat-label">Total Points</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${this.getPlayerLevel(totalPoints).name}</span>
                            <span class="stat-label">Level</span>
                        </div>
                    </div>
                </div>
                <div class="achievements-categories">${this.renderAchievementsByCategory()}</div>
            </div>`;
    }
     
    renderAchievementsByCategory() {
        const categories = {
            streak: { name: 'Streak Masters', icon: '🔥' },
            tasks: { name: 'Task Champions', icon: '✅' },
            category: { name: 'Focus Area Mastery', icon: '🎯' },
            special: { name: 'Special Achievements', icon: '⭐' }
        };
        
        return Object.entries(categories).map(([catId, catInfo]) => {
            const achievements = Object.values(this.achievements).filter(a => a.category === catId);
            if (achievements.length === 0) return ''; // Don't show empty categories
            
            return `
                <div class="achievement-category">
                    <h2 class="category-title">
                        <span class="category-icon">${catInfo.icon}</span> ${catInfo.name}
                    </h2>
                    <div class="achievements-grid">
                        ${achievements.map(a => this.renderAchievementCard(a)).join('')}
                    </div>
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
            { min: 0, name: 'Novice' }, 
            { min: 100, name: 'Apprentice' }, 
            { min: 300, name: 'Journeyman' },
            { min: 600, name: 'Expert' }, 
            { min: 1000, name: 'Master' }, 
            { min: 1500, name: 'Grandmaster' }, 
            { min: 2000, name: 'Legend' }
        ];
        return levels.slice().reverse().find(l => points >= l.min) || { name: 'Novice' };
    }
}