/**
 * WoxionChat - Studio Notes & Pinned Messages Module
 * Handles CRUD operations for user notes and pinning messages to the studio drawer.
 */

let notes = [];
let editingNoteId = null;

// ==================== Studio Notes CRUD ==================== //

async function fetchNotes() {
    const user = getCurrentUsername();
    try {
        const data = await ChatAPI.getNotes(user);
        if (data.notes) {
            notes = data.notes;
            renderNotes();
        }
    } catch (err) {
        console.error('Lỗi tải ghi chú:', err);
        showErrorNotification('Không thể tải ghi chú', err.message);
    }
}

function renderNotes() {
    const list = document.getElementById('studioNotesList');
    const emptyState = document.getElementById('studioNotesEmpty');
    if (!list) return;

    list.innerHTML = '';
    if (!notes || notes.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    // Sort pinned notes to top
    const sorted = [...notes].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

    sorted.forEach(note => {
        const item = document.createElement('div');
        item.className = 'studio-note-item' + (note.is_pinned ? ' pinned' : '');
        item.onclick = (e) => {
            if (e.target.closest('.studio-note-actions') || e.target.closest('.studio-note-pin')) return;
            showEditNoteForm(note.id);
        };

        const safeTitle = (note.title || 'Ghi chú không tiêu đề')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeContent = (note.content || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const timeStr = note.created_at ? new Date(note.created_at).toLocaleString('vi-VN') : '';

        item.innerHTML = `
            <button class="studio-note-pin ${note.is_pinned ? 'pinned' : ''}" 
                    title="${note.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}"
                    onclick="toggleNotePin('${note.id}', event)">
                <i class="fas fa-thumbtack"></i>
            </button>
            <div class="studio-note-title">${safeTitle}</div>
            <div class="studio-note-snippet">${safeContent}</div>
            <div class="studio-note-date">${timeStr}</div>
            <div class="studio-note-actions">
                <button class="studio-note-action-btn edit" onclick="showEditNoteForm('${note.id}')" title="Sửa">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button class="studio-note-action-btn delete" onclick="deleteNote('${note.id}')" title="Xóa">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function showAddNoteForm() {
    editingNoteId = null;
    const titleEl = document.getElementById('studioNoteModalTitle');
    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    const pinBtn = document.getElementById('pinNoteBtn');
    const modal = document.getElementById('studioNoteModal');

    if (titleEl) titleEl.innerText = 'Thêm ghi chú';
    if (noteTitle) noteTitle.value = '';
    if (noteContent) noteContent.value = '';
    if (pinBtn) pinBtn.classList.remove('pinned');
    if (modal) modal.style.display = 'block';
}

function closeNoteModal() {
    const modal = document.getElementById('studioNoteModal');
    if (modal) modal.style.display = 'none';
}

function showEditNoteForm(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    editingNoteId = id;
    const titleEl = document.getElementById('studioNoteModalTitle');
    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    const pinBtn = document.getElementById('pinNoteBtn');
    const modal = document.getElementById('studioNoteModal');

    if (titleEl) titleEl.innerText = 'Sửa ghi chú';
    if (noteTitle) noteTitle.value = note.title || '';
    if (noteContent) noteContent.value = note.content || '';

    if (pinBtn) {
        if (note.is_pinned) pinBtn.classList.add('pinned');
        else pinBtn.classList.remove('pinned');
    }

    if (modal) modal.style.display = 'block';
}

function togglePinState() {
    const btn = document.getElementById('pinNoteBtn');
    if (btn) btn.classList.toggle('pinned');
}

async function saveNote() {
    const title = (document.getElementById('noteTitle')?.value || '').trim();
    const content = (document.getElementById('noteContent')?.value || '').trim();
    const pinBtn = document.getElementById('pinNoteBtn');
    const isPinned = pinBtn ? pinBtn.classList.contains('pinned') : false;
    const user = getCurrentUsername();

    if (!content) {
        showWarningNotification('Nội dung ghi chú trống', 'Vui lòng nhập nội dung ghi chú.');
        return;
    }

    const payload = { title, content, is_pinned: isPinned, user };

    try {
        let result;
        if (editingNoteId) {
            result = await ChatAPI.editNote(editingNoteId, payload);
        } else {
            result = await ChatAPI.addNote(payload);
        }

        closeNoteModal();
        await fetchNotes();
        showSuccessNotification(editingNoteId ? 'Đã cập nhật ghi chú!' : 'Đã lưu ghi chú!');
    } catch (err) {
        console.error('Lỗi lưu ghi chú:', err);
        showErrorNotification('Lỗi lưu ghi chú', err.message);
    }
}

async function deleteNote(id) {
    if (!confirm('Bạn có chắc muốn xóa ghi chú này?')) return;
    try {
        await ChatAPI.deleteNote(id);
        await fetchNotes();
        showSuccessNotification('Đã xóa ghi chú!');
    } catch (err) {
        console.error('Lỗi xóa ghi chú:', err);
        showErrorNotification('Lỗi xóa ghi chú', err.message);
    }
}

async function toggleNotePin(id, event) {
    if (event) event.stopPropagation();
    const note = notes.find(n => n.id === id);
    if (!note) return;

    try {
        await ChatAPI.editNote(id, {
            title: note.title,
            content: note.content,
            is_pinned: !note.is_pinned,
            user: getCurrentUsername()
        });
        await fetchNotes();
        showSuccessNotification(note.is_pinned ? 'Đã bỏ ghim ghi chú' : 'Đã ghim ghi chú lên đầu');
    } catch (err) {
        console.error('Lỗi toggle pin note:', err);
    }
}

// ==================== Saved / Pinned Chat Messages ==================== //

function getSavedMessages() {
    try {
        const saved = localStorage.getItem('studio_saved_messages');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Error loading saved messages:', e);
        return [];
    }
}

function updateStudioSavedCounter() {
    const saved = getSavedMessages();
    const tabBtn = document.querySelector('.studio-tab[data-tab="saved"]');
    if (tabBtn) {
        tabBtn.innerHTML = `<i class="fas fa-thumbtack"></i> Ghim (${saved.length})`;
    }
    renderSavedMessages();
}

function toggleMessagePin(messageId) {
    const saved = getSavedMessages();
    const exists = saved.some(m => m.id === messageId);
    if (exists) {
        removeMessageFromStudio(messageId);
    } else {
        saveMessageToStudio(messageId);
    }
}

function saveMessageToStudio(messageId) {
    const msgDiv = document.getElementById(messageId);
    if (!msgDiv) return;

    const contentDiv = document.getElementById(`content-${messageId}`);
    const timeDiv = msgDiv.querySelector('.message-time');
    const content = contentDiv ? contentDiv.innerText : '';
    const timeString = timeDiv ? timeDiv.innerText : '';

    const saved = getSavedMessages();
    if (!saved.some(m => m.id === messageId)) {
        saved.push({
            id: messageId,
            content: content,
            time: timeString,
            savedAt: new Date().toISOString()
        });
        localStorage.setItem('studio_saved_messages', JSON.stringify(saved));
    }

    const pinBtn = msgDiv.querySelector('.pin-btn');
    if (pinBtn) {
        pinBtn.classList.add('pinned');
        pinBtn.title = 'Bỏ ghim tin nhắn';
    }

    updateStudioSavedCounter();
    showSuccessNotification('Đã ghim tin nhắn vào Studio!');
}

function removeMessageFromStudio(messageId) {
    let saved = getSavedMessages();
    saved = saved.filter(m => m.id !== messageId);
    localStorage.setItem('studio_saved_messages', JSON.stringify(saved));

    const msgDiv = document.getElementById(messageId);
    if (msgDiv) {
        const pinBtn = msgDiv.querySelector('.pin-btn');
        if (pinBtn) {
            pinBtn.classList.remove('pinned');
            pinBtn.title = 'Ghim tin nhắn';
        }
    }

    updateStudioSavedCounter();
    showInfoNotification('Đã bỏ ghim tin nhắn');
}

function renderSavedMessages() {
    const container = document.getElementById('studioSavedMessages');
    const clearBtn = document.querySelector('.studio-clear-btn');
    if (!container) return;

    const saved = getSavedMessages();
    if (saved.length === 0) {
        container.innerHTML = `
            <div class="studio-empty-state">
                <i class="fas fa-thumbtack"></i>
                <p>Chưa có tin nhắn nào được ghim</p>
                <small>Nhấp vào biểu tượng ghim 📌 ở tin nhắn bot để lưu lại</small>
            </div>`;
        if (clearBtn) clearBtn.disabled = true;
        return;
    }

    if (clearBtn) clearBtn.disabled = false;
    let html = '';
    saved.forEach(msg => {
        const snippet = (msg.content || '').substring(0, 160) + (msg.content.length > 160 ? '...' : '');
        html += `
        <div class="studio-saved-item">
            <div class="studio-saved-header">
                <span class="studio-saved-date">${msg.time || ''}</span>
                <button class="studio-saved-delete" onclick="removeMessageFromStudio('${msg.id}')" title="Bỏ ghim">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="studio-saved-content">${snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>`;
    });
    container.innerHTML = html;
}

function clearAllSavedMessages() {
    if (!confirm('Bạn có chắc muốn xóa tất cả tin nhắn đã ghim?')) return;
    localStorage.removeItem('studio_saved_messages');
    document.querySelectorAll('.pin-btn.pinned').forEach(btn => {
        btn.classList.remove('pinned');
        btn.title = 'Ghim tin nhắn';
    });
    updateStudioSavedCounter();
    showSuccessNotification('Đã xóa tất cả tin nhắn đã ghim');
}
