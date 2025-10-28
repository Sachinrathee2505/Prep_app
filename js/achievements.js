
export class AchievementSystem {
    constructor({ db, uid, confetti, tasksCollection, streakTracker, mainContent }) {
        this.db = db;
        this.uid = uid;
        this.confetti = confetti;
        this.tasksCollection = tasksCollection; // For checking requirements
        this.streakTracker = streakTracker;
        this.mainContent = mainContent;
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
        this.mainContent.innerHTML = `
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