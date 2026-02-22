// Authentication State Observer
auth.onAuthStateChanged((user) => {
    const adminLink = document.getElementById('adminLink');
    
    if (user) {
        // Check if user is admin
        checkAdminStatus(user.uid).then(isAdmin => {
            if (isAdmin && adminLink) {
                adminLink.href = "admin-dashboard.html";
                adminLink.innerHTML = '<i class="fas fa-user-shield me-1"></i>Dashboard';
            }
        });
    } else {
        if (adminLink) {
            adminLink.href = "admin-login.html";
            adminLink.innerHTML = '<i class="fas fa-lock me-1"></i>Admin';
        }
    }
});

// Check if user is admin
async function checkAdminStatus(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        return userDoc.exists && userDoc.data().role === 'admin';
    } catch (error) {
        console.error("Error checking admin status:", error);
        if (error.code === 'permission-denied') {
            console.warn("Firestore permission denied. Please check your Security Rules in Firebase Console.");
        }
        return false;
    }
}

// Login function
async function loginAdmin(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Verify admin role
        const isAdmin = await checkAdminStatus(user.uid);
        
        if (!isAdmin) {
            await auth.signOut();
            throw new Error("Unauthorized: User is not an admin or database access is denied.");
        }
        
        return { success: true, user: user };
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: error.message };
    }
}

// Logout function
async function logoutAdmin() {
    try {
        await auth.signOut();
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// Protect admin pages
function protectAdminPage() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "admin-login.html";
            return;
        }
        
        const isAdmin = await checkAdminStatus(user.uid);
        if (!isAdmin) {
            alert("Unauthorized access. Redirecting to home page.");
            window.location.href = "index.html";
        }
    });
}