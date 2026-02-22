// Protect page
protectAdminPage();

document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        alert('No post ID provided');
        window.location.href = 'admin-dashboard.html';
        return;
    }

    // Load Post Data
    try {
        const doc = await db.collection('posts').doc(postId).get();
        if (!doc.exists) {
            alert('Post not found');
            window.location.href = 'admin-dashboard.html';
            return;
        }

        const post = doc.data();
        
        // Populate Form
        document.getElementById('postId').value = postId;
        document.getElementById('postTitle').value = post.title || '';
        document.getElementById('postSlug').value = post.slug || '';
        document.getElementById('examType').value = post.examType || '';
        document.getElementById('subject').value = post.subject || '';
        document.getElementById('category').value = post.category || '';
        document.getElementById('postContent').value = post.content || '';
        document.getElementById('keywords').value = post.keywords || '';
        document.getElementById('status').value = post.status || 'draft';

        // Show form
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('editPostForm').style.display = 'block';

    } catch (error) {
        console.error('Error loading post:', error);
        alert('Error loading post data');
    }

    // Handle Update
    document.getElementById('editPostForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const updateBtn = document.getElementById('updateBtn');
        const updateText = document.getElementById('updateText');
        const updateSpinner = document.getElementById('updateSpinner');

        updateText.textContent = 'Updating...';
        updateSpinner.classList.remove('d-none');
        updateBtn.disabled = true;

        const updatedData = {
            title: document.getElementById('postTitle').value,
            slug: document.getElementById('postSlug').value,
            examType: document.getElementById('examType').value,
            subject: document.getElementById('subject').value,
            category: document.getElementById('category').value,
            content: document.getElementById('postContent').value,
            keywords: document.getElementById('keywords').value,
            status: document.getElementById('status').value,
            excerpt: document.getElementById('postContent').value.substring(0, 150) + '...',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('posts').doc(postId).update(updatedData);
            alert('Post updated successfully');
            window.location.href = 'admin-dashboard.html';
        } catch (error) {
            console.error('Error updating post:', error);
            alert('Error updating post: ' + error.message);
            
            // Reset button
            updateText.textContent = 'Update Post';
            updateSpinner.classList.add('d-none');
            updateBtn.disabled = false;
        }
    });
});