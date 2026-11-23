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
 * Helper: escape HTML characters
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Get appropriate FontAwesome icon based on file extension
 */
function getFileIcon(filename) {
    if (!filename) return 'far fa-file-alt';
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'far fa-file-pdf';
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'far fa-file-word';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) return 'far fa-file-excel';
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'far fa-file-powerpoint';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) return 'far fa-file-image';
    if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return 'far fa-file-archive';
    if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'far fa-file-alt';
    return 'far fa-file-alt';
}

/**
 * Copy citation snippet to clipboard
 */
function copyCitationSnippet(button, text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        const origHtml = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check" style="color:#10a37f;"></i> <span>Đã chép!</span>';
        showSuccessNotification('Đã sao chép đoạn trích vào bộ nhớ tạm');
        setTimeout(() => {
            button.innerHTML = origHtml;
        }, 2000);
    }).catch(err => {
        console.error('Copy snippet failed:', err);
    });
}

/**
 * Focus and highlight citation card when user clicks inline citation badge [1], [2]
 */
function focusCitation(messageId, citationIndex) {
    const accordion = document.querySelector(`#citations-${messageId} .citations-accordion`);
    if (accordion && !accordion.classList.contains('open')) {
        accordion.classList.add('open');
    }
    const cardId = `citation-card-${messageId}-${citationIndex}`;
    const card = document.getElementById(cardId);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        card.classList.remove('highlight');
        void card.offsetWidth; // Force reflow
        card.classList.add('highlight');
        setTimeout(() => {
            card.classList.remove('highlight');
        }, 2000);
    }
}

/**
 * Convert [1], [2], [Nguồn 1] into clickable chips linking to citation cards
 */
function convertInlineCitations(html, messageId) {
    if (!html || !messageId) return html;
    // Don't replace inside pre, code, or a tags
    const parts = html.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<a[\s\S]*?<\/a>)/gi);
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            // Match [1], [2] etc.
            parts[i] = parts[i].replace(/\[(\d+)\]/g, (match, num) => {
                return `<button type="button" class="inline-citation-btn" onclick="focusCitation('${messageId}', ${num})" title="Xem trích dẫn [${num}]">${num}</button>`;
            });
            // Match [Nguồn 1], [Nguồn 2] etc.
            parts[i] = parts[i].replace(/\[Nguồn\s*(\d+)\]/gi, (match, num) => {
                return `<button type="button" class="inline-citation-btn" onclick="focusCitation('${messageId}', ${num})" title="Xem trích dẫn [${num}]">[${num}]</button>`;
            });
        }
    }
    return parts.join('');
}

/**
 * Parse full markdown content + KaTeX + inline citations
 */
function renderRichContent(content, messageId = null) {
    if (!content) return '';
    try {
        let processed = renderKaTeX(content);
        if (typeof marked !== 'undefined') {
            processed = marked.parse(processed);
        }
        if (messageId) {
            processed = convertInlineCitations(processed, messageId);
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
 * Build rich citations accordion HTML from structured citations / sources / context
 */
function buildCitationsHtml(sources, context, citations = null, messageId = '') {
    const hasCitations = citations && Array.isArray(citations) && citations.length > 0;
    const hasSources = sources && Array.isArray(sources) && sources.length > 0;
    const hasContext = context && typeof context === 'string' && context.trim().length > 10 && context !== '{}';

    if (!hasCitations && !hasSources && !hasContext) {
        return '';
    }

    let cardsHtml = '';
    let totalCount = 0;

    if (hasCitations) {
        totalCount = citations.length;
        citations.forEach(item => {
            const idx = item.index;
            const src = item.source_file || 'Tài liệu tham khảo';
            const scorePct = item.score ? Math.round(item.score * 100) : null;
            const scoreBadge = scorePct ? `<span class="citation-score-badge" title="Độ tương đồng ngữ nghĩa: ${item.score}">${scorePct}% Khớp</span>` : '';
            const typeLabel = item.type === 'user' ? 'Cá nhân' : 'Quản trị';
            const typeClass = item.type === 'user' ? 'user' : 'admin';
            const fileIcon = getFileIcon(src);
            const snippetText = item.snippet || '';
            const snippetHtml = escapeHtml(snippetText);
            const cardId = `citation-card-${messageId}-${idx}`;

            cardsHtml += `
            <div class="citation-card" id="${cardId}">
                <div class="citation-card-header">
                    <span class="doc-name" title="${escapeHtml(src)}">
                        <i class="${fileIcon}"></i>
                        <span>[${idx}] ${escapeHtml(src)}</span>
                    </span>
                    <div class="citation-badges-group">
                        <span class="citation-type-badge ${typeClass}">${typeLabel}</span>
                        ${scoreBadge}
                    </div>
                </div>
                ${snippetHtml ? `<div class="citation-snippet">"${snippetHtml}"</div>` : ''}
                <div class="citation-footer-actions">
                    <button type="button" class="citation-copy-btn" onclick="copyCitationSnippet(this, ${JSON.stringify(snippetText)})" title="Sao chép đoạn trích này">
                        <i class="far fa-copy"></i> Sao chép đoạn trích
                    </button>
                </div>
            </div>`;
        });
    } else if (hasSources) {
        totalCount = sources.length;
        sources.forEach((src, idx) => {
            const fileIcon = getFileIcon(src);
            const cardId = `citation-card-${messageId}-${idx + 1}`;
            cardsHtml += `
            <div class="citation-card" id="${cardId}">
                <div class="citation-card-header">
                    <span class="doc-name" title="${escapeHtml(src)}">
                        <i class="${fileIcon}"></i>
                        <span>[${idx + 1}] ${escapeHtml(src)}</span>
                    </span>
                    <span class="citation-score-badge">Nguồn #${idx + 1}</span>
                </div>
            </div>`;
        });
    }

    if (hasContext && !hasCitations) {
        totalCount += 1;
        cardsHtml += `
        <div class="citation-card">
            <div class="citation-card-header">
                <span class="doc-name"><i class="fas fa-database"></i> Trích đoạn Context RAG</span>
            </div>
            <div class="citation-snippet">${escapeHtml(context)}</div>
        </div>`;
    }

    return `
    <div class="citations-accordion">
        <div class="citations-header" onclick="this.parentElement.classList.toggle('open')" title="Nhấp để xem/thu gọn trích dẫn">
            <span><i class="fas fa-book-reader me-2" style="color:#10a37f;"></i> Nguồn trích dẫn (${totalCount})</span>
            <i class="fas fa-chevron-down chevron"></i>
        </div>
        <div class="citations-body">
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
        context = null,
        citations = null
    } = options;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.id = messageId;

    const renderedHtml = renderRichContent(content, messageId);
    const citationsHtml = buildCitationsHtml(sources, context, citations, messageId);

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
