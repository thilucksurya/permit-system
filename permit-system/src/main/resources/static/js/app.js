// ==============================
// Load declarations (list or search)
// ==============================

function fetchDeclarations() {

    const searchInput = document.getElementById("search-job");
    const jobNo = searchInput ? searchInput.value.trim() : "";

    let url = "/api/declarations";

    if (jobNo !== "") {
        url = `/api/declarations/${jobNo}`;
    }

    fetch(url)
        .then(response => {

            if (!response.ok) {
                throw new Error("Failed to fetch declarations");
            }

            return response.json();

        })
        .then(data => {

            const tableBody = document.getElementById("table-body");

            if (!tableBody) return;

            tableBody.innerHTML = "";

            if (!Array.isArray(data)) {
                data = [data];
            }

            data.forEach(item => {

                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>
                        <a href="specific.html?jobNo=${item.jobNo}">
                            ${item.jobNo}
                        </a>
                    </td>
                    <td>${item.partyName || ""}</td>
                    <td>${item.transportMode || ""}</td>
                    <td>${item.eventDate || ""}</td>
                    <td>${item.status || ""}</td>
                `;

                tableBody.appendChild(row);

            });

        })
        .catch(error => {

            console.error("Error loading declarations:", error);

        });

}


// ==============================
// Reset search
// ==============================

function resetFilters() {

    const searchInput = document.getElementById("search-job");

    if (searchInput) {
        searchInput.value = "";
    }

    fetchDeclarations();

}


// ==============================
// Save declaration
// ==============================

async function saveDeclaration(event) {

    event.preventDefault();

    const permitData = {

        jobNo: document.getElementById("jobNo").value,
        partyName: document.getElementById("partyName").value,
        movement: document.getElementById("movement").value,
        eventDate: document.getElementById("eventDate").value,
        status: "draft"

    };

    try {

        const response = await fetch("/api/declarations", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(permitData)

        });

        if (!response.ok) {
            throw new Error("Save failed");
        }

        const jobNo = permitData.jobNo;

        const url = `specific.html?jobNo=${jobNo}`;

        window.open(url, "_blank");

    } catch (error) {

        console.error("Connection failed:", error);
        alert("Unable to save declaration");

    }

}


// ==============================
// Modal controls
// ==============================

function openModal() {

    const modal = document.getElementById("declarationModal");

    if (modal) {
        modal.style.display = "block";
    }

}

function closeModal() {

    const modal = document.getElementById("declarationModal");

    if (modal) {
        modal.style.display = "none";
    }

}


// ==============================
// Logout
// ==============================

function logout() {

    localStorage.removeItem("isLoggedIn");

    window.location.href = "login.html";

}


// ==============================
// Page load
// ==============================

window.addEventListener("DOMContentLoaded", () => {

    if (document.getElementById("table-body")) {
        fetchDeclarations();
    }

});
