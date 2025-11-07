import { db } from './firebase.js';
import { StreakTracker } from './streak.js';
import { AchievementSystem } from './achievements.js';
import { showToast } from './utils.js';

/**
 * Handles marking a task complete, updating streak + denormalized stats,
 * and triggering AchievementSystem for instant unlocks.
 *
 * @param {object} params
 * @param {string} params.uid - User ID
 * @param {string} params.taskId - Task document ID
 * @param {object} params.taskData - { category, timeSpent, ... } optional
 * @param {object} params.confetti - Confetti function instance
 * @param {HTMLElement} params.mainContent - Main content container (for achievements)
 * @param {firebase.firestore.CollectionReference} params.tasksCollection - Reference to user’s tasks
 */
export async function completeTask({
    uid,
    taskId,
    taskData = {},
    confetti,
    mainContent,
    tasksCollection
}) {
    try {
        const now = new Date();
        const category = (taskData.category || 'general').toLowerCase().replace(/\s+/g, '_');
        const timeSpent = taskData.timeSpent || 0;

        // 1️⃣ Update the task document
        const taskRef = db.collection('users').doc(uid).collection('tasks').doc(taskId);
        await taskRef.update({
            completed: true,
            completedAt: now,
            ...(timeSpent && { timeSpent }),
            ...(category && { category }),
        });

        // 2️⃣ Update streak
        const streakTracker = new StreakTracker(uid);
        const streakResult = await streakTracker.updateStreak();

        // 3️⃣ Update denormalized stats
        const updatedStats = await updateUserStats(uid, {
            category,
            timeSpentMinutes: timeSpent,
            completedAt: now,
            streak: streakResult?.streak || 0
        });

        // 4️⃣ Initialize AchievementSystem (auto-loads focus areas & stats)
        const achievementSystem = new AchievementSystem({
            db,
            uid,
            confetti,
            tasksCollection,
            streakTracker,
            mainContent
        });

        // Wait for initialization to complete before checking
        await new Promise(resolve => setTimeout(resolve, 500)); // small buffer for Firestore listeners

        // 5️⃣ Check for achievements triggered by this task
        const newAchievements = await achievementSystem.checkAchievements('task_complete', {
            stats: updatedStats, // <-- Pass the *entire* stats object
            taskTime: now        // <-- Pass the completion time
        });

        // 6️⃣ Show feedback
        const msg = [`✅ Task completed!`];
        if (streakResult?.message) msg.push(streakResult.message);
        if (newAchievements.length > 0) msg.push(`🏅 ${newAchievements.length} new achievement${newAchievements.length > 1 ? 's' : ''}!`);
        showToast(msg.join(' '));

        return {
            success: true,
            streak: streakResult?.streak,
            newAchievements
        };

    } catch (error) {
        console.error('Error completing task:', error);
        showToast('⚠️ Failed to complete task. Try again.');
        return { success: false, error };
    }
}

/**
 * Denormalized stats updater (used inside completeTask)
 * Updates users/{uid}/meta/stats for AchievementSystem
 */
async function updateUserStats(uid, { category = 'general', timeSpentMinutes = 0, completedAt = new Date(), streak = 0 }) {
    const statsRef = db.collection('users').doc(uid).collection('meta').doc('stats');

    await db.runTransaction(async tx => {
        const snap = await tx.get(statsRef);
        let stats = snap.exists ? snap.data() : {
            tasksCompleted: 0,
            tasksByCategory: {},
            hoursByCategory: {},
            weekendTasks: 0,
            streak: 0
        };

        // increment totals
        stats.tasksCompleted = (stats.tasksCompleted || 0) + 1;

        // increment category task count
        stats.tasksByCategory = stats.tasksByCategory || {};
        stats.tasksByCategory[category] = (stats.tasksByCategory[category] || 0) + 1;

        // increment category hours
        stats.hoursByCategory = stats.hoursByCategory || {};
        if (timeSpentMinutes) {
            const deltaHours = timeSpentMinutes / 60;
            stats.hoursByCategory[category] = (stats.hoursByCategory[category] || 0) + deltaHours;
        }

        // weekend tracking
        const day = completedAt instanceof Date ? completedAt.getDay() : new Date(completedAt).getDay();
        if (day === 0 || day === 6) {
            stats.weekendTasks = (stats.weekendTasks || 0) + 1;
        }

        // sync streak from streak tracker
        stats.streak = streak || stats.streak || 0;

        tx.set(statsRef, stats, { merge: true });
    });

    const finalSnap = await statsRef.get();
    return finalSnap.data();
}
