document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    
    if (!postId) {
        alert('No post specified');
        window.location.href = 'index.html';
        return;
    }

    try {
        let post = null;
        
        // Try to get from session storage first (optimization)
        const storedPost = sessionStorage.getItem('currentPost');
        if (storedPost) {
            const parsed = JSON.parse(storedPost);
            if (parsed.id === postId) {
                post = parsed;
            }
        }

        // If not in session, fetch from Firestore
        if (!post) {
            const doc = await db.collection('posts').doc(postId).get();
            if (doc.exists) {
                post = doc.data();
            } else {
                throw new Error('Post not found');
            }
        }

        renderPost(post);

    } catch (error) {
        console.error('Error loading post:', error);
        document.getElementById('postHeaderLoader').innerHTML = `
            <div class="alert alert-danger">
                Error loading post: ${error.message}
            </div>
        `;
        document.getElementById('postContentLoader').style.display = 'none';
    }
});

function renderPost(post) {
    // Header
    document.getElementById('postTitle').textContent = post.title;
    document.getElementById('postExamType').textContent = post.examType.toUpperCase();
    document.getElementById('postSubject').textContent = post.subject;
    document.getElementById('postCategory').textContent = post.category || 'General';
    document.getElementById('postDate').textContent = formatDate(post.createdAt);
    
    // Show header, hide loader
    document.getElementById('postHeaderLoader').style.display = 'none';
    document.getElementById('postHeaderContent').style.display = 'block';

    // Body
    // Note: In a real app, sanitize this HTML content to prevent XSS
    document.getElementById('postBody').innerHTML = post.content; // Assuming content is HTML
    document.getElementById('postBody').style.display = 'block';
    document.getElementById('postContentLoader').style.display = 'none';

    // Attachment
    if (post.fileURL) {
        const attachmentDiv = document.getElementById('postAttachment');
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = post.fileURL;
        attachmentDiv.style.display = 'block';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    // Handle both Firestore Timestamp and standard Date objects
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}