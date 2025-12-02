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

function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer?.firstElementChild) {
        if (modalContainer) modalContainer.innerHTML = '';
        return;
    }

    const backdrop = modalContainer.firstElementChild;
    const card = backdrop.querySelector(':scope > div');

    // Animate out
    backdrop.style.transition = 'opacity 200ms ease-out';
    backdrop.style.opacity = '0';

    if (card) {
        card.style.transition = 'all 200ms ease-out';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95) translateY(10px)';
    }

    setTimeout(() => {
        modalContainer.innerHTML = '';
    }, 200);
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

function playSound(soundFile) {
    const audio = new Audio(soundFile);
    audio.volume = 0.5;
    audio.play().catch(error => {
        // This catch prevents console errors if the browser blocks autoplay
        console.warn("Audio play prevented by browser:", error);
    });
}

// 🔥 Helper function to convert hex to rgba
function hexToRgba(hex, alpha = 1) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ✅ Convert seconds to minutes
function convertSecondsToMinutes(seconds) {
    return Math.round(Math.max(0, seconds) / 60);
}

// ✅ Format minutes as "X.X hours"
function formatHours(minutes) {
    const hours = (minutes / 60).toFixed(1);
    return `${hours} hours`;
}

// ✅ Format seconds as "Xh Ym"
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function triggerConfettiAnimation() {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
};

function getCompletionRate(appState) {
    const total = appState.tasks.length;
    if (total === 0) return 0;
    const completed = appState.tasks.filter(t => t.completed).length;
    return Math.round((completed / total) * 100);
};

// ✅ Dynamic category name lookup
function getCategoryName(categoryId, appState) {
    const userProfile = appState.userProfile;
    if (!userProfile || !userProfile.focusAreas) {
        return categoryId;
    }
    const category = userProfile.focusAreas.find(area => area.id === categoryId);
    return category ? category.name : categoryId;
}
function showLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = "flex";
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = "none";
}

export {
    showToast,
    showUndoToast,
    closeModal,
    getWeekRange,
    playSound,
    hexToRgba,
    convertSecondsToMinutes,
    formatHours,
    formatTime,
    triggerConfettiAnimation,
    getCompletionRate,
    getCategoryName,
    showLoadingOverlay,
    hideLoadingOverlay
};