/**
 * WoxionChat - Conversation Threads Manager
 * Persists and switches multiple conversation threads per user in LocalStorage.
 */

const ChatThreads = {
    threads: [],
    activeThreadId: null,

    getStorageKey() {
        const username = getCurrentUsername();
        return `woxion_chat_threads_${username}`;
    },

    getActiveKey() {
        const username = getCurrentUsername();
        return `woxion_active_thread_${username}`;
    },

    init() {
        this.loadThreads();
        if (this.threads.length === 0) {
            this.createThread('Cuộc trò chuyện mới', false);
        } else {
            const savedActiveId = localStorage.getItem(this.getActiveKey());
            const exists = this.threads.find(t => t.id === savedActiveId);
            this.activeThreadId = exists ? savedActiveId : this.threads[0].id;
        }
        this.renderThreadList();
        this.renderActiveThreadMessages();
    },

    loadThreads() {
        try {
            const raw = localStorage.getItem(this.getStorageKey());
            this.threads = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Error loading threads:', e);
            this.threads = [];
        }
    },

    saveThreads() {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.threads));
            if (this.activeThreadId) {
                localStorage.setItem(this.getActiveKey(), this.activeThreadId);
            }
        } catch (e) {
            console.error('Error saving threads:', e);
        }
    },

    getActiveThread() {
        return this.threads.find(t => t.id === this.activeThreadId) || null;
    },

    createThread(initialTitle = 'Cuộc trò chuyện mới', switchImmediately = true) {
        const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newThread = {
            id: threadId,
            title: initialTitle,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: []
        };
        this.threads.unshift(newThread);
        this.saveThreads();

        if (switchImmediately) {
            this.switchThread(threadId);
        }
        return newThread;
    },

    switchThread(threadId) {
        const target = this.threads.find(t => t.id === threadId);
        if (!target) return;

        this.activeThreadId = threadId;
        this.saveThreads();
        this.renderThreadList();
        this.renderActiveThreadMessages();
        showInfoNotification('Đã chuyển cuộc trò chuyện', target.title);
    },

    deleteThread(threadId, event) {
        if (event) event.stopPropagation();
        if (!confirm('Bạn có chắc chắn muốn xóa cuộc trò chuyện này?')) return;

        this.threads = this.threads.filter(t => t.id !== threadId);
        if (this.activeThreadId === threadId) {
            this.activeThreadId = this.threads.length > 0 ? this.threads[0].id : null;
        }

        if (this.threads.length === 0) {
            this.createThread('Cuộc trò chuyện mới', true);
        } else {
            this.saveThreads();
            this.renderThreadList();
            this.renderActiveThreadMessages();
        }
        showSuccessNotification('Đã xóa cuộc trò chuyện');
    },

    addMessage(role, content, options = {}) {
        let active = this.getActiveThread();
        if (!active) {
            active = this.createThread('Cuộc trò chuyện mới', true);
        }

        // Auto-update thread title from the first user question
        if (role === 'user' && (active.messages.length === 0 || active.title === 'Cuộc trò chuyện mới')) {
            const shortTitle = content.trim().substring(0, 32) + (content.length > 32 ? '...' : '');
            active.title = shortTitle || 'Cuộc trò chuyện';
        }

        const msgObj = {
            id: options.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            role: role,
            content: content,
            sources: options.sources || null,
            context: options.context || null,
            citations: options.citations || null,
            timeString: options.timeString || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date().toISOString()
        };

        active.messages.push(msgObj);
        active.updatedAt = new Date().toISOString();
        this.saveThreads();
        this.renderThreadList();
    },

    renderThreadList() {
        const container = document.getElementById('threadsContainer');
        if (!container) return;

        if (this.threads.length === 0) {
            container.innerHTML = `
                <div class="threads-empty">
                    <i class="far fa-comments"></i>
                    <p>Chưa có đoạn chat nào</p>
                </div>`;
            return;
        }

        let html = '';
        this.threads.forEach(t => {
            const isActive = t.id === this.activeThreadId;
            const msgCount = t.messages ? t.messages.length : 0;
            html += `
            <div class="thread-item ${isActive ? 'active' : ''}" onclick="ChatThreads.switchThread('${t.id}')">
                <div class="thread-content">
                    <i class="far fa-comment-dots thread-icon"></i>
                    <span class="thread-title" title="${t.title}">${t.title}</span>
                </div>
                <div class="thread-actions">
                    <button class="thread-action-btn" onclick="ChatThreads.deleteThread('${t.id}', event)" title="Xóa đoạn chat">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    },

    renderActiveThreadMessages() {
        const chatBody = document.getElementById('chatBody');
        if (!chatBody) return;

        chatBody.innerHTML = '';
        const active = this.getActiveThread();

        if (!active || !active.messages || active.messages.length === 0) {
            // Display default welcome message
            const username = getCurrentUsername();
            chatBody.innerHTML = `
            <div class="message bot">
                <div class="message-content">
                    Xin chào <strong>${username}</strong>, Tôi có thể giúp gì cho bạn?
                </div>
                <div class="message-time">Vừa xong</div>
            </div>`;
            return;
        }

        // Render past messages instantly
        active.messages.forEach(msg => {
            if (msg.role === 'user') {
                addUserMessage(msg.content, msg.timeString);
            } else {
                addBotMessageWithTypewriter(msg.content, {
                    messageId: msg.id,
                    timeString: msg.timeString,
                    instant: true,
                    sources: msg.sources,
                    context: msg.context,
                    citations: msg.citations
                });
            }
        });

        // Restore pin button states
        if (typeof updateStudioSavedCounter === 'function') {
            updateStudioSavedCounter();
        }
    }
};
