export class AchievementSystem {
    constructor({ db, uid, confetti, tasksCollection, streakTracker, mainContent }) {
        this.db = db;
        this.uid = uid;
        this.confetti = confetti;
        this.tasksCollection = tasksCollection;
        this.streakTracker = streakTracker;
        this.mainContent = mainContent;
        
        // Static achievements (not tied to specific focus areas)
        this.staticAchievements = {
            'first_week': { 
                id: 'first_week', 
                name: 'Week Warrior', 
                description: 'Complete a 7-day streak', 
                icon: '🔥', 
                category: 'streak', 
                requirement: { type: 'streak', value: 7 }, 
                points: 50, 
                rarity: 'common' 
            },
            'consistency_king': { 
                id: 'consistency_king', 
                name: 'Consistency King', 
                description: 'Maintain a 30-day streak', 
                icon: '👑', 
                category: 'streak', 
                requirement: { type: 'streak', value: 30 }, 
                points: 200, 
                rarity: 'rare' 
            },
            'unstoppable': { 
                id: 'unstoppable', 
                name: 'Unstoppable Force', 
                description: 'Achieve a 100-day streak', 
                icon: '💫', 
                category: 'streak', 
                requirement: { type: 'streak', value: 100 }, 
                points: 500, 
                rarity: 'legendary' 
            },
            'first_task': { 
                id: 'first_task', 
                name: 'Getting Started', 
                description: 'Complete your first task', 
                icon: '🎯', 
                category: 'tasks', 
                requirement: { type: 'tasks_completed', value: 1 }, 
                points: 10, 
                rarity: 'common' 
            },
            'task_master': { 
                id: 'task_master', 
                name: 'Task Master', 
                description: 'Complete 50 tasks', 
                icon: '⚡', 
                category: 'tasks', 
                requirement: { type: 'tasks_completed', value: 50 }, 
                points: 100, 
                rarity: 'uncommon' 
            },
            'centurion': { 
                id: 'centurion', 
                name: 'Centurion', 
                description: 'Complete 100 tasks', 
                icon: '💯', 
                category: 'tasks', 
                requirement: { type: 'tasks_completed', value: 100 }, 
                points: 250, 
                rarity: 'rare' 
            },
            'task_legend': { 
                id: 'task_legend', 
                name: 'Task Legend', 
                description: 'Complete 500 tasks', 
                icon: '🏆', 
                category: 'tasks', 
                requirement: { type: 'tasks_completed', value: 500 }, 
                points: 1000, 
                rarity: 'legendary' 
            },
            'early_bird': { 
                id: 'early_bird', 
                name: 'Early Bird', 
                description: 'Complete a task before 7 AM', 
                icon: '🌅', 
                category: 'special', 
                requirement: { type: 'time_based', condition: 'early_morning' }, 
                points: 30, 
                rarity: 'uncommon' 
            },
            'night_owl': { 
                id: 'night_owl', 
                name: 'Night Owl', 
                description: 'Complete a task after 11 PM', 
                icon: '🦉', 
                category: 'special', 
                requirement: { type: 'time_based', condition: 'late_night' }, 
                points: 30, 
                rarity: 'uncommon' 
            },
            'weekend_warrior': { 
                id: 'weekend_warrior', 
                name: 'Weekend Warrior', 
                description: 'Complete 10 tasks on weekends', 
                icon: '🏖️', 
                category: 'special', 
                requirement: { type: 'weekend_tasks', value: 10 }, 
                points: 50, 
                rarity: 'uncommon' 
            },
            'perfect_week': { 
                id: 'perfect_week', 
                name: 'Perfect Week', 
                description: 'Complete tasks every day for a week', 
                icon: '✨', 
                category: 'special', 
                requirement: { type: 'streak', value: 7 }, 
                points: 75, 
                rarity: 'uncommon' 
            },
        };

        this.achievements = {}; // Will contain static + dynamic achievements
        this.userAchievements = [];
        this.userFocusAreas = [];
        this.achievementSound = new Audio('assets/achievement.mp3');
        this.achievementSound.volume = 0.5;
        
        this.initialize();
    }

    async initialize() {
        await this.loadUserFocusAreas();
        this.generateDynamicAchievements();
        this.achievements = { ...this.staticAchievements, ...this.dynamicAchievements };
        await this.loadUserAchievements();
    }

    async loadUserFocusAreas() {
        try {
            const userDoc = await this.db.collection('users').doc(this.uid).get();
            const userData = userDoc.data();
            this.userFocusAreas = userData?.focusAreas || [];
        } catch (error) {
            console.error('Error loading user focus areas:', error);
            this.userFocusAreas = [];
        }
    }

