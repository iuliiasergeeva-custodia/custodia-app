// News admin — uses JWT cookie auth (same as main admin page)

let currentMedia = [];
let allPosts = [];

// ── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function () {
    // Auth check: redirect to login if not an admin
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) {
        window.location.replace('/pages/auth/login?redirect=/pages/admin/news');
        return;
    }
    const data = await res.json().catch(() => ({}));
    if (!data.user || data.user.role !== 'admin') {
        window.location.replace('/pages/dashboard');
        return;
    }

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('newPostBtn').addEventListener('click', showForm);
    document.getElementById('cancelBtn').addEventListener('click', resetForm);
    document.getElementById('mediaFiles').addEventListener('change', handleFileUpload);
    document.getElementById('postForm').addEventListener('submit', handleSave);

    await loadPosts();
});

// ── Auth ─────────────────────────────────────────────────────────────────────

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.replace('/pages/auth/login');
}

// ── Form visibility ───────────────────────────────────────────────────────────

function showForm() {
    document.getElementById('postFormSection').style.display = 'block';
    document.getElementById('postFormSection').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('postForm').reset();
    document.getElementById('postId').value = '';
    document.getElementById('formTitle').textContent = 'Create new post';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('postFormSection').style.display = 'none';
    document.getElementById('formError').style.display = 'none';
    document.getElementById('formSuccess').style.display = 'none';
    currentMedia = [];
    renderMediaPreviews();
}

// ── File upload ───────────────────────────────────────────────────────────────

async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const progress = document.getElementById('uploadProgress');
    progress.style.display = 'inline';

    try {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        const res = await fetch('/api/admin/news/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Upload failed');
        }

        const result = await res.json();
        currentMedia = [...currentMedia, ...result.media];
        renderMediaPreviews();
    } catch (err) {
        showError(err.message);
    } finally {
        progress.style.display = 'none';
        e.target.value = '';
    }
}

function renderMediaPreviews() {
    const container = document.getElementById('uploadedMedia');
    if (!container) return;

    container.innerHTML = currentMedia.map((m, i) => `
        <div class="news-media-item">
            ${m.type === 'image'
                ? `<img src="${m.src}" alt="preview">`
                : `<video src="${m.src}" muted></video>`
            }
            <button type="button" class="news-media-remove" data-index="${i}" title="Remove">✕</button>
        </div>
    `).join('');

    container.querySelectorAll('.news-media-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMedia.splice(parseInt(btn.dataset.index), 1);
            renderMediaPreviews();
        });
    });
}

// ── Save post ─────────────────────────────────────────────────────────────────

async function handleSave(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    hideMessages();

    const postId  = document.getElementById('postId').value;
    const title   = document.getElementById('postTitle').value;
    const dateVal = document.getElementById('postDate').value;
    const excerpt = document.getElementById('postExcerpt').value;
    const content = document.getElementById('postContent').value;

    const payload = { title, content, media: currentMedia };
    if (postId)  payload.id      = postId;
    if (dateVal) payload.date    = new Date(dateVal).toISOString();
    if (excerpt) payload.excerpt = excerpt;

    try {
        const res = await fetch('/api/admin/news', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to save post');
        }

        showSuccess('Post saved successfully!');
        resetForm();
        await loadPosts();
    } catch (err) {
        showError(err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save post';
    }
}

// ── Load posts list ───────────────────────────────────────────────────────────

async function loadPosts() {
    const list = document.getElementById('postsList');
    list.innerHTML = '<div class="adm-placeholder"><p>Loading…</p></div>';

    try {
        const res = await fetch('/api/news', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch posts');
        allPosts = await res.json();

        const meta = document.getElementById('topbarMeta');
        if (meta) meta.textContent = `${allPosts.length} post${allPosts.length !== 1 ? 's' : ''}`;

        if (!allPosts.length) {
            list.innerHTML = '<div class="adm-placeholder"><p>No posts yet. Click "+ New post" to create one.</p></div>';
            return;
        }

        list.innerHTML = allPosts.map(post => {
            const date = post.date
                ? new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'No date';
            return `
                <div class="news-post-row">
                    <div class="news-post-info">
                        <div class="news-post-title">${escapeHtml(post.title)}</div>
                        <div class="news-post-meta">${date} · ${post.media ? post.media.length : 0} media</div>
                    </div>
                    <div class="news-post-actions">
                        <button class="adm-btn edit-btn" data-id="${post.id}"><i class="fas fa-pen"></i> Edit</button>
                        <button class="adm-btn news-delete-btn" data-id="${post.id}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const post = allPosts.find(p => p.id === btn.dataset.id);
                if (post) editPost(post);
            });
        });

        list.querySelectorAll('.news-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePost(btn.dataset.id));
        });

    } catch (err) {
        list.innerHTML = `<div class="adm-placeholder"><p>Error loading posts: ${escapeHtml(err.message)}</p></div>`;
    }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

function editPost(post) {
    showForm();
    document.getElementById('postId').value         = post.id;
    document.getElementById('postTitle').value      = post.title || '';
    document.getElementById('postContent').value    = post.content || '';
    document.getElementById('postExcerpt').value    = post.excerpt || '';
    document.getElementById('formTitle').textContent = 'Edit post';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    if (post.date) {
        const d = new Date(post.date);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        document.getElementById('postDate').value = local.toISOString().slice(0, 16);
    } else {
        document.getElementById('postDate').value = '';
    }

    currentMedia = Array.isArray(post.media) ? [...post.media] : [];
    renderMediaPreviews();
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deletePost(postId) {
    if (!confirm('Delete this post? This cannot be undone.')) return;

    try {
        const res = await fetch(`/api/admin/news/${postId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete post');
        }

        await loadPosts();
    } catch (err) {
        alert('Error deleting post: ' + err.message);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showError(msg) {
    const el = document.getElementById('formError');
    el.textContent = msg;
    el.style.display = 'block';
}

function showSuccess(msg) {
    const el = document.getElementById('formSuccess');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function hideMessages() {
    document.getElementById('formError').style.display   = 'none';
    document.getElementById('formSuccess').style.display = 'none';
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}
