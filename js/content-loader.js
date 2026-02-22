// Firestore Collections
const POSTS_COLLECTION = 'posts';
const MCQS_COLLECTION = 'mcqs';
const PYQS_COLLECTION = 'pyqs';
const USERS_COLLECTION = 'users';

// Global Data Store for Client-Side Filtering
let allPosts = [];
let allMCQs = [];
let allPYQs = [];

// Load content based on page type
async function loadPageContent(pageType, subject = null) {
    try {
        let query = db.collection(POSTS_COLLECTION)
            .where('status', '==', 'published');
        
        // Filter by page type
        if (pageType === 'prelims') {
            query = query.where('examType', 'in', ['prelims', 'combined']);
        } else if (pageType === 'mains') {
            query = query.where('examType', 'in', ['mains', 'combined']);
        }
        
        // Filter by subject if specified
        if (subject && subject !== 'all') {
            query = query.where('subject', '==', subject);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            return [];
        }
        
        const posts = [];
        snapshot.forEach(doc => {
            posts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        allPosts = posts; // Store for filtering
        return posts;
    } catch (error) {
        console.error('Error loading content:', error);
        return [];
    }
}

// Load MCQs
async function loadMCQs(subject = null) {
    try {
        let query = db.collection(MCQS_COLLECTION).where('status', '==', 'published');
        
        if (subject && subject !== 'all') {
            query = query.where('subject', '==', subject);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').limit(20).get();
        
        if (snapshot.empty) {
            return [];
        }
        
        const mcqs = [];
        snapshot.forEach(doc => {
            mcqs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        allMCQs = mcqs; // Store for filtering
        return mcqs;
    } catch (error) {
        console.error('Error loading MCQs:', error);
        return [];
    }
}

// Load PYQs
async function loadPYQs(year = null, subject = null) {
    try {
        let query = db.collection(PYQS_COLLECTION).where('status', '==', 'published');
        
        if (year) {
            query = query.where('year', '==', year);
        }
        
        if (subject && subject !== 'all') {
            query = query.where('subject', '==', subject);
        }
        
        const snapshot = await query.orderBy('year', 'desc').limit(20).get();
        
        if (snapshot.empty) {
            return [];
        }
        
        const pyqs = [];
        snapshot.forEach(doc => {
            pyqs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        allPYQs = pyqs; // Store for filtering
        return pyqs;
    } catch (error) {
        console.error('Error loading PYQs:', error);
        return [];
    }
}

// Display posts in grid
function displayPosts(posts, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                <h4>No content found</h4>
                <p class="text-muted">Check back later for new content.</p>
            </div>
        `;
        return;
    }
    
    posts.forEach(post => {
        const postCard = createPostCard(post);
        container.appendChild(postCard);
    });
}

// Create post card HTML
function createPostCard(post) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';
    
    const tags = [];
    if (post.examType === 'prelims') tags.push('Prelims');
    if (post.examType === 'mains') tags.push('Mains');
    if (post.examType === 'combined') tags.push('Combined');
    
    const tagHtml = tags.map(tag => 
        `<span class="badge bg-primary me-1">${tag}</span>`
    ).join('');
    
    col.innerHTML = `
        <div class="card content-card h-100">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    ${tagHtml}
                    <small class="text-muted">${formatDate(post.createdAt)}</small>
                </div>
                <h5 class="card-title">${post.title}</h5>
                <p class="card-text text-muted">${post.excerpt || 'Click to read more...'}</p>
                <div class="mt-auto">
                    <span class="badge bg-secondary">${post.subject}</span>
                    ${post.category ? `<span class="badge bg-light text-dark ms-1">${post.category}</span>` : ''}
                </div>
            </div>
            <div class="card-footer bg-transparent border-top-0">
                <a href="#" class="btn btn-outline-primary w-100" onclick="viewPost('${post.id}')">
                    Read More <i class="fas fa-arrow-right ms-1"></i>
                </a>
            </div>
        </div>
    `;
    
    return col;
}

// Display MCQs
function displayMCQs(mcqs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (mcqs.length === 0) {
        container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No MCQs available.</p></div>';
        return;
    }
    
    mcqs.forEach((mcq, index) => {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        col.innerHTML = `
            <div class="card h-100 border-primary shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <span class="badge bg-primary mb-2">Q${index + 1}</span>
                        <span class="badge bg-secondary mb-2">${mcq.subject}</span>
                    </div>
                    <h6 class="card-title">${mcq.question}</h6>
                    <div class="options-list mt-3">
                        <div class="form-check"><input class="form-check-input" type="radio" name="mcq_${mcq.id}" id="optA_${mcq.id}"><label class="form-check-label" for="optA_${mcq.id}">${mcq.optionA}</label></div>
                        <div class="form-check"><input class="form-check-input" type="radio" name="mcq_${mcq.id}" id="optB_${mcq.id}"><label class="form-check-label" for="optB_${mcq.id}">${mcq.optionB}</label></div>
                        <div class="form-check"><input class="form-check-input" type="radio" name="mcq_${mcq.id}" id="optC_${mcq.id}"><label class="form-check-label" for="optC_${mcq.id}">${mcq.optionC}</label></div>
                        <div class="form-check"><input class="form-check-input" type="radio" name="mcq_${mcq.id}" id="optD_${mcq.id}"><label class="form-check-label" for="optD_${mcq.id}">${mcq.optionD}</label></div>
                    </div>
                    <div class="mt-3 collapse" id="ans_${mcq.id}">
                        <div class="alert alert-success p-2 mb-0">
                            <strong>Answer: ${mcq.correctOption}</strong><br>
                            <small>${mcq.explanation || ''}</small>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-sm btn-outline-primary w-100" type="button" data-bs-toggle="collapse" data-bs-target="#ans_${mcq.id}">Show Answer</button>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

// Display PYQs
function displayPYQs(pyqs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (pyqs.length === 0) {
        container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No PYQs available.</p></div>';
        return;
    }
    
    pyqs.forEach(pyq => {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        col.innerHTML = `
            <div class="card h-100 border-info shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <span class="badge bg-info text-dark mb-2">${pyq.year}</span>
                        <span class="badge bg-secondary mb-2">${pyq.subject}</span>
                    </div>
                    <p class="card-text">${pyq.question}</p>
                    <div class="mt-3 collapse" id="pyq_ans_${pyq.id}">
                        <div class="alert alert-info p-2 mb-0">
                            <strong>Answer:</strong> ${pyq.answer || 'Refer to standard key.'}
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-sm btn-outline-info w-100" type="button" data-bs-toggle="collapse" data-bs-target="#pyq_ans_${pyq.id}">View Answer</button>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// View single post (to be implemented based on routing)
async function viewPost(postId) {
    try {
        const doc = await db.collection(POSTS_COLLECTION).doc(postId).get();
        if (doc.exists) {
            const post = doc.data();
            // Store in session storage and redirect to post view page
            sessionStorage.setItem('currentPost', JSON.stringify(post));
            window.location.href = `post-view.html?id=${postId}`;
        }
    } catch (error) {
        console.error('Error loading post:', error);
    }
}

// Initialize page based on current page
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    const pageName = path.split('/').pop().replace('.html', '');
    
    switch(pageName) {
        case 'prelims':
            initializePrelimsPage();
            break;
        case 'mains':
            initializeMainsPage();
            break;
        case 'combined':
            initializeCombinedPage();
            break;
    }
});

// Initialize Prelims page
async function initializePrelimsPage() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const contentContainer = document.getElementById('contentContainer');
    
    try {
        // Load all prelims content
        const posts = await loadPageContent('prelims');
        const mcqs = await loadMCQs();
        const pyqs = await loadPYQs();
        
        // Display content
        displayPosts(posts, 'contentContainer');
        displayMCQs(mcqs, 'mcqContainer');
        displayPYQs(pyqs, 'pyqContainer');
        
        // Hide loading, show content
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'flex';
    } catch (error) {
        console.error('Error initializing prelims page:', error);
        if (loadingSpinner) {
            loadingSpinner.innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                    <h4>Error loading content</h4>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }
}

// Initialize Mains page
async function initializeMainsPage() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const contentContainer = document.getElementById('contentContainer');
    
    try {
        // Load mains content
        const posts = await loadPageContent('mains');
        const modelAnswers = await loadModelAnswers();
        
        // Display content
        displayPosts(posts, 'contentContainer');
        displayModelAnswers(modelAnswers);
        
        // Hide loading, show content
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'flex';
    } catch (error) {
        console.error('Error initializing mains page:', error);
        if (loadingSpinner) {
            loadingSpinner.innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                    <h4>Error loading content</h4>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }
}

// Initialize Combined page
async function initializeCombinedPage() {
    try {
        // Load combined content
        const posts = await loadPageContent('combined');
        displayCombinedContent(posts);
    } catch (error) {
        console.error('Error initializing combined page:', error);
    }
}

// Load model answers
async function loadModelAnswers() {
    try {
        const snapshot = await db.collection('model_answers')
            .where('status', '==', 'published')
            .orderBy('score', 'desc')
            .limit(10)
            .get();
        
        const answers = [];
        snapshot.forEach(doc => {
            answers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return answers;
    } catch (error) {
        console.error('Error loading model answers:', error);
        return [];
    }
}

// Display combined content
function displayCombinedContent(posts, containerId = 'combinedContentContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                <h4>No integrated content found</h4>
                <p class="text-muted">Integrated content will be added soon.</p>
            </div>
        `;
        return;
    }
    
    posts.forEach(post => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        
        // Determine badge color based on subject
        let badgeColor = 'bg-primary';
        if (post.subject.includes('polity')) badgeColor = 'bg-primary';
        else if (post.subject.includes('economy')) badgeColor = 'bg-success';
        else if (post.subject.includes('environment')) badgeColor = 'bg-warning';
        else if (post.subject.includes('science')) badgeColor = 'bg-info';
        
        col.innerHTML = `
            <div class="card h-100 shadow-sm">
                <div class="card-header ${badgeColor} text-white d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${post.title.substring(0, 50)}${post.title.length > 50 ? '...' : ''}</h6>
                    <span class="badge bg-light text-dark">Integrated</span>
                </div>
                <div class="card-body">
                    <p class="card-text small">${post.excerpt || 'Integrated content connecting prelims and mains...'}</p>
                    <div class="mt-3">
                        <span class="badge bg-secondary me-1">${post.subject}</span>
                        ${post.category ? `<span class="badge bg-light text-dark">${post.category}</span>` : ''}
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-outline-primary btn-sm w-100" onclick="viewPost('${post.id}')">
                        <i class="fas fa-external-link-alt me-1"></i> View Integrated Approach
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(col);
    });
}

// --- Real App Logic: Filtering and Searching ---

// Filter content by type (UI Helper)
window.filterContent = function(filterType) {
    const contentSection = document.getElementById('contentContainer');
    const mcqSection = document.getElementById('mcqs');
    const pyqSection = document.getElementById('pyqs');

    // Reset displays
    if (contentSection) contentSection.parentElement.style.display = 'block';
    if (mcqSection) mcqSection.style.display = 'block';
    if (pyqSection) pyqSection.style.display = 'block';

    if (filterType === 'mcq') {
        if (contentSection) contentSection.parentElement.style.display = 'none';
        if (pyqSection) pyqSection.style.display = 'none';
        if (mcqSection) mcqSection.scrollIntoView({ behavior: 'smooth' });
    } else if (filterType === 'pyq') {
        if (contentSection) contentSection.parentElement.style.display = 'none';
        if (mcqSection) mcqSection.style.display = 'none';
        if (pyqSection) pyqSection.scrollIntoView({ behavior: 'smooth' });
    } else if (filterType !== 'all') {
        // For specific subjects handled via filterBySubject usually, 
        // but if used for sections:
        filterBySubject(filterType);
    }
};

// Filter by Subject (Data Filter)
window.filterBySubject = function(subject) {
    // Filter Posts
    const filteredPosts = subject === 'all' ? allPosts : allPosts.filter(p => p.subject.toLowerCase().includes(subject));
    displayPosts(filteredPosts, 'contentContainer');

    // Filter MCQs
    const filteredMCQs = subject === 'all' ? allMCQs : allMCQs.filter(m => m.subject.toLowerCase().includes(subject));
    displayMCQs(filteredMCQs, 'mcqContainer');

    // Filter PYQs
    const filteredPYQs = subject === 'all' ? allPYQs : allPYQs.filter(p => p.subject.toLowerCase().includes(subject));
    displayPYQs(filteredPYQs, 'pyqContainer');
};

// Search Content (Global Search)
window.searchContent = function(query) {
    const term = query.toLowerCase().trim();
    if (!term) {
        window.filterBySubject('all');
        return;
    }

    const filteredPosts = allPosts.filter(p => p.title.toLowerCase().includes(term) || p.subject.toLowerCase().includes(term));
    displayPosts(filteredPosts, 'contentContainer');

    const filteredMCQs = allMCQs.filter(m => m.question.toLowerCase().includes(term) || m.subject.toLowerCase().includes(term));
    displayMCQs(filteredMCQs, 'mcqContainer');

    const filteredPYQs = allPYQs.filter(p => p.question.toLowerCase().includes(term) || p.subject.toLowerCase().includes(term) || p.year.toString().includes(term));
    displayPYQs(filteredPYQs, 'pyqContainer');
};

// Update the initialization function
function initializePageBasedOnPath() {
    const path = window.location.pathname;
    const pageName = path.split('/').pop().replace('.html', '');
    
    switch(pageName) {
        case 'prelims':
            initializePrelimsPage();
            break;
        case 'mains':
            initializeMainsPage();
            break;
        case 'combined':
            initializeCombinedPage();
            break;
        case 'index':
        case '':
            // Home page specific initialization if needed
            break;
    }
}

// Call this on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializePageBasedOnPath);