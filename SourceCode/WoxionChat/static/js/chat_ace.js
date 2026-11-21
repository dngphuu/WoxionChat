/**
 * WoxionChat - ACE (Agentic Context Engineering) Playbook & Feedback Module
 */

function showAceCorrectionForm(messageId) {
    const form = document.getElementById(`correction-form-${messageId}`);
    if (form) {
        form.style.display = 'block';
        const input = document.getElementById(`correction-input-${messageId}`);
        if (input) input.focus();
    }
}

function hideAceCorrectionForm(messageId) {
    const form = document.getElementById(`correction-form-${messageId}`);
    if (form) form.style.display = 'none';
}

function submitAceCorrection(messageId) {
    const input = document.getElementById(`correction-input-${messageId}`);
    if (!input) return;
    const correctionText = input.value.trim();
    if (!correctionText) {
        showWarningNotification('Góp ý trống', 'Vui lòng nhập câu trả lời đúng hoặc gợi ý.');
        return;
    }
    hideAceCorrectionForm(messageId);
    sendAceFeedback(messageId, 'thumbs_down', correctionText);
}

async function sendAceFeedback(messageId, rating, correctAnswer = null) {
    const userId = getCurrentUsername();
    const botMessageDiv = document.getElementById(messageId);
    if (!botMessageDiv) return;

    const contentDiv = document.getElementById(`content-${messageId}`);
    const botResponse = contentDiv ? contentDiv.innerText : '';

    // Find preceding user question
    let userQuery = '';
    let prev = botMessageDiv.previousElementSibling;
    while (prev) {
        if (prev.classList.contains('user')) {
            const userContent = prev.querySelector('.message-content');
            userQuery = userContent ? userContent.innerText : '';
            break;
        }
        prev = prev.previousElementSibling;
    }

    const payload = {
        user_id: userId,
        query: userQuery || 'Câu hỏi của người dùng',
        context: '',
        response: botResponse,
        rating: rating,
        correct_answer: correctAnswer
    };

    showNotification(
        rating === 'thumbs_up' ? '👍 Gửi phản hồi tốt' : '👎 Gửi góp ý điều chỉnh',
        'info',
        'Đang kích hoạt ACE Reflector & Curator...'
    );

    try {
        const res = await ChatAPI.sendAceFeedback(payload);
        if (res && res.success) {
            showSuccessNotification('🧠 ACE đã tự học thành công!', res.message || 'Cẩm nang đã được cập nhật.');
            loadAcePlaybook(true);
        } else {
            showWarningNotification('Phản hồi ACE', (res && res.message) || 'Đã ghi nhận phản hồi.');
        }
    } catch (err) {
        console.error('Feedback error:', err);
        showErrorNotification('Lỗi kết nối ACE', 'Không thể kết nối tới dịch vụ ACE.');
    }
}

async function loadAcePlaybook(forceRefresh = false) {
    const userId = getCurrentUsername();
    const textarea = document.getElementById('aceRawTextarea');
    const bulletsList = document.getElementById('aceBulletsList');
    if (!textarea || !bulletsList) return;

    if (forceRefresh) {
        bulletsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <i class="fas fa-spinner fa-spin" style="margin-bottom: 8px; font-size: 18px; color: #10a37f; display: block;"></i>
                Đang tải cẩm nang...
            </div>`;
    }

    try {
        const data = await ChatAPI.getAcePlaybook(userId);
        if (data && data.success) {
            textarea.value = data.playbook || '';
            renderAceBullets(data.bullets || []);
        }
    } catch (err) {
        console.error('Error loading ACE Playbook:', err);
    }
}

function renderAceBullets(bullets) {
    const list = document.getElementById('aceBulletsList');
    if (!list) return;

    if (!bullets || bullets.length === 0) {
        list.innerHTML = '<div style="color: #999; text-align: center; font-size: 12px; padding: 15px;">Chưa có quy tắc nào trong cẩm nang.</div>';
        return;
    }

    let html = '';
    bullets.forEach(b => {
        const helpful = b.helpful_count || 0;
        const harmful = b.harmful_count || 0;
        const tag = b.tag || 'rule';
        const content = b.content || '';

        html += `
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #fff; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 600; color: #10a37f;">[${tag}]</span>
                <span style="font-size: 10px; color: #64748b;">
                    <i class="far fa-thumbs-up text-success"></i> ${helpful} &nbsp;
                    <i class="far fa-thumbs-down text-danger"></i> ${harmful}
                </span>
            </div>
            <div style="color: #334155; line-height: 1.4;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>`;
    });
    list.innerHTML = html;
}

function toggleAceView(mode) {
    const parsedView = document.getElementById('aceParsedView');
    const rawView = document.getElementById('aceRawView');
    const btnParsed = document.getElementById('btnAceParsed');
    const btnRaw = document.getElementById('btnAceRaw');

    if (mode === 'parsed') {
        if (parsedView) parsedView.style.display = 'block';
        if (rawView) rawView.style.display = 'none';
        if (btnParsed) btnParsed.classList.add('active');
        if (btnRaw) btnRaw.classList.remove('active');
    } else {
        if (parsedView) parsedView.style.display = 'none';
        if (rawView) rawView.style.display = 'block';
        if (btnParsed) btnParsed.classList.remove('active');
        if (btnRaw) btnRaw.classList.add('active');
    }
}

async function saveAcePlaybookText() {
    const userId = getCurrentUsername();
    const textarea = document.getElementById('aceRawTextarea');
    if (!textarea) return;

    const text = textarea.value.trim();
    showNotification('💾 Đang lưu...', 'info', 'Đang cập nhật cẩm nang tự học...');

    try {
        const res = await ChatAPI.saveAcePlaybook(userId, text, false);
        if (res && res.success) {
            showSuccessNotification('Đã lưu cẩm nang!', 'Chỉ mục RAE đã được xây dựng lại.');
            loadAcePlaybook(true);
        } else {
            showErrorNotification('Lỗi lưu cẩm nang', res.message || 'Thao tác không thành công.');
        }
    } catch (err) {
        showErrorNotification('Lỗi kết nối', err.message);
    }
}

async function resetAcePlaybookToDefault() {
    if (!confirm('Bạn có chắc muốn đặt lại cẩm nang ACE về mặc định ban đầu?')) return;
    const userId = getCurrentUsername();

    showNotification('🧠 Đang khởi tạo...', 'info', 'Đang đặt lại cẩm nang mặc định...');
    try {
        const res = await ChatAPI.saveAcePlaybook(userId, '', true);
        if (res && res.success) {
            showSuccessNotification('Đã đặt lại cẩm nang!', 'Đã phục hồi các quy tắc cơ bản.');
            loadAcePlaybook(true);
        } else {
            showErrorNotification('Lỗi', res.message || 'Không thể đặt lại.');
        }
    } catch (err) {
        showErrorNotification('Lỗi', err.message);
    }
}
