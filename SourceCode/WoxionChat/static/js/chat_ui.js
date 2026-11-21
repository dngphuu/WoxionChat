/**
 * WoxionChat - UI & Rendering Module
 * Manages DOM updates, notifications, marked.js formatting,
 * Prism.js syntax highlighting, copy-code button, KaTeX math parsing, and citations.
 */

let notificationTimeout = null;

// ==================== Notifications ==================== //

function showNotification(title, type = 'info', message = '', details = '') {
    const bar = document.getElementById('notificationBar');
    if (!bar) return;

    bar.className = 'notification-bar ' + type;
    const textEl = bar.querySelector('.notification-text');
    const detailsEl = bar.querySelector('.notification-details');
    const iconEl = bar.querySelector('.notification-icon i');

    if (textEl) textEl.innerHTML = title;
    if (detailsEl) {
        detailsEl.innerHTML = (message ? message + ' ' : '') + details;
        detailsEl.style.display = (message || details) ? 'block' : 'none';
    }

    if (iconEl) {
        if (type === 'success') iconEl.className = 'fas fa-check-circle';
        else if (type === 'error') iconEl.className = 'fas fa-exclamation-circle';
        else if (type === 'warning') iconEl.className = 'fas fa-exclamation-triangle';
        else iconEl.className = 'fas fa-info-circle';
    }

    bar.classList.add('show');
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(hideNotification, 5000);
}

function hideNotification() {
    const bar = document.getElementById('notificationBar');
    if (bar) bar.classList.remove('show');
}

function showSuccessNotification(title, message = '', details = '') {
    showNotification(title, 'success', message, details);
}

function showErrorNotification(title, message = '', details = '') {
    showNotification(title, 'error', message, details);
}

function showWarningNotification(title, message = '', details = '') {
    showNotification(title, 'warning', message, details);
}

function showInfoNotification(title, message = '', details = '') {
    showNotification(title, 'info', message, details);
}

// ==================== Thinking Indicator ==================== //

function showThinkingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'block';
        scrollToBottom();
    }
}

function hideThinkingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

function scrollToBottom() {
    const chatBody = document.getElementById('chatBody');
    if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
    }
}

// ==================== Markdown, Prism & KaTeX ==================== //

/**
 * Render LaTeX Math equations via KaTeX
 */
function renderKaTeX(text) {
    if (typeof katex === 'undefined') return text;

    // Display math: $$ ... $$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
        try {
            return '<div class="katex-display">' + katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }) + '</div>';
        } catch (e) {
            console.error('KaTeX display error:', e);
            return match;
        }
    });

    // Inline math: $ ... $ (avoid matching escaped \$ or currency)
    text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, math) => {
        try {
            return prefix + '<span class="katex-inline">' + katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }) + '</span>';
        } catch (e) {
            console.error('KaTeX inline error:', e);
            return match;
        }
    });

    return text;
}

/**
 * Configure marked.js with custom renderer for code blocks with copy button
 */
function initMarked() {
    if (typeof marked === 'undefined') return;

    const renderer = new marked.Renderer();

    // Wrap code blocks inside a styled container with header and copy button
    renderer.code = function(code, language) {
        const lang = (language || 'text').toLowerCase();
        const validLang = lang.replace(/[^a-z0-9_-]/g, '');
        const escapedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        return `
        <div class="code-block-wrapper">
            <div class="code-header">
                <span class="code-lang"><i class="fas fa-code me-1"></i>${validLang.toUpperCase()}</span>
                <button class="code-copy-btn" onclick="copyCodeBlock(this)">
                    <i class="far fa-copy"></i>
                    <span>Sao chép</span>
                </button>
            </div>
            <pre><code class="language-${validLang}">${escapedCode}</code></pre>
        </div>`;
    };

    marked.setOptions({
        renderer: renderer,
        breaks: true,
        gfm: true,
        smartLists: true,
        smartypants: false
    });
}

/**
 * Copy code from code block
 */
function copyCodeBlock(button) {
    const wrapper = button.closest('.code-block-wrapper');
    if (!wrapper) return;
    const codeEl = wrapper.querySelector('pre code');
    if (!codeEl) return;

    const codeText = codeEl.innerText || codeEl.textContent;
    navigator.clipboard.writeText(codeText).then(() => {
        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i><span>Đã sao chép!</span>';
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = '<i class="far fa-copy"></i><span>Sao chép</span>';
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        showErrorNotification('Không thể sao chép mã', err.message);
    });
}

/**
 * Copy entire bot response text
 */
function copyResponseText(button, messageId) {
    const contentEl = document.getElementById(`content-${messageId}`);
    if (!contentEl) return;
    const text = contentEl.innerText || contentEl.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const origHtml = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check" style="color:#10a37f;"></i>';
        showSuccessNotification('Đã sao chép phản hồi vào clipboard');
        setTimeout(() => {
            button.innerHTML = origHtml;
        }, 2000);
    });
}

/**
 * Parse full markdown content + KaTeX
 */
function renderRichContent(content) {
    if (!content) return '';
    try {
        let processed = renderKaTeX(content);
        if (typeof marked !== 'undefined') {
            processed = marked.parse(processed);
        }
        return processed;
    } catch (e) {
        console.error('Render error:', e);
        return content;
    }
}

/**
 * Apply Prism.js highlighting to container
 */
function highlightCodeBlocks(container) {
    if (typeof Prism !== 'undefined' && container) {
        container.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });
    }
}

// ==================== Citations Accordion ==================== //

/**
 * Build rich citations accordion HTML from sources / context
 */
