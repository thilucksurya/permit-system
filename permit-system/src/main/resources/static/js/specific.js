let currentDeclarationId = null;
// ---------- 1. INITIALIZATION ----------

window.onload = async function () {

    // login guard
    if (!localStorage.getItem("isLoggedIn")) {
        window.location.href = "login.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const existingJobNo = params.get("jobNo");
    const display = document.getElementById("display-job-no");

    if (existingJobNo) {
        // EDIT MODE
        display.innerText = existingJobNo;
        await loadDeclarationData(existingJobNo);
    } else {
        // NEW MODE
        const newNo = await getNextSequence();
        display.innerText = newNo;
    }
};



// ---------- 2. LOAD EXISTING DECLARATION ----------

async function loadDeclarationData(jobNo) {

    try {

        const response = await fetch(`/api/declarations/${jobNo}`);

        if (!response.ok) {
            throw new Error("Declaration not found");
        }

        const data = await response.json();
        currentDeclarationId = data.id;

        // fill form
        document.getElementById("cargo_type").value = data.cargoType || "";
        document.getElementById("transport_mode").value = data.transportMode || "";
        document.getElementById("party_name").value = data.partyName || "";
        document.getElementById("event_date").value = data.eventDate || "";
        document.getElementById("port_name").value = data.portName || "";
        document.getElementById("license").value = data.license || "";
        document.getElementById("outer-pack").value = data.outerPack ?? 0;
        document.getElementById("gross-weight").value = data.grossWeight ?? 0;
        document.getElementById("remarks").value = data.remarks || "";

        // load items
        if (data.itemDetails) {

            const items = JSON.parse(data.itemDetails);
            const tbody = document.getElementById("permit_items-body");

            tbody.innerHTML = "";

            items.forEach(item => {

                const row = `
                <tr>
                    <td><input type="text" class="item-hs" value="${item.hsCode || ""}"></td>
                    <td><input type="text" class="item-desc" value="${item.description || ""}"></td>
                    <td><input type="text" class="item-origin" value="${item.origin || ""}"></td>
                    <td><input type="number" class="item-qty" value="${item.qty || 0}"></td>
                    <td><input type="number" class="item-amt" value="${item.amt || 0}"></td>
                </tr>
                `;

                tbody.insertAdjacentHTML("beforeend", row);
            });
        }

    } catch (err) {

        console.error("Load error:", err);
        alert("Error loading declaration");

    }
}



// ---------- 3. GENERATE JOB NUMBER ----------

async function getNextSequence() {

    const today = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

    try {

        const response = await fetch(`http://localhost:8080/api/declarations/last?date=${today}`);

        if (!response.ok) throw new Error();

        const last = await response.json();

        const lastSeq = parseInt(last.jobNo.slice(-3));

        return `${today}${String(lastSeq + 1).padStart(3, "0")}`;

    } catch {

        return `${today}001`;

    }
}



// ---------- 4. SAVE DECLARATION ----------

async function saveDeclaration(statusValue) {

    const jobNo = document.getElementById("display-job-no").innerText;

    if (jobNo === "Generating...") {
        alert("Please wait for job number.");
        return;
    }

    const rows = document.querySelectorAll("#permit_items-body tr");

    const items = [];

    rows.forEach(row => {

        items.push({
            hsCode: row.querySelector(".item-hs").value,
            description: row.querySelector(".item-desc").value,
            origin: row.querySelector(".item-origin").value,
            qty: parseInt(row.querySelector(".item-qty").value) || 0,
            amt: parseFloat(row.querySelector(".item-amt").value) || 0
        });

    });

    const declarationData = {
        id: currentDeclarationId,
        jobNo: jobNo,
        status: statusValue,

        cargoType: document.getElementById("cargo_type").value,
        transportMode: document.getElementById("transport_mode").value,
        partyName: document.getElementById("party_name").value,

        eventDate: document.getElementById("event_date").value,
        portName: document.getElementById("port_name").value,
        license: document.getElementById("license").value,

        outerPack: parseInt(document.getElementById("outer-pack").value) || 0,
        grossWeight: parseFloat(document.getElementById("gross-weight").value) || 0,

        remarks: document.getElementById("remarks").value,

        itemDetails: JSON.stringify(items)

    };

    try {

        const response = await fetch(`/api/declarations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(declarationData)
        });

        if (!response.ok) {

            const text = await response.text();
            throw new Error(text || "Server error");

        }

        alert(`Declaration ${jobNo} saved as ${statusValue.toUpperCase()}`);

        window.location.href = "index.html";

    } catch (err) {

        console.error("Save error:", err);
        alert("Failed to save declaration");

    }

}
