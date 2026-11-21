/**
 * WoxionChat - API Service Module
 * Handles all network requests, CSRF token retrieval, and error wrapping.
 */

// Helper: retrieve CSRF token
function getCSRFToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue || '';
}

// Backward-compatible alias
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Helper: get current authenticated username
function getCurrentUsername() {
    try {
        const userDataEl = document.getElementById('user-data');
        if (userDataEl) {
            const userData = JSON.parse(userDataEl.textContent);
            if (userData && userData.username) {
                return userData.username;
            }
        }
    } catch (e) {
        console.warn('Error reading user data element:', e);
    }
    const chatPanel = document.querySelector('.chat-panel');
    return (chatPanel && chatPanel.getAttribute('data-username')) || 'default_user';
}

const ChatAPI = {
    /**
     * Send chat query to the agenticRAG backend proxy
     */
    async sendChat(payload, signal = null) {
        const response = await fetch('/chat/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(payload),
            signal: signal
        });
        return response;
    },

    /**
     * Health check endpoint
     */
    async checkHealth() {
        return fetch('/chat/health', {
            method: 'GET',
            headers: { 'X-CSRFToken': getCSRFToken() }
        });
    },

    /**
     * Fetch user database files
     */
    async fetchUserDatabase(username) {
        const url = username 
            ? `/api/user-database/?uploader_username=${encodeURIComponent(username)}`
            : '/api/user-database/';
        const res = await fetch(url, {
            headers: { 'X-CSRFToken': getCSRFToken() }
        });
        return res.json();
    },

    /**
     * Check document chunking status
     */
    async checkChunking(username, sourceFile) {
        let url = `/chunking/documents/?uploader_username=${encodeURIComponent(username)}`;
        if (sourceFile) {
            url += `&source_file=${encodeURIComponent(sourceFile)}`;
        }
        const res = await fetch(url, {
            headers: { 'X-CSRFToken': getCSRFToken() }
        });
        return res.json();
    },

    /**
     * Chunk document API
     */
    async chunkDocument(sourceFile, username) {
        const res = await fetch('/chunking/documents/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                source_file: sourceFile,
                uploader_username: username
            })
        });
        return res.json();
    },

    /**
     * Studio Notes API
     */
    async getNotes(user) {
        const res = await fetch(`/takenote/notes/?user=${encodeURIComponent(user)}`, {
            headers: { 'X-CSRFToken': getCSRFToken() }
        });
        return res.json();
    },

    async addNote(noteData) {
        const res = await fetch('/takenote/notes/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(noteData)
        });
        return res.json();
    },

    async editNote(id, noteData) {
        const res = await fetch(`/takenote/notes/${id}/edit/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(noteData)
        });
        return res.json();
    },

    async deleteNote(id) {
        const res = await fetch(`/takenote/notes/${id}/delete/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCSRFToken() }
        });
        return res.json();
    },

    /**
     * ACE Playbook & Feedback API
     */
    async getAcePlaybook(userId) {
        const res = await fetch(`/chat/ace/playbook?user_id=${encodeURIComponent(userId)}`, {
            headers: { 'X-CSRFToken': getCSRFToken() }
        });
        return res.json();
    },

    async saveAcePlaybook(userId, playbookText, resetToDefault = false) {
        const res = await fetch('/chat/ace/playbook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                playbook: playbookText,
                reset_to_default: resetToDefault
            })
        });
        return res.json();
    },

    async sendAceFeedback(feedbackData) {
        const res = await fetch('/chat/ace/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(feedbackData)
        });
        return res.json();
    }
};