function buildCitationsHtml(sources, context) {
    if ((!sources || sources.length === 0) && (!context || context === '{}')) {
        return '';
    }

    let cardsHtml = '';

    if (sources && sources.length > 0) {
        sources.forEach((src, idx) => {
            cardsHtml += `
            <div class="citation-card">
                <div class="citation-card-header">
                    <span class="doc-name"><i class="fas fa-file-alt"></i> ${src}</span>
                    <span class="citation-score-badge">Nguồn #${idx + 1}</span>
                </div>
            </div>`;
        });
    }

    if (context && typeof context === 'string' && context.length > 5 && context !== '{}') {
        cardsHtml += `
        <div class="citation-card">
            <div class="citation-card-header">
                <span class="doc-name"><i class="fas fa-database"></i> Trích đoạn Context RAG</span>
            </div>
            <div class="citation-snippet">${context.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>`;
    }

    const count = (sources ? sources.length : 0) + (context && context !== '{}' ? 1 : 0);

    return `
    <div class="citations-accordion">
        <div class="citations-header" onclick="this.parentElement.classList.toggle('open')">
            <span><i class="fas fa-book-reader me-2" style="color:#10a37f;"></i> Nguồn tham khảo (${count})</span>
            <i class="fas fa-chevron-down chevron"></i>
        </div>
        <div class="citations-body" style="display: flex;">
            ${cardsHtml}
        </div>
    </div>`;
}

// ==================== Messages Rendering ==================== //

/**
 * Add User Message to chat view
 */
function addUserMessage(content, timeString = null) {
    const chatBody = document.getElementById('chatBody');
    if (!chatBody) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';

    const now = new Date();
    const time = timeString || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    messageDiv.innerHTML = `
        <div class="message-content">${escaped}</div>
        <div class="message-time">${time}</div>
    `;

    chatBody.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * Add Bot Message with Typewriter effect (or instant render)
 */
function addBotMessageWithTypewriter(content, options = {}) {
    const chatBody = document.getElementById('chatBody');
    if (!chatBody) return;

    const {
        messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timeString = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        instant = false,
        sources = null,
        context = null
    } = options;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.id = messageId;

    const renderedHtml = renderRichContent(content);
    const citationsHtml = buildCitationsHtml(sources, context);

    const buttonsHtml = `
        <button class="copy-response-btn" onclick="copyResponseText(this, '${messageId}')" title="Sao chép nội dung">
            <i class="far fa-copy"></i>
        </button>
        <button class="thumbs-up-btn" onclick="sendAceFeedback('${messageId}', 'thumbs_up')" title="Hữu ích (Chạy ACE Reflector)">
            <i class="far fa-thumbs-up"></i>
        </button>
        <button class="thumbs-down-btn" onclick="showAceCorrectionForm('${messageId}')" title="Không hữu ích / Sai (Chạy ACE Curator)">
            <i class="far fa-thumbs-down"></i>
        </button>
        <button class="pin-btn" onclick="toggleMessagePin('${messageId}')" title="Ghim tin nhắn">
            <i class="fas fa-thumbtack"></i>
        </button>
    `;

    messageDiv.innerHTML = `
        <div class="message-content" id="content-${messageId}"></div>
        <div id="citations-${messageId}">${citationsHtml}</div>
        <div id="correction-form-${messageId}" class="correction-form" style="display: none; margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.03); border-radius: 8px; width: 100%; box-sizing: border-box;">
            <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 5px; color: #444;">Góp ý câu trả lời đúng (ACE Curator):</label>
            <div style="display: flex; gap: 8px;">
                <input type="text" id="correction-input-${messageId}" placeholder="Nhập gợi ý hoặc câu trả lời đúng..." style="flex: 1; padding: 6px 10px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; outline: none; background: #fff;">
                <button onclick="submitAceCorrection('${messageId}')" style="padding: 6px 12px; font-size: 12px; background: #10a37f; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Gửi</button>
                <button onclick="hideAceCorrectionForm('${messageId}')" style="padding: 6px 12px; font-size: 12px; background: #e0e0e0; color: #333; border: none; border-radius: 4px; cursor: pointer;">Hủy</button>
            </div>
        </div>
        <div class="message-footer">
            <div class="message-time">${timeString}</div>
            ${buttonsHtml}
        </div>
    `;

    chatBody.appendChild(messageDiv);
    const contentDiv = document.getElementById(`content-${messageId}`);

    if (instant) {
        contentDiv.innerHTML = renderedHtml;
        highlightCodeBlocks(contentDiv);
        scrollToBottom();
        return;
    }

    // Fast typewriter effect
    messageDiv.classList.add('typing');
    const plainText = content;
    let charIndex = 0;
    const speed = Math.max(5, Math.min(25, Math.floor(1500 / Math.max(plainText.length, 1))));

    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    contentDiv.appendChild(cursor);

    const typewriterInterval = setInterval(() => {
        if (charIndex < plainText.length) {
            // Append slice of characters for snappiness
            const step = plainText.length > 500 ? 3 : 1;
            charIndex = Math.min(charIndex + step, plainText.length);
            const partialRaw = plainText.substring(0, charIndex);
            contentDiv.innerHTML = renderRichContent(partialRaw);
            contentDiv.appendChild(cursor);
            scrollToBottom();
        } else {
            clearInterval(typewriterInterval);
            cursor.remove();
            messageDiv.classList.remove('typing');
            contentDiv.innerHTML = renderedHtml;
            highlightCodeBlocks(contentDiv);
            scrollToBottom();
        }
    }, speed);
}
