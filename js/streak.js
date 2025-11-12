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
        if (!userId) throw new Error('StreakTracker requires a userId');
    }
    normalizeToUtcDay(dateLike) {
        if (!dateLike) return null;
        const d = dateLike.toDate ? dateLike.toDate() : new Date(dateLike);
        const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.floor(ms / msPerDay);
    }

    /**
     * Return number of UTC days between lastDay and todayDay:
     * - 0 => same day
     * - 1 => consecutive (yesterday -> today)
     * - >1 => gap
     * - negative => lastStudy in future (clock skew)
     */
    daysBetweenUtc(lastDate, todayDate) {
        const lastDay = this.normalizeToUtcDay(lastDate);
        const todayDay = this.normalizeToUtcDay(todayDate);
        if (lastDay === null || todayDay === null) return null;
        return todayDay - lastDay; // signed integer
    }

    async updateStreak() {
        try {
            // Use a local Date for display and checks; we'll store serverTimestamp() in Firestore
            const now = new Date();

            // transaction to avoid race conditions
            const result = await db.runTransaction(async (tx) => {
                const doc = await tx.get(this.streakRef);
                const data = doc.exists ? doc.data() : {
                    current: 0,
                    bestStreak: 0,
                    totalDays: 0,
                    milestones: []
                };

                const dayDiff = this.daysBetweenUtc(data.lastStudy, now);

                // If lastStudy exists and is same UTC day -> nothing to do
                if (dayDiff === 0) {
                    // No change
                    return {
                        status: 'unchanged',
                        streak: data.current || 0,
                        message: 'Already logged today'
                    };
                }

                // Prepare common updates: use serverTimestamp for lastStudy, increment totalDays
                const updates = {
                    lastStudy: firebase.firestore.FieldValue.serverTimestamp(),
                    // We'll increment totalDays atomically:
                };

                // If dayDiff === 1 => consecutive
                if (dayDiff === 1) {
                    const newStreak = (data.current || 0) + 1;
                    updates.current = newStreak;
                    updates.bestStreak = Math.max(newStreak, data.bestStreak || 0);

                    // increment totalDays
                    updates.totalDays = firebase.firestore.FieldValue.increment(1);

                    // handle milestone (arrayUnion with server timestamp inside object)
                    const milestoneTitle = this.checkMilestone(newStreak);
                    if (milestoneTitle) {
                        updates.milestones = firebase.firestore.FieldValue.arrayUnion({
                            days: newStreak,
                            achieved: firebase.firestore.FieldValue.serverTimestamp(),
                            title: milestoneTitle
                        });
                    }

                    // Use tx.set with merge to atomically apply updates
                    tx.set(this.streakRef, updates, { merge: true });

                    return {
                        status: 'extended',
                        streak: newStreak,
                        milestone: milestoneTitle,
                        message: `Streak extended to ${newStreak} days!`
                    };
                }

                // If dayDiff === null or dayDiff < 0 or dayDiff > 1 => not consecutive; start new streak = 1
                if (dayDiff === null) {
                    // No lastStudy -> first log
                } else if (dayDiff < 0) {
                    // lastStudy is in future (clock skew). We choose to reset but record a warning
                    console.warn('StreakTracker: lastStudy is in the future compared to client time. Resetting streak.');
                }
                // reset to 1
                updates.current = 1;
                updates.bestStreak = Math.max(data.bestStreak || 0, 1);
                updates.totalDays = firebase.firestore.FieldValue.increment(1);

                tx.set(this.streakRef, updates, { merge: true });

                return {
                    status: 'reset',
                    streak: 1,
                    message: 'New streak started!'
                };
            });

            // Celebrate outside transaction (transaction already committed)
            if (result.status === 'extended') {
                // result.streak exists
                await this.celebrateStreak(result.streak);
            }

            return result;
        } catch (err) {
            console.error('Error updating streak (transaction):', err);
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
