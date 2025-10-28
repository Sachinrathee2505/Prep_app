import { db, firebase } from './firebase.js';
import { showToast } from './utils.js';
export class StreakTracker {
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
            if (typeof window.confetti === 'function') {
                window.confetti({
                    particleCount: Math.min(150 + (days * 2), 300),
                    spread: 90,
                    origin: { y: 0.6 },
                    colors: this.getMilestoneColors(days),
                    shapes: ['square', 'circle'],
                    ticks: 300
                });
            }

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
        const sound = new Audio('assets/achievement.mp3');
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