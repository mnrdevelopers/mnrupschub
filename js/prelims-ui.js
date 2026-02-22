// UI Logic for Prelims Page
document.addEventListener('DOMContentLoaded', function() {
    // Note: Content loading is handled by content-loader.js based on page path
    
    // Setup filter buttons (Top bar)
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');

            // Call global function from content-loader.js
            if (window.filterContent) window.filterContent(filter);
        });
    });
    
    // Setup subject list (Sidebar)
    document.querySelectorAll('#subjectList a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const subject = this.getAttribute('data-subject');
            
            document.querySelectorAll('#subjectList a').forEach(a => a.classList.remove('active'));
            this.classList.add('active');
            
            if (window.filterBySubject) window.filterBySubject(subject);
        });
    });
    
    // Setup search
    document.getElementById('searchInput').addEventListener('input', function(e) {
        if (window.searchContent) window.searchContent(e.target.value);
    });
});