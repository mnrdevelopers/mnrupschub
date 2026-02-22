(function () {
    const MCQS_COLLECTION = "mcqs";
    const PYQS_COLLECTION = "pyqs";
    const page = document.body.getAttribute("data-page") || "home";
    const state = { allMCQs: [], allPYQs: [], mcqs: [], pyqs: [], mcqPage: 1, mcqPageSize: 10 };

    function scopeByPage(items) {
        if (page === "prelims") return items.filter((q) => q.exam === "prelims" || q.exam === "combined");
        if (page === "mains") return items.filter((q) => q.exam === "mains" || q.exam === "combined");
        return items;
    }

    function uniqueSorted(values) {
        return Array.from(new Set(values)).sort((a, b) => String(a).localeCompare(String(b)));
    }

    function populateSelect(selectId, values, defaultLabel) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = `<option value="all">${defaultLabel}</option>` + values.map((v) => `<option value="${v}">${v}</option>`).join("");
    }

    function readFilters() {
        return {
            search: (document.getElementById("searchInput")?.value || "").toLowerCase().trim(),
            subject: document.getElementById("subjectFilter")?.value || "all",
            year: document.getElementById("yearFilter")?.value || "all",
            test: document.getElementById("testFilter")?.value || "all",
            type: document.getElementById("typeFilter")?.value || "all"
        };
    }

    function parseAnswerIndex(correctOption) {
        const raw = String(correctOption || "").trim().toUpperCase();
        if (raw.endsWith("A")) return 0;
        if (raw.endsWith("B")) return 1;
        if (raw.endsWith("C")) return 2;
        if (raw.endsWith("D")) return 3;
        return 0;
    }

    function normalizeMCQ(id, raw) {
        const options = Array.isArray(raw.options) && raw.options.length
            ? raw.options
            : [raw.optionA, raw.optionB, raw.optionC, raw.optionD].filter(Boolean);

        const relevantScheduleTest = raw.relevantScheduleTest || raw.relevant_schedule_test || "";
        const explicitStatements = Array.isArray(raw.statements)
            ? raw.statements.map((s) => String(s || "").trim()).filter(Boolean)
            : [];
        const questionText = raw.question || "";

        let parsedQuestion = questionText;
        let parsedStatements = explicitStatements;

        if (!parsedStatements.length && typeof questionText === "string") {
            const firstMarkerIndex = questionText.search(/\b1\.\s+/);
            if (firstMarkerIndex > -1) {
                parsedQuestion = questionText.slice(0, firstMarkerIndex).trim();
                const block = questionText.slice(firstMarkerIndex);
                const statements = [];
                const re = /(?:^|\s)(\d+)\.\s*([\s\S]*?)(?=(?:\s\d+\.\s)|$)/g;
                let m;
                while ((m = re.exec(block)) !== null) {
                    const value = String(m[2] || "").trim();
                    if (value) statements.push(value);
                }
                if (statements.length) parsedStatements = statements;
            }
        }

        return {
            id,
            exam: raw.exam || "combined",
            subject: raw.subject || "General",
            year: Number(raw.year) || new Date().getFullYear(),
            test: raw.test || "",
            coreTopic: raw.coreTopic || raw.core_topic || "",
            relevantScheduleTest,
            question: parsedQuestion || questionText || "",
            statements: parsedStatements,
            options,
            answerIndex: Number.isInteger(raw.answerIndex) ? raw.answerIndex : parseAnswerIndex(raw.correctOption),
            explanation: raw.explanation || ""
        };
    }

    function getRelevantScheduleTest(item) {
        return String(item?.relevantScheduleTest || "").trim();
    }

    function getTestFilterKey(item) {
        const raw = getRelevantScheduleTest(item);
        if (!raw) return "";

        const match = raw.match(/\b(test\s*\d+)\b/i);
        if (match) {
            const numberMatch = match[1].match(/\d+/);
            if (numberMatch) return `Test ${numberMatch[0]}`;
            return match[1].replace(/\s+/g, " ").trim();
        }

        return raw;
    }

    function normalizePYQ(id, raw) {
        const answerPoints = Array.isArray(raw.answerPoints)
            ? raw.answerPoints
            : (raw.answer ? [raw.answer] : []);

        return {
            id,
            exam: raw.exam || "combined",
            subject: raw.subject || "General",
            year: Number(raw.year) || new Date().getFullYear(),
            test: raw.test || "",
            relevantScheduleTest: raw.relevantScheduleTest || raw.relevant_schedule_test || "",
            question: raw.question || "",
            answerPoints
        };
    }

    async function loadQuestionBank() {
        const [mcqSnap, pyqSnap] = await Promise.all([
            db.collection(MCQS_COLLECTION).where("status", "==", "published").get(),
            db.collection(PYQS_COLLECTION).where("status", "==", "published").get()
        ]);

        state.allMCQs = mcqSnap.docs.map((doc) => normalizeMCQ(doc.id, doc.data()));
        state.allPYQs = pyqSnap.docs.map((doc) => normalizePYQ(doc.id, doc.data()));
    }

    function filterItems(items, filters, kind) {
        return items.filter((item) => {
            const subjectOk = filters.subject === "all" || item.subject === filters.subject;
            const yearOk = filters.year === "all" || String(item.year) === filters.year;
            const testOk = filters.test === "all" || getTestFilterKey(item) === filters.test;
            const searchOk = !filters.search
                || item.question.toLowerCase().includes(filters.search)
                || item.subject.toLowerCase().includes(filters.search)
                || String(item.test || "").toLowerCase().includes(filters.search)
                || String(item.coreTopic || "").toLowerCase().includes(filters.search)
                || String(item.relevantScheduleTest || "").toLowerCase().includes(filters.search);
            const typeOk = filters.type === "all" || filters.type === kind;
            return subjectOk && yearOk && testOk && searchOk && typeOk;
        });
    }

    function renderStats(mcqs, pyqs) {
        const el = document.getElementById("practiceStats");
        if (!el) return;
        const total = mcqs.length + pyqs.length;
        el.innerHTML = `
            <div class="col-md-4"><div class="stat-box p-3 text-center"><h5 class="mb-1">${mcqs.length}</h5><small>MCQs</small></div></div>
            <div class="col-md-4"><div class="stat-box p-3 text-center"><h5 class="mb-1">${pyqs.length}</h5><small>PYQs</small></div></div>
            <div class="col-md-4"><div class="stat-box p-3 text-center"><h5 class="mb-1">${total}</h5><small>Total Questions</small></div></div>
        `;
    }

    function renderMCQs(list) {
        const el = document.getElementById("mcqList");
        if (!el) return;
        if (!list.length) {
            el.innerHTML = '<div class="alert alert-light border">No MCQs found for current filters.</div>';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(list.length / state.mcqPageSize));
        if (state.mcqPage > totalPages) state.mcqPage = totalPages;
        if (state.mcqPage < 1) state.mcqPage = 1;

        const start = (state.mcqPage - 1) * state.mcqPageSize;
        const end = start + state.mcqPageSize;
        const pageList = list.slice(start, end);

        const cards = pageList.map((q, idx) => `
            <article class="question-card card shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between mb-2">
                        <span class="badge bg-primary">Q${start + idx + 1}</span>
                        <span class="badge bg-secondary">${q.subject} | ${q.year}${q.test ? ` | ${q.test}` : ""}</span>
                    </div>
                    ${(q.coreTopic || q.relevantScheduleTest) ? `
                        <div class="mcq-meta-grid mb-2">
                            ${q.coreTopic ? `<div class="mcq-meta-pill mcq-core-topic"><span class="mcq-meta-label">Core Topic</span><span class="mcq-meta-value">${q.coreTopic}</span></div>` : ""}
                            ${q.relevantScheduleTest ? `<div class="mcq-meta-pill mcq-relevant-test"><span class="mcq-meta-label">Relevant Schedule Test</span><span class="mcq-meta-value">${q.relevantScheduleTest}</span></div>` : ""}
                        </div>
                    ` : ""}
                    <p class="fw-semibold">${q.question}</p>
                    ${Array.isArray(q.statements) && q.statements.length ? `<ol class="question-statements mb-3">${q.statements.map((s) => `<li>${s}</li>`).join("")}</ol>` : ""}
                    <div class="mb-3">
                        ${q.options.map((o, oi) => `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="mcq-select-${q.id}" id="mcq-${q.id}-${oi}" value="${oi}">
                                <label class="form-check-label" for="mcq-${q.id}-${oi}">${String.fromCharCode(65 + oi)}. ${o}</label>
                            </div>
                        `).join("")}
                    </div>
                    <button class="btn btn-sm btn-outline-primary" data-check-mcq="${q.id}">Check Answer</button>
                    <div class="answer-box mt-2 d-none" id="result-${q.id}"></div>
                </div>
            </article>
        `).join("");

        const pager = `
            <div class="d-flex justify-content-between align-items-center mt-2 p-2 border rounded bg-light">
                <button class="btn btn-sm btn-outline-secondary" id="mcqPagePrevBtn" ${state.mcqPage <= 1 ? "disabled" : ""}>Prev</button>
                <small class="text-muted">Page ${state.mcqPage} of ${totalPages} (${list.length} MCQs)</small>
                <button class="btn btn-sm btn-outline-secondary" id="mcqPageNextBtn" ${state.mcqPage >= totalPages ? "disabled" : ""}>Next</button>
            </div>
        `;

        el.innerHTML = `${cards}${pager}`;

        document.getElementById("mcqPagePrevBtn")?.addEventListener("click", () => {
            state.mcqPage -= 1;
            renderMCQs(list);
            bindToggles();
        });

        document.getElementById("mcqPageNextBtn")?.addEventListener("click", () => {
            state.mcqPage += 1;
            renderMCQs(list);
            bindToggles();
        });
    }

    function renderPYQs(list) {
        const el = document.getElementById("pyqList");
        if (!el) return;
        if (!list.length) {
            el.innerHTML = '<div class="alert alert-light border">No PYQs found for current filters.</div>';
            return;
        }

        el.innerHTML = list.map((q, idx) => `
            <article class="question-card card border-info shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between mb-2">
                        <span class="badge bg-info text-dark">PYQ ${idx + 1}</span>
                        <span class="badge bg-secondary">${q.subject} | ${q.year}${q.test ? ` | ${q.test}` : ""}</span>
                    </div>
                    <p class="fw-semibold">${q.question}</p>
                    <button class="btn btn-sm btn-outline-info" data-toggle-points="${q.id}">View Answer Framework</button>
                    <ul class="mt-2 mb-0 d-none" id="points-${q.id}">${q.answerPoints.map((p) => `<li>${p}</li>`).join("")}</ul>
                </div>
            </article>
        `).join("");
    }

    function bindToggles() {
        document.querySelectorAll("[data-toggle-answer]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = document.getElementById(`answer-${btn.getAttribute("data-toggle-answer")}`);
                if (target) target.classList.toggle("d-none");
            });
        });

        document.querySelectorAll("[data-check-mcq]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const qid = btn.getAttribute("data-check-mcq");
                const selected = document.querySelector(`input[name='mcq-select-${qid}']:checked`);
                const resultBox = document.getElementById(`result-${qid}`);
                const question = state.mcqs.find((q) => q.id === qid) || state.allMCQs.find((q) => q.id === qid);
                if (!resultBox || !question) return;

                if (!selected) {
                    resultBox.classList.remove("d-none");
                    resultBox.innerHTML = `<div class="alert alert-warning mb-0">Please select an option first.</div>`;
                    return;
                }

                const selectedIndex = Number(selected.value);
                const correctIndex = Number(question.answerIndex);
                const isCorrect = selectedIndex === correctIndex;
                const correctLabel = String.fromCharCode(65 + correctIndex);

                resultBox.classList.remove("d-none");
                resultBox.innerHTML = `
                    <div class="alert ${isCorrect ? "alert-success" : "alert-danger"} mb-0">
                        <strong>${isCorrect ? "Correct" : "Incorrect"}.</strong>
                        Your answer: ${String.fromCharCode(65 + selectedIndex)} |
                        Correct answer: ${correctLabel}
                        ${question.explanation ? `<br><small>${question.explanation}</small>` : ""}
                    </div>
                `;
            });
        });

        document.querySelectorAll("[data-toggle-points]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = document.getElementById(`points-${btn.getAttribute("data-toggle-points")}`);
                if (target) target.classList.toggle("d-none");
            });
        });
    }

    function shuffle(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function startQuiz(filteredMCQs) {
        const quizArea = document.getElementById("quizArea");
        if (!quizArea) return;
        const count = Math.max(3, Math.min(20, Number(document.getElementById("quizCount")?.value || 5)));
        const selected = shuffle(filteredMCQs).slice(0, Math.min(count, filteredMCQs.length));

        if (!selected.length) {
            quizArea.innerHTML = '<div class="alert alert-warning mb-0">No MCQs available for quiz. Change filters.</div>';
            return;
        }

        quizArea.innerHTML = `
            <form id="quizForm" class="quiz-form">
                ${selected.map((q, idx) => `
                    <div class="card mb-3"><div class="card-body">
                        <p class="fw-semibold mb-2">${idx + 1}. ${q.question}</p>
                        ${q.options.map((option, oi) => `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="quiz-${q.id}" value="${oi}" id="quiz-${q.id}-${oi}">
                                <label class="form-check-label" for="quiz-${q.id}-${oi}">${String.fromCharCode(65 + oi)}. ${option}</label>
                            </div>
                        `).join("")}
                    </div></div>
                `).join("")}
                <button type="submit" class="btn btn-success">Submit Quiz</button>
            </form>
            <div id="quizResult" class="mt-3"></div>
        `;

        document.getElementById("quizForm").addEventListener("submit", (event) => {
            event.preventDefault();
            let score = 0;
            const review = selected.map((q) => {
                const selectedOpt = document.querySelector(`input[name='quiz-${q.id}']:checked`);
                const selectedIndex = selectedOpt ? Number(selectedOpt.value) : -1;
                if (selectedIndex === q.answerIndex) score += 1;
                return `<li>${q.question}<br><small>Your answer: ${selectedIndex === -1 ? "Not answered" : String.fromCharCode(65 + selectedIndex)} | Correct: ${String.fromCharCode(65 + q.answerIndex)}</small></li>`;
            }).join("");
            const percent = Math.round((score / selected.length) * 100);

            document.getElementById("quizResult").innerHTML = `
                <div class="alert alert-primary"><strong>Score:</strong> ${score}/${selected.length} (${percent}%)</div>
                <details><summary>Review Answers</summary><ol>${review}</ol></details>
            `;
        });
    }

    function renderHome() {
        const stats = document.getElementById("homeStats");
        const subjects = document.getElementById("homeSubjects");
        const years = document.getElementById("homeYears");
        if (!stats || !subjects || !years) return;

        const mcqTotal = state.allMCQs.length;
        const pyqTotal = state.allPYQs.length;
        const total = mcqTotal + pyqTotal;
        const combined = [...state.allMCQs, ...state.allPYQs];

        stats.innerHTML = `
            <div class="col-md-3"><div class="hero-stat"><h3>${total}</h3><small>Total Questions</small></div></div>
            <div class="col-md-3"><div class="hero-stat"><h3>${mcqTotal}</h3><small>MCQs</small></div></div>
            <div class="col-md-3"><div class="hero-stat"><h3>${pyqTotal}</h3><small>PYQs</small></div></div>
            <div class="col-md-3"><div class="hero-stat"><h3>${uniqueSorted(combined.map((q) => q.subject)).length}</h3><small>Subjects</small></div></div>
        `;

        subjects.innerHTML = uniqueSorted(combined.map((q) => q.subject)).map((s) => `<span class="badge bg-primary me-1 mb-1">${s}</span>`).join("");
        years.innerHTML = uniqueSorted(combined.map((q) => q.year)).reverse().map((y) => `<span class="badge bg-secondary me-1 mb-1">${y}</span>`).join("");
    }

    function renderPracticePage() {
        const mcqs = scopeByPage(state.allMCQs);
        const pyqs = scopeByPage(state.allPYQs);

        populateSelect("subjectFilter", uniqueSorted([...mcqs, ...pyqs].map((q) => q.subject)), "All Subjects");
        populateSelect("yearFilter", uniqueSorted([...mcqs, ...pyqs].map((q) => q.year)).reverse(), "All Years");
        populateSelect("testFilter", uniqueSorted([...mcqs, ...pyqs].map((q) => getTestFilterKey(q)).filter(Boolean)), "All Tests");

        function refresh() {
            const filters = readFilters();
            state.mcqs = filterItems(mcqs, filters, "mcq");
            state.pyqs = filterItems(pyqs, filters, "pyq");
            state.mcqPage = 1;
            renderStats(state.mcqs, state.pyqs);
            renderMCQs(state.mcqs);
            renderPYQs(state.pyqs);
            bindToggles();
        }

        ["searchInput", "subjectFilter", "yearFilter", "testFilter", "typeFilter"].forEach((id) => {
            const node = document.getElementById(id);
            if (!node) return;
            node.addEventListener("input", refresh);
            node.addEventListener("change", refresh);
        });

        document.getElementById("startQuizBtn")?.addEventListener("click", () => startQuiz(state.mcqs));
        refresh();
    }

    async function init() {
        try {
            await loadQuestionBank();
            if (page === "home") renderHome();
            else renderPracticePage();
        } catch (error) {
            console.error("Failed to load question bank:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
