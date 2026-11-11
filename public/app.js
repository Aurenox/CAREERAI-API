const API_PATH = "/api/gemini";
const COMPLIANCE_FALLBACK =
    "We apologize for the inconvenience, but this service is currently " +
    "unavailable due to a legal or compliance restriction. Please try again later.";

const topStatusPill = document.getElementById("topStatusPill");
const topStatusText = document.getElementById("topStatusText");
const waitingBanner = document.getElementById("waitingBanner");
const gatewayState = document.getElementById("gatewayState");
const gatewayHint = document.getElementById("gatewayHint");
const modelName = document.getElementById("modelName");
const endpointUrlEl = document.getElementById("endpointUrl");
const djangoSnippetEl = document.getElementById("djangoSnippet");
const copyEndpointBtn = document.getElementById("copyEndpointBtn");
const copySnippetBtn = document.getElementById("copySnippetBtn");
const refreshStatusBtn = document.getElementById("refreshStatusBtn");

const promptForm = document.getElementById("promptForm");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const latencyNote = document.getElementById("latencyNote");
const httpBadge = document.getElementById("httpBadge");
const responseRendered = document.getElementById("responseRendered");
const responseJson = document.getElementById("responseJson");
const logList = document.getElementById("logList");
const clearLogBtn = document.getElementById("clearLogBtn");

const fullEndpointUrl = `${window.location.origin}${API_PATH}`;
endpointUrlEl.textContent = fullEndpointUrl;
djangoSnippetEl.textContent = `VERCEL_GEMINI_API_URL = "${fullEndpointUrl}"`;

function setGatewayUi(state, payload, statusCode) {
    topStatusPill.dataset.state = state;
    gatewayState.classList.remove("is-online", "is-paused");

    if (state === "online") {
        topStatusText.textContent = "API ONLINE — WAITING";
        gatewayState.textContent = "ONLINE • WAITING";
        gatewayState.classList.add("is-online");
        gatewayHint.textContent = `HTTP ${statusCode} • Ready for CareerAI POST requests`;
        waitingBanner.textContent =
            "I am waiting for your request — send a POST payload to /api/gemini or test the live gateway below.";
    } else if (state === "paused") {
        topStatusText.textContent = "PAUSED / UNCONFIGURED";
        gatewayState.textContent = "PAUSED • HOLD";
        gatewayState.classList.add("is-paused");
        gatewayHint.textContent =
            (payload && payload.error) || `HTTP ${statusCode} • Key missing or service paused`;
        waitingBanner.textContent =
            "Gateway is currently paused or unconfigured — Django will show the compliance unavailability notice.";
    } else {
        topStatusText.textContent = "Checking gateway...";
        gatewayState.textContent = "Checking...";
        gatewayHint.textContent = "Querying GET /api/gemini";
    }

    if (payload && payload.model) {
        modelName.textContent = payload.model;
    }
}

async function checkHealth() {
    setGatewayUi("checking");
    try {
        const res = await fetch(API_PATH, { method: "GET" });
        const data = await res.json();
        if (res.ok && data.ok) {
            setGatewayUi("online", data, res.status);
        } else {
            setGatewayUi("paused", data, res.status);
        }
    } catch (_err) {
        setGatewayUi("paused", { error: "Unable to reach /api/gemini" }, "ERR");
    }
}

function appendLog(promptText, statusCode, ok, durationMs) {
    const emptyItem = logList.querySelector(".log-empty");
    if (emptyItem) {
        emptyItem.remove();
    }

    const li = document.createElement("li");
    li.className = "log-item";

    const meta = document.createElement("div");
    meta.className = "log-meta";

    const statusSpan = document.createElement("span");
    statusSpan.className = ok ? "log-status-ok" : "log-status-err";
    statusSpan.textContent = `POST ${statusCode}`;

    const timeSpan = document.createElement("span");
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    timeSpan.textContent = `${durationMs} ms • ${now}`;

    const promptSpan = document.createElement("div");
    promptSpan.className = "log-prompt";
    promptSpan.textContent = promptText;

    meta.appendChild(statusSpan);
    meta.appendChild(timeSpan);
    li.appendChild(meta);
    li.appendChild(promptSpan);
    logList.prepend(li);
}

async function copyText(button, text) {
    try {
        await navigator.clipboard.writeText(text);
        const original = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => {
            button.textContent = original;
        }, 1400);
    } catch (_err) {
        button.textContent = "Select & Copy";
    }
}

document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        promptInput.value = chip.dataset.prompt || "";
        promptInput.focus();
    });
});

copyEndpointBtn.addEventListener("click", () => copyText(copyEndpointBtn, fullEndpointUrl));
copySnippetBtn.addEventListener("click", () => copyText(copySnippetBtn, djangoSnippetEl.textContent));
refreshStatusBtn.addEventListener("click", checkHealth);

clearLogBtn.addEventListener("click", () => {
    logList.innerHTML = "";
    const li = document.createElement("li");
    li.className = "log-empty";
    li.textContent = "No requests sent in this session yet.";
    logList.appendChild(li);
});

promptForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt) {
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending Request...";
    latencyNote.textContent = "Waiting for Gemini response...";
    httpBadge.className = "http-badge";
    httpBadge.textContent = "PENDING";
    responseRendered.className = "response-rendered";
    responseRendered.textContent = "Processing POST /api/gemini...";

    const startedAt = performance.now();
    try {
        const res = await fetch(API_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });
        const durationMs = Math.round(performance.now() - startedAt);
        const data = await res.json();

        responseJson.textContent = JSON.stringify(data, null, 2);
        latencyNote.textContent = `Completed in ${durationMs} ms`;

        if (res.ok && data.ok && data.response) {
            httpBadge.className = "http-badge is-ok";
            httpBadge.textContent = `${res.status} OK`;
            responseRendered.className = "response-rendered";
            responseRendered.textContent = data.response;
            appendLog(prompt, res.status, true, durationMs);
            setGatewayUi("online", data, res.status);
        } else {
            httpBadge.className = "http-badge is-error";
            httpBadge.textContent = `${res.status} ${data.status ? data.status.toUpperCase() : "ERROR"}`;
            responseRendered.className = "response-rendered is-error";
            responseRendered.textContent =
                res.status === 503 ? COMPLIANCE_FALLBACK : data.error || "Request failed.";
            appendLog(prompt, res.status, false, durationMs);
            if (res.status === 503) {
                setGatewayUi("paused", data, res.status);
            }
        }
    } catch (err) {
        const durationMs = Math.round(performance.now() - startedAt);
        httpBadge.className = "http-badge is-error";
        httpBadge.textContent = "NETWORK ERR";
        responseRendered.className = "response-rendered is-error";
        responseRendered.textContent = COMPLIANCE_FALLBACK;
        responseJson.textContent = JSON.stringify({ error: String(err) }, null, 2);
        latencyNote.textContent = `Failed after ${durationMs} ms`;
        appendLog(prompt, "ERR", false, durationMs);
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send POST Request";
    }
});

checkHealth();