    generateDynamicAchievements() {
        this.dynamicAchievements = {};
        
        // Icon options for different focus areas (fallback to default if not matched)
        const iconMap = {
            'development': '💻',
            'coding': '⌨️',
            'design': '🎨',
            'business': '💼',
            'fitness': '💪',
            'health': '🏥',
            'learning': '📚',
            'language': '🗣️',
            'music': '🎵',
            'writing': '✍️',
            'reading': '📖',
            'ai': '🤖',
            'ml': '🧠',
            'data': '📊',
        };

        const getIconForFocusArea = (areaName) => {
            const lowerName = areaName.toLowerCase();
            for (const [key, icon] of Object.entries(iconMap)) {
                if (lowerName.includes(key)) return icon;
            }
            return '🎯'; // Default icon
        };

        this.userFocusAreas.forEach((focusArea, index) => {
            const focusAreaId = focusArea.id || focusArea.name?.toLowerCase().replace(/\s+/g, '_');
            const focusAreaName = focusArea.name || focusArea;
            const icon = focusArea.icon || getIconForFocusArea(focusAreaName);

            // Beginner achievement - 10 tasks
            this.dynamicAchievements[`${focusAreaId}_beginner`] = {
                id: `${focusAreaId}_beginner`,
                name: `${focusAreaName} Beginner`,
                description: `Complete 10 tasks in ${focusAreaName}`,
                icon: icon,
                category: 'category',
                requirement: { 
                    type: 'category_tasks', 
                    category: focusAreaId, 
                    value: 10 
                },
                points: 50,
                rarity: 'common'
            };

            // Enthusiast achievement - 25 tasks
            this.dynamicAchievements[`${focusAreaId}_enthusiast`] = {
                id: `${focusAreaId}_enthusiast`,
                name: `${focusAreaName} Enthusiast`,
                description: `Complete 25 tasks in ${focusAreaName}`,
                icon: icon,
                category: 'category',
                requirement: { 
                    type: 'category_tasks', 
                    category: focusAreaId, 
                    value: 25 
                },
                points: 100,
                rarity: 'uncommon'
            };

            // Expert achievement - 50 tasks
            this.dynamicAchievements[`${focusAreaId}_expert`] = {
                id: `${focusAreaId}_expert`,
                name: `${focusAreaName} Expert`,
                description: `Complete 50 tasks in ${focusAreaName}`,
                icon: icon,
                category: 'category',
                requirement: { 
                    type: 'category_tasks', 
                    category: focusAreaId, 
                    value: 50 
                },
                points: 200,
                rarity: 'rare'
            };

            // Hours achievement - 25 hours
            this.dynamicAchievements[`${focusAreaId}_dedicated`] = {
                id: `${focusAreaId}_dedicated`,
                name: `${focusAreaName} Dedicated`,
                description: `Log 25 hours in ${focusAreaName}`,
                icon: icon,
                category: 'category',
                requirement: { 
                    type: 'category_hours', 
                    category: focusAreaId, 
                    value: 25 
                },
                points: 150,
                rarity: 'uncommon'
            };

            // Hours achievement - 50 hours
            this.dynamicAchievements[`${focusAreaId}_master`] = {
                id: `${focusAreaId}_master`,
                name: `${focusAreaName} Master`,
                description: `Log 50 hours in ${focusAreaName}`,
                icon: icon,
                category: 'category',
                requirement: { 
                    type: 'category_hours', 
                    category: focusAreaId, 
                    value: 50 
                },
                points: 300,
                rarity: 'rare'
            };

            // Hours achievement - 100 hours
            this.dynamicAchievements[`${focusAreaId}_legend`] = {
                id: `${focusAreaId}_legend`,
                name: `${focusAreaName} Legend`,
                description: `Log 100 hours in ${focusAreaName}`,
                icon: icon,
                category: 'category',
                requirement: { 
                    type: 'category_hours', 
                    category: focusAreaId, 
                    value: 100 
                },
                points: 500,
                rarity: 'legendary'
            };
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
            
            case 'weekend_tasks': {
                if (trigger !== 'task_complete') return false;
                const snapshot = await this.tasksCollection
                    .where('completed', '==', true)
                    .get();
                
                let weekendCount = 0;
                snapshot.forEach(doc => {
                    const taskData = doc.data();
                    if (taskData.completedAt) {
                        const completedDate = taskData.completedAt.toDate();
                        const day = completedDate.getDay();
                        if (day === 0 || day === 6) weekendCount++; // Sunday = 0, Saturday = 6
                    }
                });
                return weekendCount >= req.value;
            }
            
            case 'category_tasks': {
                if (trigger !== 'task_complete') return false;
                const snapshot = await this.tasksCollection
                    .where('completed', '==', true)
                    .where('category', '==', req.category)
                    .get();
                return snapshot.size >= req.value;
            }
            
            case 'category_hours': {
                if (trigger !== 'task_complete') return false;
                const snapshot = await this.tasksCollection
                    .where('completed', '==', true)
                    .where('category', '==', req.category)
                    .get();
                
                let totalHours = 0;
                snapshot.forEach(doc => {
                    const taskData = doc.data();
                    if (taskData.timeSpent) {
                        totalHours += taskData.timeSpent / 60; // Convert minutes to hours
                    }
                });
                return totalHours >= req.value;
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