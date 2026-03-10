// auth.js
function handleLogin() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();

    if (user === "demo" && pass === "123") {
        // THIS LINE IS THE KEY: It saves the "Security Flag"
        localStorage.setItem("isLoggedIn", "true"); 
        
        window.location.href = "index.html"; 
    } else {
        alert("Wrong ID or Password");
    }
}