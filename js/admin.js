// Firestore Collections
const POSTS_COLLECTION = 'posts';
const MCQS_COLLECTION = 'mcqs';
const PYQS_COLLECTION = 'pyqs';
const USERS_COLLECTION = 'users';
const PROGRAM_SCHEDULES_COLLECTION = 'program_schedules';

let validatedSchedulePayload = null;

// Admin Dashboard Functions

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Get total posts count
        const postsSnapshot = await db.collection(POSTS_COLLECTION).get();
        document.getElementById('totalPosts').textContent = postsSnapshot.size;
        
        // Get prelims posts count
        const prelimsSnapshot = await db.collection(POSTS_COLLECTION)
            .where('examType', 'in', ['prelims', 'combined'])
            .get();
        document.getElementById('prelimsPosts').textContent = prelimsSnapshot.size;
        
        // Get mains posts count
        const mainsSnapshot = await db.collection(POSTS_COLLECTION)
            .where('examType', 'in', ['mains', 'combined'])
            .get();
        document.getElementById('mainsPosts').textContent = mainsSnapshot.size;
        
        // Get MCQs count
        const mcqsSnapshot = await db.collection(MCQS_COLLECTION).get();
        document.getElementById('totalMCQs').textContent = mcqsSnapshot.size;
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load recent posts
async function loadRecentPosts() {
    try {
        const snapshot = await db.collection(POSTS_COLLECTION)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const tbody = document.getElementById('recentPostsBody');
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No posts found</td>
                </tr>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const post = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${post.title || 'Untitled'}</td>
                <td><span class="badge bg-primary">${post.examType || 'N/A'}</span></td>
                <td>${post.subject || 'N/A'}</td>
                <td>${formatDate(post.createdAt)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editPost('${doc.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deletePost('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading recent posts:', error);
    }
}

// Add new post
async function addNewPost(postData, file = null) {
    try {
        // Add timestamp
        postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        postData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        // Generate slug if not provided
        if (!postData.slug) {
            postData.slug = generateSlug(postData.title);
        }
        
        // Add created by (current user)
        const user = auth.currentUser;
        if (user) {
            postData.createdBy = user.uid;
            postData.authorEmail = user.email;
        }
        
        // Add to Firestore
        const docRef = await db.collection(POSTS_COLLECTION).add(postData);
        
        // Upload file if provided
        if (file) {
            await uploadFile(file, docRef.id, 'post');
        }
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding post:', error);
        return { success: false, error: error.message };
    }
}

// Generate slug from title
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// Upload file to Firebase Storage
async function uploadFile(file, docId, type) {
    try {
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`${type}s/${docId}/${file.name}`);
        
        await fileRef.put(file);
        
        // Get download URL
        const downloadURL = await fileRef.getDownloadURL();
        
        // Update document with file URL
        await db.collection(POSTS_COLLECTION).doc(docId).update({
            fileURL: downloadURL,
            fileName: file.name
        });
        
        return { success: true, url: downloadURL };
    } catch (error) {
        console.error('Error uploading file:', error);
        return { success: false, error: error.message };
    }
}

// Edit post
async function editPost(postId) {
    // Redirect to edit page
    window.location.href = `edit-post.html?id=${postId}`;
}

// Delete post
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        await db.collection(POSTS_COLLECTION).doc(postId).delete();
        alert('Post deleted successfully');
        loadRecentPosts(); // Refresh the list
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post: ' + error.message);
    }
}

// Rich text editor functions
function formatText(command) {
    document.execCommand(command, false, null);
}

function insertList(type) {
    document.execCommand('insert' + (type === 'ul' ? 'UnorderedList' : 'OrderedList'));
}

function insertHeading() {
    const content = document.getElementById('postContent');
    const selection = content.value.substring(content.selectionStart, content.selectionEnd);
    const heading = `\n## ${selection}\n`;
    
    const before = content.value.substring(0, content.selectionStart);
    const after = content.value.substring(content.selectionEnd);
    content.value = before + heading + after;
}

function insertLink() {
    const url = prompt('Enter URL:');
    if (url) {
        document.execCommand('createLink', false, url);
    }
}

// Form handling for add post
document.addEventListener('DOMContentLoaded', function() {
    const addPostForm = document.getElementById('addPostForm');
    if (addPostForm) {
        addPostForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitPostBtn');
            const submitText = document.getElementById('submitText');
            const submitSpinner = document.getElementById('submitSpinner');
            
            // Get form data
            const postData = {
                title: document.getElementById('postTitle').value,
                slug: document.getElementById('postSlug').value || generateSlug(document.getElementById('postTitle').value),
                examType: document.getElementById('examType').value,
                subject: document.getElementById('subject').value,
                category: document.getElementById('category').value,
                content: document.getElementById('postContent').value,
                keywords: document.getElementById('keywords').value,
                status: document.getElementById('status').value,
                excerpt: document.getElementById('postContent').value.substring(0, 150) + '...'
            };
            
            // Get file
            const fileInput = document.getElementById('fileUpload');
            const file = fileInput.files[0];
            
            // Show loading state
            submitText.textContent = 'Publishing...';
            submitSpinner.classList.remove('d-none');
            submitBtn.disabled = true;
            
            try {
                const result = await addNewPost(postData, file);
                
                if (result.success) {
                    alert('Post published successfully!');
                    addPostForm.reset();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                // Reset button state
                submitText.textContent = 'Publish Post';
                submitSpinner.classList.add('d-none');
                submitBtn.disabled = false;
            }
        });
    }
});

// --- MCQ Management ---
function sortByPlacement(items) {
    return items.sort((a, b) => {
        const examA = String(a.exam || '');
        const examB = String(b.exam || '');
        if (examA !== examB) return examA.localeCompare(examB);

        const yearA = Number(a.year) || 0;
        const yearB = Number(b.year) || 0;
        if (yearA !== yearB) return yearB - yearA;

        const subjectA = String(a.subject || '');
        const subjectB = String(b.subject || '');
        if (subjectA !== subjectB) return subjectA.localeCompare(subjectB);

        const testA = String(a.test || '');
        const testB = String(b.test || '');
        return testA.localeCompare(testB);
    });
}

const mcqTableState = {
    rows: [],
    page: 1,
    pageSize: 20,
    groupBy: 'none',
    selected: new Set()
};

function getMCQCategory(mcq) {
    return String(mcq.coreTopic || mcq.category || 'General').trim();
}

function getMCQRelevantTest(mcq) {
    return String(mcq.relevantScheduleTest || mcq.relevant_schedule_test || mcq.test || '').trim();
}

function getMCQGroupValue(mcq, groupBy) {
    switch (groupBy) {
        case 'year':
            return String(mcq.year || 'Unknown Year');
        case 'subject':
            return String(mcq.subject || 'Unknown Subject');
        case 'category':
            return getMCQCategory(mcq) || 'General';
        case 'test':
            return getMCQRelevantTest(mcq) || 'No Relevant Test';
        case 'exam':
            return String(mcq.exam || 'combined');
        default:
            return '';
    }
}

