export class ConnectionManager {
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