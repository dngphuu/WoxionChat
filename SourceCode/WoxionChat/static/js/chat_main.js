/**
 * WoxionChat - Main Orchestration Entrypoint
 * Coordinates user input, message sending, layout toggling, and initial page load.
 */

let ongoingChatRequest = null;
let heartbeatInterval = null;

// ==================== Sidebar Navigation Tabs ==================== //

function switchSidebarTab(tabName) {
    const tabBtns = document.querySelectorAll('.sidebar-tab-btn');
    tabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const threadsView = document.getElementById('sidebarThreadsView');
    const documentsView = document.getElementById('sidebarDocumentsView');

    if (tabName === 'threads') {
        if (threadsView) threadsView.style.display = 'flex';
        if (documentsView) documentsView.style.display = 'none';
    } else {
        if (threadsView) threadsView.style.display = 'none';
        if (documentsView) documentsView.style.display = 'flex';
    }
}

// ==================== Studio Tabs ==================== //

function switchStudioTab(tabName) {
    const tabs = document.querySelectorAll('.studio-tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const tabContents = document.querySelectorAll('.studio-tab-content');
    tabContents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    const target = document.getElementById(`${tabName}Tab`);
    if (target) {
        target.style.display = (tabName === 'ace') ? 'block' : 'block';
        target.classList.add('active');
    }

    if (tabName === 'notes') fetchNotes();
    if (tabName === 'saved') renderSavedMessages();
    if (tabName === 'ace') loadAcePlaybook(false);
}

// ==================== Layout Toggles ==================== //

function toggleSourcePanel() {
    const sourcePanel = document.querySelector('.source-panel');
    const collapseBtn = document.querySelector('.collapse-btn i');
    if (!sourcePanel) return;

    if (sourcePanel.classList.contains('collapsed')) {
        sourcePanel.classList.remove('collapsed');
        if (collapseBtn) {
            collapseBtn.classList.remove('fa-chevron-right');
            collapseBtn.classList.add('fa-chevron-left');
        }
    } else {
        sourcePanel.classList.add('collapsed');
        if (collapseBtn) {
            collapseBtn.classList.remove('fa-chevron-left');
            collapseBtn.classList.add('fa-chevron-right');
        }
    }
}

function toggleStudioPanel() {
    const studioPanel = document.getElementById('studioPanel');
    const collapseBtn = document.querySelector('.studio-collapse-btn i');
    if (!studioPanel) return;

    if (studioPanel.classList.contains('collapsed')) {
        studioPanel.classList.remove('collapsed');
        if (collapseBtn) {
            collapseBtn.classList.remove('fa-chevron-left');
            collapseBtn.classList.add('fa-chevron-right');
        }
    } else {
        studioPanel.classList.add('collapsed');
        if (collapseBtn) {
            collapseBtn.classList.remove('fa-chevron-right');
            collapseBtn.classList.add('fa-chevron-left');
        }
    }
}

// ==================== Send Message Flow ==================== //

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Clear input
    input.value = '';

    // Render user message on UI and add to active thread
    addUserMessage(message);
    ChatThreads.addMessage('user', message);

    // Show thinking indicator
    showThinkingIndicator();

    const username = getCurrentUsername();
    const payload = {
        message: message,
        user_id: username
    };

    if (selectedUserData) {
        payload.selected_document = selectedUserData.source_file || selectedUserData.title;
    }

    const controller = new AbortController();
    ongoingChatRequest = controller;

    try {
        const response = await ChatAPI.sendChat(payload, controller.signal);
        hideThinkingIndicator();

        if (response.ok) {
            const result = await response.json();
            const botAnswer = result.response || result.message || result.answer || '✅ Đã nhận phản hồi từ WoxionChat.';
            const sources = result.sources || [];
            const context = result.context || null;

            // Render bot message with typewriter effect
            addBotMessageWithTypewriter(botAnswer, {
                instant: false,
                sources: sources,
                context: context
            });

            // Save bot message to thread
            ChatThreads.addMessage('bot', botAnswer, {
                sources: sources,
                context: context
            });

        } else {
            const errorText = await response.text();
            let errorMsg = `Lỗi từ server (${response.status}): ${response.statusText}`;
            try {
                const parsed = JSON.parse(errorText);
                if (parsed.detail) errorMsg = parsed.detail;
                else if (parsed.error) errorMsg = parsed.error;
            } catch (e) {}

            addBotMessageWithTypewriter(`⚠️ **Lỗi:** ${errorMsg}`, { instant: true });
            showErrorNotification('Lỗi phản hồi', errorMsg);
        }

    } catch (err) {
        hideThinkingIndicator();
        if (err.name === 'AbortError') {
            console.log('Chat request was aborted.');
            addBotMessageWithTypewriter('⏹️ *Đã dừng sinh phản hồi.*', { instant: true });
        } else {
            console.error('Chat error:', err);
            addBotMessageWithTypewriter(`❌ **Lỗi kết nối:** ${err.message}`, { instant: true });
            showErrorNotification('Lỗi kết nối', err.message);
        }
    } finally {
        ongoingChatRequest = null;
    }
}

// ==================== Heartbeat ==================== //

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
        try {
            await ChatAPI.checkHealth();
        } catch (e) {
            console.warn('Heartbeat check error:', e);
        }
    }, 45000); // Every 45s
}

// ==================== Initialization ==================== //

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 WoxionChat Modernized Frontend Initializing...');

    // 1. Initialize Marked
    initMarked();

    // 2. Initialize Conversation Threads
    ChatThreads.init();

    // 3. Initialize Notes & Saved Messages
    fetchNotes();
    updateStudioSavedCounter();

    // 4. Initialize User Documents
    loadUserDatabase();

    // 5. Initialize ACE Playbook
    loadAcePlaybook(false);

    // 6. Start Heartbeat
    startHeartbeat();

    // 7. Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('studioNoteModal');
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    };

    console.log('✓ WoxionChat Frontend Initialized.');
});
