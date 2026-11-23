/**
 * WoxionChat - User Database & Documents Module
 * Handles loading files, chunking status checks, search/filter, and selecting documents for context.
 */

let userDatabaseCache = [];
let selectedUserData = null;

async function loadUserDatabase() {
    const listEl = document.getElementById('userDatabaseList');
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="loading-indicator">
            <i class="fas fa-spinner fa-spin"></i> Đang tải dữ liệu...
        </div>`;

    const username = getCurrentUsername();
    try {
        const result = await ChatAPI.fetchUserDatabase(username);
        if (result && result.success && result.data) {
            userDatabaseCache = result.data;
            renderUserDatabase(userDatabaseCache);
        } else {
            listEl.innerHTML = `
                <div class="empty-state" style="padding: 20px; text-align: center; color: #94a3b8;">
                    <i class="fas fa-folder-open mb-2" style="font-size: 1.6rem; display:block;"></i>
                    Không có tài liệu nào
                </div>`;
        }
    } catch (err) {
        console.error('Error loading user database:', err);
        listEl.innerHTML = `
            <div class="error-state" style="padding: 16px; text-align: center; color: #ef4444; font-size: 0.82rem;">
                <i class="fas fa-exclamation-circle mb-1"></i> Lỗi tải tài liệu
            </div>`;
    }
}

function renderUserDatabase(documents) {
    const listEl = document.getElementById('userDatabaseList');
    if (!listEl) return;

    if (!documents || documents.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 0.82rem;">
                <i class="fas fa-folder-open mb-2" style="font-size: 1.8rem; display:block;"></i>
                Chưa có tài liệu tải lên
            </div>`;
        return;
    }

    let html = '';
    documents.forEach((doc, idx) => {
        const isSelected = selectedUserData && selectedUserData.id === doc.id;
        const fileName = doc.title || doc.file_name || `Tài liệu ${idx + 1}`;
        const chunkStatus = doc.chunked ? '<span class="badge bg-success ms-1">Đã chunk</span>' : '';

        html += `
        <div class="source-file-item ${isSelected ? 'selected' : ''}" onclick="toggleDocumentSelection('${doc.id}')" style="padding: 8px 10px; border-radius: 8px; margin-bottom: 6px; cursor: pointer; border: 1px solid ${isSelected ? '#10a37f' : '#e2e8f0'}; background: ${isSelected ? 'rgba(16, 163, 127, 0.05)' : '#fff'}; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                <i class="fas fa-file-alt" style="color: #10a37f; flex-shrink: 0;"></i>
                <span style="font-size: 0.82rem; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${fileName}">
                    ${fileName}
                </span>
            </div>
            ${chunkStatus}
        </div>`;
    });

    listEl.innerHTML = html;
}

function updateActiveDocBanner() {
    const banner = document.getElementById('activeDocBanner');
    const nameEl = document.getElementById('activeDocName');
    if (!banner || !nameEl) return;

    if (selectedUserData) {
        const name = selectedUserData.title || selectedUserData.file_name || selectedUserData.source_file || 'Tài liệu đã chọn';
        nameEl.textContent = name;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
        nameEl.textContent = '';
    }
}

function clearSelectedDocument() {
    selectedUserData = null;
    updateActiveDocBanner();
    renderUserDatabase(userDatabaseCache);
    showInfoNotification('Bỏ chọn tài liệu', 'Đã chuyển sang chế độ tìm kiếm toàn bộ tài liệu.');
}

function toggleDocumentSelection(docId) {
    const doc = userDatabaseCache.find(d => d.id === docId);
    if (!doc) return;

    if (selectedUserData && selectedUserData.id === docId) {
        selectedUserData = null;
        showInfoNotification('Bỏ chọn tài liệu', 'Đã chuyển sang chế độ tìm kiếm toàn bộ tài liệu.');
    } else {
        selectedUserData = doc;
        showSuccessNotification('Đã chọn tài liệu', doc.title || doc.file_name);
    }
    updateActiveDocBanner();
    renderUserDatabase(userDatabaseCache);
}