function getCurrentPageMCQRows() {
    let workingRows = [...mcqTableState.rows];
    if (mcqTableState.groupBy !== 'none') {
        const groupBy = mcqTableState.groupBy;
        workingRows.sort((a, b) => {
            const ga = getMCQGroupValue(a, groupBy);
            const gb = getMCQGroupValue(b, groupBy);
            const groupCompare = String(ga).localeCompare(String(gb), undefined, { numeric: true, sensitivity: 'base' });
            if (groupCompare !== 0) return groupCompare;
            return 0;
        });
    }

    const total = workingRows.length;
    const totalPages = Math.max(1, Math.ceil(total / mcqTableState.pageSize));
    if (mcqTableState.page > totalPages) mcqTableState.page = totalPages;
    if (mcqTableState.page < 1) mcqTableState.page = 1;

    const start = (mcqTableState.page - 1) * mcqTableState.pageSize;
    const end = start + mcqTableState.pageSize;
    return {
        pageRows: workingRows.slice(start, end),
        total,
        totalPages
    };
}

function renderMCQTable() {
    const tbody = document.getElementById('mcqsTableBody');
    if (!tbody) return;

    const pageInfo = document.getElementById('mcqPageInfo');
    const prevBtn = document.getElementById('mcqPrevPageBtn');
    const nextBtn = document.getElementById('mcqNextPageBtn');
    const selectAll = document.getElementById('mcqSelectAll');

    const { pageRows, total, totalPages } = getCurrentPageMCQRows();
    tbody.innerHTML = '';

    if (!pageRows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted">No MCQs found</td>
            </tr>
        `;
    } else {
        let lastGroup = null;
        const groupBy = mcqTableState.groupBy;

        pageRows.forEach((mcq) => {
            if (groupBy !== 'none') {
                const groupValue = getMCQGroupValue(mcq, groupBy);
                if (groupValue !== lastGroup) {
                    tbody.innerHTML += `
                        <tr class="table-light">
                            <td colspan="9"><strong>${groupValue}</strong></td>
                        </tr>
                    `;
                    lastGroup = groupValue;
                }
            }

            const questionText = mcq.question || '';
            const relevantTest = getMCQRelevantTest(mcq);
            const category = getMCQCategory(mcq);
            const checked = mcqTableState.selected.has(mcq.id) ? 'checked' : '';

            tbody.innerHTML += `
                <tr>
                    <td><input type="checkbox" class="mcq-row-check" data-id="${mcq.id}" ${checked}></td>
                    <td>${mcq.exam || 'combined'}</td>
                    <td>${mcq.year || '-'}</td>
                    <td>${mcq.subject || '-'}</td>
                    <td>${category || '-'}</td>
                    <td>${relevantTest || '-'}</td>
                    <td>${questionText.substring(0, 50)}${questionText.length > 50 ? '...' : ''}</td>
                    <td>${mcq.correctOption || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditMCQ('${mcq.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMCQ('${mcq.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    }

    const pageIds = pageRows.map((r) => r.id);
    const selectedOnPage = pageIds.filter((id) => mcqTableState.selected.has(id)).length;
    if (selectAll) {
        selectAll.checked = pageIds.length > 0 && selectedOnPage === pageIds.length;
        selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < pageIds.length;
    }

    if (pageInfo) pageInfo.textContent = `Page ${mcqTableState.page} / ${totalPages} (Total: ${total})`;
    if (prevBtn) prevBtn.disabled = mcqTableState.page <= 1;
    if (nextBtn) nextBtn.disabled = mcqTableState.page >= totalPages;

    document.querySelectorAll('.mcq-row-check').forEach((node) => {
        node.addEventListener('change', function () {
            const id = this.getAttribute('data-id');
            if (!id) return;
            if (this.checked) mcqTableState.selected.add(id);
            else mcqTableState.selected.delete(id);
            renderMCQTable();
        });
    });
}

async function loadMCQs() {
    try {
        const snapshot = await db.collection(MCQS_COLLECTION).get();
        const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        mcqTableState.rows = sortByPlacement(rows);

        // Remove selections for rows that no longer exist.
        const availableIds = new Set(mcqTableState.rows.map((r) => r.id));
        mcqTableState.selected.forEach((id) => {
            if (!availableIds.has(id)) mcqTableState.selected.delete(id);
        });

        renderMCQTable();
    } catch (error) { console.error("Error loading MCQs", error); }
}

async function addMCQ(data) {
    try {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = 'published';
        await db.collection(MCQS_COLLECTION).add(data);
        alert('MCQ Added');
        loadMCQs();
        // Close modal (requires bootstrap instance or manual hide)
        document.querySelector('#addMCQModal .btn-close').click();
    } catch (error) { alert(error.message); }
}

async function deleteMCQ(id) {
    if(confirm('Delete this MCQ?')) {
        await db.collection(MCQS_COLLECTION).doc(id).delete();
        mcqTableState.selected.delete(id);
        loadMCQs();
    }
}

async function openEditMCQ(id) {
    try {
        const doc = await db.collection(MCQS_COLLECTION).doc(id).get();
        if (!doc.exists) {
            alert('MCQ not found.');
            return;
        }

        const mcq = doc.data();
        document.getElementById('editMcqId').value = id;
        document.getElementById('editMcqExam').value = mcq.exam || 'combined';
        document.getElementById('editMcqYear').value = mcq.year || '';
        document.getElementById('editMcqSubject').value = mcq.subject || '';
        document.getElementById('editMcqTest').value = mcq.test || '';
        document.getElementById('editMcqRelevantTest').value = mcq.relevantScheduleTest || mcq.relevant_schedule_test || '';
        document.getElementById('editMcqCoreTopic').value = mcq.coreTopic || mcq.core_topic || '';
        document.getElementById('editMcqQuestion').value = mcq.question || '';
        document.getElementById('editMcqStatements').value = Array.isArray(mcq.statements) ? mcq.statements.join('\n') : '';
        document.getElementById('editMcqOptionA').value = mcq.optionA || '';
        document.getElementById('editMcqOptionB').value = mcq.optionB || '';
        document.getElementById('editMcqOptionC').value = mcq.optionC || '';
        document.getElementById('editMcqOptionD').value = mcq.optionD || '';
        document.getElementById('editMcqCorrect').value = mcq.correctOption || 'Option A';
        document.getElementById('editMcqExplanation').value = mcq.explanation || '';

        const modalElement = document.getElementById('editMCQModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
    } catch (error) {
        alert(`Failed to load MCQ: ${error.message}`);
    }
}

async function updateMCQ(id, payload) {
    await db.collection(MCQS_COLLECTION).doc(id).update({
        ...payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function deleteSelectedMCQs() {
    const ids = Array.from(mcqTableState.selected);
    if (!ids.length) {
        alert('Please select at least one MCQ.');
        return;
    }

    if (!confirm(`Delete ${ids.length} selected MCQ(s)?`)) return;

    try {
        const chunkSize = 400;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const batch = db.batch();
            chunk.forEach((id) => {
                batch.delete(db.collection(MCQS_COLLECTION).doc(id));
            });
            await batch.commit();
        }

        mcqTableState.selected.clear();
        await loadMCQs();
        alert(`Deleted ${ids.length} MCQ(s).`);
    } catch (error) {
        alert(`Error deleting selected MCQs: ${error.message}`);
    }
}

// --- PYQ Management ---
async function loadPYQs() {
    try {
        const snapshot = await db.collection(PYQS_COLLECTION).orderBy('year', 'desc').limit(50).get();
        const tbody = document.getElementById('pyqsTableBody');
        tbody.innerHTML = '';

        const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        sortByPlacement(rows).forEach(pyq => {
            const questionText = pyq.question || '';
            tbody.innerHTML += `
                <tr>
                    <td>${pyq.exam || 'combined'}</td>
                    <td>${pyq.year}</td>
                    <td>${pyq.subject}</td>
                    <td>${pyq.test || '-'}</td>
                    <td>${questionText.substring(0, 50)}${questionText.length > 50 ? '...' : ''}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deletePYQ('${pyq.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    } catch (error) { console.error("Error loading PYQs", error); }
}

async function addPYQ(data) {
    try {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = 'published';
        await db.collection(PYQS_COLLECTION).add(data);
        alert('PYQ Added');
        loadPYQs();
        document.querySelector('#addPYQModal .btn-close').click();
    } catch (error) { alert(error.message); }
}

async function deletePYQ(id) {
    if(confirm('Delete this PYQ?')) {
        await db.collection(PYQS_COLLECTION).doc(id).delete();
        loadPYQs();
    }
}

function renderBulkImportStatus(containerId, type, message, details = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const alertType = type === 'success' ? 'success' : (type === 'warning' ? 'warning' : (type === 'processing' ? 'secondary' : 'danger'));
    const detailHtml = details.length ? `<ul class="mb-0 mt-2">${details.map((item) => `<li>${item}</li>`).join('')}</ul>` : '';

    container.innerHTML = `
        <div class="alert alert-${alertType} mb-0">
            ${message}
            ${detailHtml}
        </div>
    `;
}

function parseBulkArray(raw, label) {
    if (!raw || !raw.trim()) {
        throw new Error(`${label} JSON is empty.`);
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
    }

    if (Array.isArray(parsed)) {
        if (!parsed.length) {
            throw new Error(`${label} array is empty.`);
        }
        return parsed;
    }

    // Compatibility mode: allow wrapped object payload with questions/items array.
    if (parsed && typeof parsed === 'object') {
        const list = Array.isArray(parsed.questions)
            ? parsed.questions
            : (Array.isArray(parsed.items) ? parsed.items : null);

        if (!list) {
            throw new Error(`${label} must be a JSON array or an object with "questions" array.`);
        }
        if (!list.length) {
            throw new Error(`${label} questions array is empty.`);
        }

        const compositeTest = [parsed.paper, parsed.set, parsed.batch]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .join(' | ');

        const defaults = {
            year: parsed.year,
            exam: parsed.exam,
            subject: parsed.subject,
            test: parsed.test || compositeTest
        };

        return list.map((item) => ({
            ...defaults,
            ...item,
            year: item.year ?? defaults.year,
            exam: item.exam ?? defaults.exam,
            subject: item.subject ?? defaults.subject,
            test: item.test ?? defaults.test
        }));
    }

    throw new Error(`${label} must be a JSON array.`);
}

async function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
}

function normalizeLineBreaks(text) {
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function splitLines(text) {
    return normalizeLineBreaks(text)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

async function extractPdfText(file) {
    if (!window.pdfjsLib) {
        throw new Error('PDF parser not loaded. Refresh page and try again.');
    }

    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }

    const bytes = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join('\n');
        fullText += `${pageText}\n`;
    }

    return fullText;
}

function toCorrectOption(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'A' || normalized.includes('OPTION A')) return 'Option A';
    if (normalized === 'B' || normalized.includes('OPTION B')) return 'Option B';
    if (normalized === 'C' || normalized.includes('OPTION C')) return 'Option C';
    if (normalized === 'D' || normalized.includes('OPTION D')) return 'Option D';
    return '';
}

function parseMcqBlocksFromText(text, defaults) {
    const lines = splitLines(text);
    const blocks = [];
    let current = null;

    const startRe = /^(?:Q(?:uestion)?\s*\d+[\).\:-]?|\d+[\).\:-])\s*(.+)$/i;
    const optionRe = /^([ABCD])[\).\:-]\s*(.+)$/i;
    const answerRe = /^(?:Answer|Ans|Correct(?:\s*Option)?)\s*[:\-]\s*(.+)$/i;
    const explanationRe = /^Explanation\s*[:\-]\s*(.+)$/i;

    const pushCurrent = () => {
        if (!current) return;
        if (current.question && current.options.A && current.options.B && current.options.C && current.options.D) {
            blocks.push({
                exam: defaults.exam,
                year: defaults.year,
                subject: defaults.subject,
                test: defaults.test,
                question: current.question,
                optionA: current.options.A,
                optionB: current.options.B,
                optionC: current.options.C,
                optionD: current.options.D,
                correctOption: current.correctOption || 'Option A',
                explanation: current.explanation || ''
            });
        }
    };

    lines.forEach((line) => {
        const startMatch = line.match(startRe);
        if (startMatch) {
            pushCurrent();
            current = {
                question: startMatch[1].trim(),
                options: {},
                correctOption: '',
                explanation: ''
            };
            return;
        }

        if (!current) return;

        const optMatch = line.match(optionRe);
        if (optMatch) {
            current.options[optMatch[1].toUpperCase()] = optMatch[2].trim();
            return;
        }

        const ansMatch = line.match(answerRe);
        if (ansMatch) {
            current.correctOption = toCorrectOption(ansMatch[1]);
            return;
        }

        const expMatch = line.match(explanationRe);
        if (expMatch) {
            current.explanation = expMatch[1].trim();
            return;
        }

        // Continue multi-line question until options start.
        if (Object.keys(current.options).length === 0) {
            current.question = `${current.question} ${line}`.trim();
        }
    });

    pushCurrent();
    return blocks;
}

function parsePyqBlocksFromText(text, defaults) {
    const lines = splitLines(text);
    const blocks = [];
    let current = null;

    const startRe = /^(?:Q(?:uestion)?\s*\d+[\).\:-]?|\d+[\).\:-])\s*(.+)$/i;
    const answerRe = /^(?:Answer|Ans|Model\s*Answer)\s*[:\-]\s*(.+)$/i;

    const pushCurrent = () => {
        if (!current) return;
        if (current.question) {
            blocks.push({
                exam: defaults.exam,
                year: defaults.year,
                subject: defaults.subject,
                test: defaults.test,
                question: current.question,
                answer: current.answer || ''
            });
        }
    };

    lines.forEach((line) => {
        const startMatch = line.match(startRe);
        if (startMatch) {
            pushCurrent();
            current = { question: startMatch[1].trim(), answer: '' };
            return;
        }

        if (!current) return;

        const ansMatch = line.match(answerRe);
        if (ansMatch) {
            current.answer = ansMatch[1].trim();
            return;
        }

        if (!current.answer) {
            current.question = `${current.question} ${line}`.trim();
        } else {
            current.answer = `${current.answer} ${line}`.trim();
        }
    });

    pushCurrent();
    return blocks;
}

function parsePositiveYear(value) {
    const y = parseInt(String(value || '').trim(), 10);
    if (Number.isInteger(y) && y >= 1900 && y <= 2100) return y;
    return new Date().getFullYear();
}

function normalizeBulkMCQ(item) {
    const examRaw = String(item.exam || 'combined').trim().toLowerCase();
    let exam = 'combined';
    if (['prelims', 'mains', 'combined'].includes(examRaw)) {
        exam = examRaw;
    } else if (examRaw.includes('prelim')) {
        exam = 'prelims';
    } else if (examRaw.includes('main')) {
        exam = 'mains';
    }
    const year = Number(item.year);
    const subject = String(item.subject || '').trim();
    const derivedTest = item.test
        || item.relevant_schedule_test
        || item.relevantScheduleTest
        || item.schedule_test
        || item.scheduleTest
        || [item.paper, item.set, item.batch].map((v) => String(v || '').trim()).filter(Boolean).join(' | ');
    const test = String(derivedTest || '').trim();
    const coreTopic = String(item.core_topic || item.coreTopic || '').trim();
    const relevantScheduleTest = String(item.relevant_schedule_test || item.relevantScheduleTest || '').trim();
    const question = String(item.question || item.question_text || item.questionText || '').trim();
    const statements = Array.isArray(item.statements)
        ? item.statements.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
    const explanation = String(item.explanation || '').trim();

    let optionA = String(item.optionA || '').trim();
    let optionB = String(item.optionB || '').trim();
    let optionC = String(item.optionC || '').trim();
    let optionD = String(item.optionD || '').trim();

    if ((!optionA || !optionB || !optionC || !optionD) && Array.isArray(item.options) && item.options.length >= 4) {
        optionA = optionA || String(item.options[0] || '').trim();
        optionB = optionB || String(item.options[1] || '').trim();
        optionC = optionC || String(item.options[2] || '').trim();
        optionD = optionD || String(item.options[3] || '').trim();
    }

    if ((!optionA || !optionB || !optionC || !optionD) && item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
        optionA = optionA || String(item.options.A || item.options.a || '').trim();
        optionB = optionB || String(item.options.B || item.options.b || '').trim();
        optionC = optionC || String(item.options.C || item.options.c || '').trim();
        optionD = optionD || String(item.options.D || item.options.d || '').trim();
    }

    let correctOption = String(item.correctOption || '').trim();
    if (!correctOption && item.answer) {
        correctOption = toCorrectOption(item.answer);
    }
    if (!correctOption && item.answerKey) {
        correctOption = toCorrectOption(item.answerKey);
    }
    if (!correctOption && item.correct_answer) {
        correctOption = toCorrectOption(item.correct_answer);
    }
    if (!correctOption && Number.isInteger(item.answerIndex) && item.answerIndex >= 0 && item.answerIndex <= 3) {
        correctOption = ['Option A', 'Option B', 'Option C', 'Option D'][item.answerIndex];
    }

    if (!subject) throw new Error('subject is required');
    if (!question) throw new Error('question is required');
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('year must be a valid number (1900-2100)');
    if (!optionA || !optionB || !optionC || !optionD) throw new Error('all 4 options are required');
    if (!['Option A', 'Option B', 'Option C', 'Option D'].includes(correctOption)) throw new Error('correctOption/answer is required (Option A/B/C/D or answerIndex 0-3)');

    return {
        exam,
        year,
        subject,
        test,
        coreTopic,
        relevantScheduleTest,
        question,
        statements,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        explanation,
        status: 'published',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function normalizeBulkPYQ(item) {
    const examRaw = String(item.exam || 'combined').trim().toLowerCase();
    const exam = ['prelims', 'mains', 'combined'].includes(examRaw) ? examRaw : 'combined';
    const year = Number(item.year);
    const subject = String(item.subject || '').trim();
    const derivedTest = item.test
        || item.relevant_schedule_test
        || item.relevantScheduleTest
        || item.schedule_test
        || item.scheduleTest
        || [item.paper, item.set, item.batch].map((v) => String(v || '').trim()).filter(Boolean).join(' | ');
    const test = String(derivedTest || '').trim();
    const question = String(item.question || '').trim();
    const answer = String(item.answer || '').trim();

    if (!subject) throw new Error('subject is required');
    if (!question) throw new Error('question is required');
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('year must be a valid number (1900-2100)');

    return {
        exam,
        year,
        subject,
        test,
        question,
        answer,
        status: 'published',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function normalizeTextForKey(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function buildMCQDuplicateKey(data) {
    const question = normalizeTextForKey(data.question || data.question_text || data.questionText);

    let optionA = data.optionA;
    let optionB = data.optionB;
    let optionC = data.optionC;
    let optionD = data.optionD;
    if ((!optionA || !optionB || !optionC || !optionD) && data.options && typeof data.options === 'object') {
        if (Array.isArray(data.options)) {
            optionA = optionA || data.options[0];
            optionB = optionB || data.options[1];
            optionC = optionC || data.options[2];
            optionD = optionD || data.options[3];
        } else {
            optionA = optionA || data.options.A || data.options.a;
            optionB = optionB || data.options.B || data.options.b;
            optionC = optionC || data.options.C || data.options.c;
            optionD = optionD || data.options.D || data.options.d;
        }
    }

    const optionsKey = [
        normalizeTextForKey(optionA),
        normalizeTextForKey(optionB),
        normalizeTextForKey(optionC),
        normalizeTextForKey(optionD)
    ].join('|');

    const year = Number(data.year) || 0;
    const examRaw = normalizeTextForKey(data.exam || 'combined');
    const exam = examRaw.includes('prelim') ? 'prelims' : (examRaw.includes('main') ? 'mains' : (examRaw || 'combined'));
    return `${exam}::${year}::${question}::${optionsKey}`;
}

async function bulkImportMCQs(raw) {
    const items = parseBulkArray(raw, 'MCQ');
    let successCount = 0;
    let failCount = 0;
    let duplicateCount = 0;
    const errors = [];
    const existingKeySet = new Set();

    const existingSnapshot = await db.collection(MCQS_COLLECTION).get();
    existingSnapshot.forEach((doc) => {
        const key = buildMCQDuplicateKey(doc.data());
        if (key) existingKeySet.add(key);
    });

    for (let i = 0; i < items.length; i += 1) {
        try {
            const payload = normalizeBulkMCQ(items[i]);
            const key = buildMCQDuplicateKey(payload);
            if (key && existingKeySet.has(key)) {
                duplicateCount += 1;
                throw new Error('duplicate question detected');
            }
            await db.collection(MCQS_COLLECTION).add(payload);
            if (key) existingKeySet.add(key);
            successCount += 1;
        } catch (error) {
            failCount += 1;
            errors.push(`Item ${i + 1}: ${error.message}`);
        }
    }

    return { total: items.length, successCount, failCount, duplicateCount, errors };
}

async function bulkImportPYQs(raw) {
    const items = parseBulkArray(raw, 'PYQ');
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < items.length; i += 1) {
        try {
            const payload = normalizeBulkPYQ(items[i]);
            await db.collection(PYQS_COLLECTION).add(payload);
            successCount += 1;
        } catch (error) {
            failCount += 1;
            errors.push(`Item ${i + 1}: ${error.message}`);
        }
    }

    return { total: items.length, successCount, failCount, errors };
}

function resolveYearFromDoc(data) {
    if (Number.isInteger(data.year) && data.year >= 1900 && data.year <= 2100) {
        return data.year;
    }

    if (typeof data.year === 'string') {
        const parsed = parseInt(data.year, 10);
        if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) {
            return parsed;
        }
    }

    const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate()
        : null;
    if (createdAt && !Number.isNaN(createdAt.getFullYear())) {
        return createdAt.getFullYear();
    }

    return new Date().getFullYear();
}

function inferExamForMCQ(data) {
    const subject = String(data.subject || '').toLowerCase();
    const test = String(data.test || '').toLowerCase();
    const examRaw = String(data.exam || '').toLowerCase().trim();
    if (['prelims', 'mains', 'combined'].includes(examRaw)) {
        return examRaw;
    }

    if (subject.includes('gs1') || subject.includes('gs2') || subject.includes('gs3') || subject.includes('gs4') || subject.includes('ethics') || subject.includes('essay')) {
        return 'mains';
    }

    if (test.includes('prelims')) return 'prelims';
    if (test.includes('mains')) return 'mains';
    return 'combined';
}

function inferExamForPYQ(data) {
    const subject = String(data.subject || '').toLowerCase();
    const test = String(data.test || '').toLowerCase();
    const examRaw = String(data.exam || '').toLowerCase().trim();
    if (['prelims', 'mains', 'combined'].includes(examRaw)) {
        return examRaw;
    }

    if (subject.includes('gs1') || subject.includes('gs2') || subject.includes('gs3') || subject.includes('gs4') || subject.includes('ethics') || subject.includes('essay')) {
        return 'mains';
    }

    if (test.includes('prelims')) return 'prelims';
    if (test.includes('mains')) return 'mains';
    return 'combined';
}

async function backfillCollectionPlacement(collectionName, examResolver) {
    const pageSize = 200;
    let lastDoc = null;
    let scanned = 0;
    let updated = 0;
    let unchanged = 0;

    while (true) {
        let query = db.collection(collectionName)
            .orderBy(firebase.firestore.FieldPath.documentId())
            .limit(pageSize);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        let batchUpdates = 0;

        snapshot.docs.forEach((doc) => {
            scanned += 1;
            const data = doc.data();
            const nextExam = examResolver(data);
            const nextYear = resolveYearFromDoc(data);
            const nextTest = typeof data.test === 'string' ? data.test.trim() : '';

            const hasExam = typeof data.exam === 'string' && data.exam.trim().length > 0;
            const hasValidYear = Number.isInteger(data.year) && data.year >= 1900 && data.year <= 2100;
            const hasTest = typeof data.test === 'string';

            const payload = {};
            if (!hasExam) payload.exam = nextExam;
            if (!hasValidYear) payload.year = nextYear;
            if (!hasTest) payload.test = nextTest;

            if (Object.keys(payload).length > 0) {
                payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                batch.update(doc.ref, payload);
                batchUpdates += 1;
                updated += 1;
            } else {
                unchanged += 1;
            }
        });

        if (batchUpdates > 0) {
            await batch.commit();
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < pageSize) break;
    }

    return { scanned, updated, unchanged };
}

async function runQuestionsBackfill() {
    const statusId = 'backfillQuestionsStatus';
    renderBulkImportStatus(statusId, 'processing', 'Backfill in progress...');

    const mcqResult = await backfillCollectionPlacement(MCQS_COLLECTION, inferExamForMCQ);
    const pyqResult = await backfillCollectionPlacement(PYQS_COLLECTION, inferExamForPYQ);

    await loadMCQs();
    await loadPYQs();

    renderBulkImportStatus(
        statusId,
        'success',
        'Backfill completed.',
        [
            `MCQs -> scanned: ${mcqResult.scanned}, updated: ${mcqResult.updated}, unchanged: ${mcqResult.unchanged}`,
            `PYQs -> scanned: ${pyqResult.scanned}, updated: ${pyqResult.updated}, unchanged: ${pyqResult.unchanged}`
        ]
    );
}

// Event Listeners for New Forms
document.addEventListener('DOMContentLoaded', function() {
    const mcqGroupBy = document.getElementById('mcqGroupBy');
    const mcqPageSize = document.getElementById('mcqPageSize');
    const mcqPrevPageBtn = document.getElementById('mcqPrevPageBtn');
    const mcqNextPageBtn = document.getElementById('mcqNextPageBtn');
    const mcqSelectAll = document.getElementById('mcqSelectAll');
    const deleteSelectedMCQsBtn = document.getElementById('deleteSelectedMCQsBtn');

    if (mcqGroupBy) {
        mcqGroupBy.addEventListener('change', function () {
            mcqTableState.groupBy = this.value || 'none';
            mcqTableState.page = 1;
            renderMCQTable();
        });
    }

    if (mcqPageSize) {
        mcqPageSize.addEventListener('change', function () {
            const parsed = parseInt(this.value, 10);
            mcqTableState.pageSize = Number.isInteger(parsed) && parsed > 0 ? parsed : 20;
            mcqTableState.page = 1;
            renderMCQTable();
        });
    }

    if (mcqPrevPageBtn) {
        mcqPrevPageBtn.addEventListener('click', function () {
            mcqTableState.page -= 1;
            renderMCQTable();
        });
    }

    if (mcqNextPageBtn) {
        mcqNextPageBtn.addEventListener('click', function () {
            mcqTableState.page += 1;
            renderMCQTable();
        });
    }

    if (mcqSelectAll) {
        mcqSelectAll.addEventListener('change', function () {
            const { pageRows } = getCurrentPageMCQRows();
            pageRows.forEach((row) => {
                if (this.checked) mcqTableState.selected.add(row.id);
                else mcqTableState.selected.delete(row.id);
            });
            renderMCQTable();
        });
    }

    if (deleteSelectedMCQsBtn) {
        deleteSelectedMCQsBtn.addEventListener('click', deleteSelectedMCQs);
    }

    const mcqForm = document.getElementById('addMCQForm');
    if(mcqForm) {
        mcqForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const data = {
                exam: document.getElementById('mcqExam').value.trim(),
                year: parseInt(document.getElementById('mcqYear').value, 10),
                subject: document.getElementById('mcqSubject').value.trim(),
                test: document.getElementById('mcqTest').value.trim(),
                question: document.getElementById('mcqQuestion').value.trim(),
                optionA: document.getElementById('mcqOptionA').value.trim(),
                optionB: document.getElementById('mcqOptionB').value.trim(),
                optionC: document.getElementById('mcqOptionC').value.trim(),
                optionD: document.getElementById('mcqOptionD').value.trim(),
                correctOption: document.getElementById('mcqCorrect').value,
                explanation: document.getElementById('mcqExplanation').value.trim()
            };
            addMCQ(data);
            mcqForm.reset();
        });
    }

    const pyqForm = document.getElementById('addPYQForm');
    if(pyqForm) {
        pyqForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const data = {
                exam: document.getElementById('pyqExam').value.trim(),
                year: parseInt(document.getElementById('pyqYear').value, 10),
                subject: document.getElementById('pyqSubject').value.trim(),
                test: document.getElementById('pyqTest').value.trim(),
                question: document.getElementById('pyqQuestion').value.trim(),
                answer: document.getElementById('pyqAnswer').value.trim()
            };
            addPYQ(data);
            pyqForm.reset();
        });
    }

    const editMcqForm = document.getElementById('editMCQForm');
    if (editMcqForm) {
        editMcqForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const id = document.getElementById('editMcqId').value;
            if (!id) {
                alert('Missing MCQ id.');
                return;
            }

            const statements = document.getElementById('editMcqStatements').value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);

            const payload = {
                exam: document.getElementById('editMcqExam').value.trim(),
                year: parseInt(document.getElementById('editMcqYear').value, 10),
                subject: document.getElementById('editMcqSubject').value.trim(),
                test: document.getElementById('editMcqTest').value.trim(),
                relevantScheduleTest: document.getElementById('editMcqRelevantTest').value.trim(),
                coreTopic: document.getElementById('editMcqCoreTopic').value.trim(),
                question: document.getElementById('editMcqQuestion').value.trim(),
                statements,
                optionA: document.getElementById('editMcqOptionA').value.trim(),
                optionB: document.getElementById('editMcqOptionB').value.trim(),
                optionC: document.getElementById('editMcqOptionC').value.trim(),
                optionD: document.getElementById('editMcqOptionD').value.trim(),
                correctOption: document.getElementById('editMcqCorrect').value,
                explanation: document.getElementById('editMcqExplanation').value.trim()
            };

            try {
                await updateMCQ(id, payload);
                const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editMCQModal'));
                modal.hide();
                await loadMCQs();
                alert('MCQ updated successfully.');
            } catch (error) {
                alert(`Failed to update MCQ: ${error.message}`);
            }
        });
    }

    const importMCQBulkBtn = document.getElementById('importMCQBulkBtn');
    const clearMCQBulkBtn = document.getElementById('clearMCQBulkBtn');
    const mcqBulkJsonInput = document.getElementById('mcqBulkJsonInput');
    const loadMCQJsonFileBtn = document.getElementById('loadMCQJsonFileBtn');
    const mcqJsonFileInput = document.getElementById('mcqJsonFileInput');
    if (importMCQBulkBtn && mcqBulkJsonInput) {
        importMCQBulkBtn.addEventListener('click', async function() {
            try {
                renderBulkImportStatus('mcqBulkImportStatus', 'processing', 'Importing MCQs...');
                importMCQBulkBtn.disabled = true;
                const result = await bulkImportMCQs(mcqBulkJsonInput.value);
                await loadMCQs();

                const statusType = result.failCount ? 'warning' : 'success';
                renderBulkImportStatus(
                    'mcqBulkImportStatus',
                    statusType,
                    `MCQ import completed. Total: ${result.total}, Success: ${result.successCount}, Failed: ${result.failCount}, Duplicates: ${result.duplicateCount || 0}`,
                    result.errors.slice(0, 10)
                );

                if (result.failCount === 0) {
                    mcqBulkJsonInput.value = '';
                    const mcqJsonFileInput = document.getElementById('mcqJsonFileInput');
                    const mcqPdfFileInput = document.getElementById('mcqPdfFileInput');
                    if (mcqJsonFileInput) mcqJsonFileInput.value = '';
                    if (mcqPdfFileInput) mcqPdfFileInput.value = '';
                }
            } catch (error) {
                renderBulkImportStatus('mcqBulkImportStatus', 'error', `MCQ import failed: ${error.message}`);
            } finally {
                importMCQBulkBtn.disabled = false;
            }
        });
    }
    if (clearMCQBulkBtn && mcqBulkJsonInput) {
        clearMCQBulkBtn.addEventListener('click', function() {
            mcqBulkJsonInput.value = '';
            const status = document.getElementById('mcqBulkImportStatus');
            if (status) status.innerHTML = '';
        });
    }
    if (loadMCQJsonFileBtn && mcqJsonFileInput && mcqBulkJsonInput) {
        loadMCQJsonFileBtn.addEventListener('click', async function() {
            try {
                const file = mcqJsonFileInput.files && mcqJsonFileInput.files[0];
                if (!file) throw new Error('Choose an MCQ JSON file first.');
                renderBulkImportStatus('mcqBulkImportStatus', 'processing', 'Loading MCQ JSON file...');
                loadMCQJsonFileBtn.disabled = true;

                const text = await readTextFile(file);
                parseBulkArray(text, 'MCQ');
                mcqBulkJsonInput.value = text;
                renderBulkImportStatus('mcqBulkImportStatus', 'success', 'MCQ JSON loaded. Review and click "Import MCQs".');
            } catch (error) {
                renderBulkImportStatus('mcqBulkImportStatus', 'error', `MCQ JSON load failed: ${error.message}`);
            } finally {
                loadMCQJsonFileBtn.disabled = false;
            }
        });
    }

    const extractMCQPdfBtn = document.getElementById('extractMCQPdfBtn');
    const mcqPdfFileInput = document.getElementById('mcqPdfFileInput');
    if (extractMCQPdfBtn && mcqPdfFileInput && mcqBulkJsonInput) {
        extractMCQPdfBtn.addEventListener('click', async function() {
            try {
                const file = mcqPdfFileInput.files && mcqPdfFileInput.files[0];
                if (!file) throw new Error('Choose an MCQ PDF file first.');

                renderBulkImportStatus('mcqBulkImportStatus', 'processing', 'Extracting MCQ PDF...');
                extractMCQPdfBtn.disabled = true;

                const defaults = {
                    exam: (document.getElementById('mcqPdfDefaultExam')?.value || 'combined').trim(),
                    year: parsePositiveYear(document.getElementById('mcqPdfDefaultYear')?.value),
                    subject: (document.getElementById('mcqPdfDefaultSubject')?.value || 'General').trim() || 'General',
                    test: (document.getElementById('mcqPdfDefaultTest')?.value || '').trim()
                };

                const text = await extractPdfText(file);
                const parsed = parseMcqBlocksFromText(text, defaults);

                if (!parsed.length) {
                    throw new Error('No MCQ blocks parsed. Ensure PDF uses numbered questions and A/B/C/D options.');
                }

                mcqBulkJsonInput.value = JSON.stringify(parsed, null, 2);
                renderBulkImportStatus('mcqBulkImportStatus', 'success', `Extracted ${parsed.length} MCQs to JSON draft. Review and click "Import MCQs".`);
            } catch (error) {
                renderBulkImportStatus('mcqBulkImportStatus', 'error', `MCQ PDF extraction failed: ${error.message}`);
            } finally {
                extractMCQPdfBtn.disabled = false;
            }
        });
    }

    const importPYQBulkBtn = document.getElementById('importPYQBulkBtn');
    const clearPYQBulkBtn = document.getElementById('clearPYQBulkBtn');
    const pyqBulkJsonInput = document.getElementById('pyqBulkJsonInput');
    const loadPYQJsonFileBtn = document.getElementById('loadPYQJsonFileBtn');
    const pyqJsonFileInput = document.getElementById('pyqJsonFileInput');
    if (importPYQBulkBtn && pyqBulkJsonInput) {
        importPYQBulkBtn.addEventListener('click', async function() {
            try {
                renderBulkImportStatus('pyqBulkImportStatus', 'processing', 'Importing PYQs...');
                importPYQBulkBtn.disabled = true;
                const result = await bulkImportPYQs(pyqBulkJsonInput.value);
                await loadPYQs();

                const statusType = result.failCount ? 'warning' : 'success';
                renderBulkImportStatus(
                    'pyqBulkImportStatus',
                    statusType,
                    `PYQ import completed. Total: ${result.total}, Success: ${result.successCount}, Failed: ${result.failCount}`,
                    result.errors.slice(0, 10)
                );
            } catch (error) {
                renderBulkImportStatus('pyqBulkImportStatus', 'error', `PYQ import failed: ${error.message}`);
            } finally {
                importPYQBulkBtn.disabled = false;
            }
        });
    }
    if (clearPYQBulkBtn && pyqBulkJsonInput) {
        clearPYQBulkBtn.addEventListener('click', function() {
            pyqBulkJsonInput.value = '';
            const status = document.getElementById('pyqBulkImportStatus');
            if (status) status.innerHTML = '';
        });
    }
    if (loadPYQJsonFileBtn && pyqJsonFileInput && pyqBulkJsonInput) {
        loadPYQJsonFileBtn.addEventListener('click', async function() {
            try {
                const file = pyqJsonFileInput.files && pyqJsonFileInput.files[0];
                if (!file) throw new Error('Choose a PYQ JSON file first.');
                renderBulkImportStatus('pyqBulkImportStatus', 'processing', 'Loading PYQ JSON file...');
                loadPYQJsonFileBtn.disabled = true;

                const text = await readTextFile(file);
                parseBulkArray(text, 'PYQ');
                pyqBulkJsonInput.value = text;
                renderBulkImportStatus('pyqBulkImportStatus', 'success', 'PYQ JSON loaded. Review and click "Import PYQs".');
            } catch (error) {
                renderBulkImportStatus('pyqBulkImportStatus', 'error', `PYQ JSON load failed: ${error.message}`);
            } finally {
                loadPYQJsonFileBtn.disabled = false;
            }
        });
    }

    const extractPYQPdfBtn = document.getElementById('extractPYQPdfBtn');
    const pyqPdfFileInput = document.getElementById('pyqPdfFileInput');
    if (extractPYQPdfBtn && pyqPdfFileInput && pyqBulkJsonInput) {
        extractPYQPdfBtn.addEventListener('click', async function() {
            try {
                const file = pyqPdfFileInput.files && pyqPdfFileInput.files[0];
                if (!file) throw new Error('Choose a PYQ PDF file first.');

                renderBulkImportStatus('pyqBulkImportStatus', 'processing', 'Extracting PYQ PDF...');
                extractPYQPdfBtn.disabled = true;

                const defaults = {
                    exam: (document.getElementById('pyqPdfDefaultExam')?.value || 'combined').trim(),
                    year: parsePositiveYear(document.getElementById('pyqPdfDefaultYear')?.value),
                    subject: (document.getElementById('pyqPdfDefaultSubject')?.value || 'General').trim() || 'General',
                    test: (document.getElementById('pyqPdfDefaultTest')?.value || '').trim()
                };

                const text = await extractPdfText(file);
                const parsed = parsePyqBlocksFromText(text, defaults);

                if (!parsed.length) {
                    throw new Error('No PYQ blocks parsed. Ensure PDF uses numbered questions.');
                }

                pyqBulkJsonInput.value = JSON.stringify(parsed, null, 2);
                renderBulkImportStatus('pyqBulkImportStatus', 'success', `Extracted ${parsed.length} PYQs to JSON draft. Review and click "Import PYQs".`);
            } catch (error) {
                renderBulkImportStatus('pyqBulkImportStatus', 'error', `PYQ PDF extraction failed: ${error.message}`);
            } finally {
                extractPYQPdfBtn.disabled = false;
            }
        });
    }

    const backfillBtn = document.getElementById('backfillQuestionsBtn');
    if (backfillBtn) {
        backfillBtn.addEventListener('click', async function() {
            const ok = confirm('Backfill missing exam/year/test fields for all MCQ and PYQ documents?');
            if (!ok) return;

            try {
                backfillBtn.disabled = true;
                await runQuestionsBackfill();
            } catch (error) {
                renderBulkImportStatus('backfillQuestionsStatus', 'error', `Backfill failed: ${error.message}`);
            } finally {
                backfillBtn.disabled = false;
            }
        });
    }
});

// Refresh dashboard stats
function refreshStats() {
    loadDashboardStats();
    loadRecentPosts();
    loadMCQs();
    loadPYQs();
}

// --- Schedule Import ---
function parseScheduleJson(raw) {
    if (!raw || !raw.trim()) {
        throw new Error('JSON input is empty.');
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
    }
}

function parseDateToISO(dateValue) {
    if (typeof dateValue !== 'string') return null;

    const months = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    const match = dateValue.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = months[match[2].toLowerCase()];
    const year = parseInt(match[3], 10);

    if (Number.isNaN(day) || month === undefined || Number.isNaN(year)) return null;

    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
        return null;
    }

    return date.toISOString().slice(0, 10);
}

function computeProgramKey(program, subject, organization) {
    const normalize = (value) => String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

    return `${normalize(program)}__${normalize(subject)}__${normalize(organization)}`;
}

function normalizeSyllabus(syllabus) {
    if (!syllabus) return {};
    if (typeof syllabus === 'string') return { _raw: syllabus };
    if (typeof syllabus === 'object' && !Array.isArray(syllabus)) return syllabus;
    return {};
}

function normalizeSchedulePayload(payload) {
    const normalizedDays = payload.schedule.map((entry) => {
        const targets = Array.isArray(entry.targets)
            ? entry.targets.map(t => String(t).trim()).filter(Boolean)
            : (typeof entry.targets === 'string' && entry.targets.trim() ? [entry.targets.trim()] : []);

        return {
            dateRaw: String(entry.date || '').trim(),
            dateISO: parseDateToISO(entry.date),
            day: String(entry.day || '').trim(),
            classes: typeof entry.classes === 'string' && entry.classes.trim() ? entry.classes.trim() : null,
            targets,
            tests: typeof entry.tests === 'string' && entry.tests.trim() ? entry.tests.trim() : null,
            syllabus: normalizeSyllabus(entry.syllabus)
        };
    });

    const ordered = [...normalizedDays].sort((a, b) => (a.dateISO || '').localeCompare(b.dateISO || ''));
    const scheduleStartDate = ordered.length ? ordered[0].dateISO : null;
    const scheduleEndDate = ordered.length ? ordered[ordered.length - 1].dateISO : null;

    return {
        program: String(payload.program || '').trim(),
        type: String(payload.type || '').trim(),
        organization: String(payload.organization || '').trim(),
        subject: String(payload.subject || '').trim(),
        programKey: computeProgramKey(payload.program, payload.subject, payload.organization),
        scheduleStartDate,
        scheduleEndDate,
        totalDays: normalizedDays.length,
        days: normalizedDays
    };
}

function validateSchedulePayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { isValid: false, errors: ['Root JSON must be an object.'] };
    }

    ['program', 'type', 'organization', 'subject', 'schedule'].forEach((field) => {
        if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
            errors.push(`Missing required root field: ${field}`);
        }
    });

    if (!Array.isArray(payload.schedule)) {
        errors.push('Field "schedule" must be an array.');
    } else if (payload.schedule.length === 0) {
        errors.push('Field "schedule" must be a non-empty array.');
    } else {
        payload.schedule.forEach((entry, index) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                errors.push(`Schedule[${index}] must be an object.`);
                return;
            }

            if (!entry.date) {
                errors.push(`Schedule[${index}] missing required field: date`);
            } else if (!parseDateToISO(entry.date)) {
                errors.push(`Schedule[${index}] has invalid date "${entry.date}". Expected format like "17 Nov 2025".`);
            }

            if (!entry.day) {
                errors.push(`Schedule[${index}] missing required field: day`);
            }

            if (entry.targets !== undefined && !Array.isArray(entry.targets) && typeof entry.targets !== 'string') {
                errors.push(`Schedule[${index}] "targets" must be an array or string.`);
            }

            if (entry.tests !== undefined && entry.tests !== null && typeof entry.tests !== 'string') {
                errors.push(`Schedule[${index}] "tests" must be string or null.`);
            }

            if (entry.classes !== undefined && entry.classes !== null && typeof entry.classes !== 'string') {
                errors.push(`Schedule[${index}] "classes" must be string or null.`);
            }

            if (entry.syllabus !== undefined && entry.syllabus !== null && typeof entry.syllabus !== 'object' && typeof entry.syllabus !== 'string') {
                errors.push(`Schedule[${index}] "syllabus" must be object/string/null.`);
            }
        });
    }

    return { isValid: errors.length === 0, errors };
}

function renderValidationErrors(errors) {
    const validationCard = document.getElementById('scheduleValidationCard');
    const errorContainer = document.getElementById('scheduleValidationErrors');
    if (!validationCard || !errorContainer) return;

    validationCard.style.display = 'block';
    errorContainer.innerHTML = `
        <div class="alert alert-danger mb-0">
            <h6 class="mb-2">Validation failed</h6>
            <ul class="validation-list">${errors.map(err => `<li>${err}</li>`).join('')}</ul>
        </div>
    `;
}

function renderSchedulePreview(normalizedPayload) {
    const previewCard = document.getElementById('schedulePreviewCard');
    const header = document.getElementById('scheduleProgramHeader');
    const body = document.getElementById('schedulePreviewBody');
    const importBtn = document.getElementById('importScheduleBtn');
    const validationCard = document.getElementById('scheduleValidationCard');
    const importStatusCard = document.getElementById('scheduleImportStatusCard');

    if (!previewCard || !header || !body || !importBtn) return;

    if (validationCard) validationCard.style.display = 'none';
    if (importStatusCard) importStatusCard.style.display = 'none';

    header.innerHTML = `
        <div class="d-flex flex-wrap gap-2">
            <span class="badge bg-primary">${normalizedPayload.program}</span>
            <span class="badge bg-secondary">${normalizedPayload.subject}</span>
            <span class="badge bg-dark">${normalizedPayload.organization}</span>
            <span class="badge bg-info text-dark">${normalizedPayload.type}</span>
            <span class="badge bg-success">Days: ${normalizedPayload.totalDays}</span>
        </div>
        <small class="text-muted d-block mt-2">
            Range: ${normalizedPayload.scheduleStartDate || 'N/A'} to ${normalizedPayload.scheduleEndDate || 'N/A'}
        </small>
    `;

    body.innerHTML = normalizedPayload.days.map((day) => {
        const syllabusKeys = Object.keys(day.syllabus || {});
        return `
            <tr>
                <td>${day.dateISO || '-'}</td>
                <td>${day.day || '-'}</td>
                <td>${day.classes || '-'}</td>
                <td>${day.targets.join(', ') || '-'}</td>
                <td>${day.tests || '-'}</td>
                <td>${syllabusKeys.length ? syllabusKeys.join(', ') : '-'}</td>
            </tr>
        `;
    }).join('');

    previewCard.style.display = 'block';
    importBtn.disabled = false;
}

async function upsertScheduleDays(scheduleRef, days) {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const day of days) {
        if (!day.dateISO) {
            skipped += 1;
            continue;
        }

        const dayRef = scheduleRef.collection('days').doc(day.dateISO);
        const dayDoc = await dayRef.get();

        const payload = {
            dateRaw: day.dateRaw,
            dateISO: day.dateISO,
            day: day.day,
            classes: day.classes,
            targets: day.targets,
            tests: day.tests,
            syllabus: day.syllabus,
            importedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (dayDoc.exists) {
            await dayRef.set(payload, { merge: true });
            updated += 1;
        } else {
            await dayRef.set(payload);
            inserted += 1;
        }
    }

    return { inserted, updated, skipped };
}

async function upsertProgramSchedule(normalizedPayload) {
    const user = auth.currentUser;
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const existing = await db.collection(PROGRAM_SCHEDULES_COLLECTION)
        .where('programKey', '==', normalizedPayload.programKey)
        .limit(1)
        .get();

    const commonFields = {
        program: normalizedPayload.program,
        type: normalizedPayload.type,
        organization: normalizedPayload.organization,
        subject: normalizedPayload.subject,
        programKey: normalizedPayload.programKey,
        scheduleStartDate: normalizedPayload.scheduleStartDate,
        scheduleEndDate: normalizedPayload.scheduleEndDate,
        totalDays: normalizedPayload.totalDays,
        lastImportedAt: now,
        updatedAt: now,
        createdBy: user ? user.uid : null,
        authorEmail: user ? user.email : null
    };

    let scheduleRef;
    let wasCreated = false;

    if (existing.empty) {
        scheduleRef = db.collection(PROGRAM_SCHEDULES_COLLECTION).doc();
        await scheduleRef.set({
            ...commonFields,
            createdAt: now
        });
        wasCreated = true;
    } else {
        scheduleRef = existing.docs[0].ref;
        await scheduleRef.update(commonFields);
    }

    return { scheduleRef, scheduleId: scheduleRef.id, wasCreated };
}

async function handleScheduleImportSubmit() {
    const statusCard = document.getElementById('scheduleImportStatusCard');
    const statusContainer = document.getElementById('scheduleImportStatus');
    const importBtn = document.getElementById('importScheduleBtn');

    if (!validatedSchedulePayload) {
        alert('Please validate JSON before import.');
        return;
    }

    try {
        importBtn.disabled = true;
        if (statusCard) statusCard.style.display = 'block';
        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="alert alert-secondary mb-0">
                    Import in progress...
                </div>
            `;
        }

        const parentResult = await upsertProgramSchedule(validatedSchedulePayload);
        const dayResult = await upsertScheduleDays(parentResult.scheduleRef, validatedSchedulePayload.days);

        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="alert alert-success mb-0">
                    <h6 class="mb-2">Import completed</h6>
                    <p class="mb-1"><strong>Program:</strong> ${validatedSchedulePayload.program}</p>
                    <p class="mb-1"><strong>Subject:</strong> ${validatedSchedulePayload.subject}</p>
                    <p class="mb-1"><strong>Parent Doc ID:</strong> ${parentResult.scheduleId}</p>
                    <p class="mb-0"><strong>Inserted:</strong> ${dayResult.inserted} | <strong>Updated:</strong> ${dayResult.updated} | <strong>Skipped:</strong> ${dayResult.skipped}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Schedule import failed:', error);
        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <h6 class="mb-2">Import failed</h6>
                    <p class="mb-0">${error.message}</p>
                </div>
            `;
        }
    } finally {
        importBtn.disabled = false;
    }
}

function clearScheduleImportUI() {
    validatedSchedulePayload = null;

    const input = document.getElementById('scheduleJsonInput');
    const importBtn = document.getElementById('importScheduleBtn');
    const previewCard = document.getElementById('schedulePreviewCard');
    const validationCard = document.getElementById('scheduleValidationCard');
    const importStatusCard = document.getElementById('scheduleImportStatusCard');

    if (input) input.value = '';
    if (importBtn) importBtn.disabled = true;
    if (previewCard) previewCard.style.display = 'none';
    if (validationCard) validationCard.style.display = 'none';
    if (importStatusCard) importStatusCard.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    const validateBtn = document.getElementById('validateScheduleBtn');
    const importBtn = document.getElementById('importScheduleBtn');
    const clearBtn = document.getElementById('clearScheduleBtn');
    const input = document.getElementById('scheduleJsonInput');

    if (validateBtn) {
        validateBtn.addEventListener('click', function() {
            validatedSchedulePayload = null;
            if (importBtn) importBtn.disabled = true;

            try {
                const payload = parseScheduleJson(input ? input.value : '');
                const validation = validateSchedulePayload(payload);

                if (!validation.isValid) {
                    renderValidationErrors(validation.errors);
                    const previewCard = document.getElementById('schedulePreviewCard');
                    const importStatusCard = document.getElementById('scheduleImportStatusCard');
                    if (previewCard) previewCard.style.display = 'none';
                    if (importStatusCard) importStatusCard.style.display = 'none';
                    return;
                }

                validatedSchedulePayload = normalizeSchedulePayload(payload);
                renderSchedulePreview(validatedSchedulePayload);
            } catch (error) {
                renderValidationErrors([error.message]);
                const previewCard = document.getElementById('schedulePreviewCard');
                const importStatusCard = document.getElementById('scheduleImportStatusCard');
                if (previewCard) previewCard.style.display = 'none';
                if (importStatusCard) importStatusCard.style.display = 'none';
            }
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', handleScheduleImportSubmit);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearScheduleImportUI);
    }
});
