(function () {
    const phases = window.ziboNormalChecklistPhases;
    const utcClock = document.getElementById("utcClock");

    function updateUtcClock() {
        const now = new Date();
        utcClock.dateTime = now.toISOString();
        utcClock.textContent = new Intl.DateTimeFormat("de-DE", {
            timeZone: "UTC",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }).format(now) + " UTC";
    }

    updateUtcClock();
    window.setInterval(updateUtcClock, 1000);

    const stateKey = "b737-checklist-state-zibo-v1";
    const customChecklistStorageKey = "b737-custom-checklists-v2";
    const previousCustomChecklistStorageKey = "b737-custom-checklists-v1";
    const previousStateKey = "b737-checklist-state-v4";

    const rainViewerApi = "https://api.rainviewer.com/public/weather-maps.json";
    const state = loadState();
    const customChecklistData = phases.map(() => ({ items: [], order: [] }));

    let activePhase = 0;
    let checklistDragSession = null;
    let suppressChecklistClick = false;
    let pdfDoc = null;
    let pdfPage = 1;
    let pdfZoom = 1;
    let pdfRenderTask = null;
    let radarFrames = [];
    let radarFrameLayers = [];
    let radarHost = "";
    let radarIndex = 0;
    let radarTimer = null;
    let radarErrorMessage = "";
    let radarEnabled = true;
    let forecastEnabled = true;
    let routeEnabled = true;
    let radarMetadataCache = null;
    let radarMetadataFetchedAt = 0;
    let radarMetadataRequest = null;
    let weatherForecastCache = new Map();
    let routeWeatherCache = new Map();
    let simbriefRouteCache = new Map();
    let weatherSampleLayer = null;
    let weatherRasterCanvas = null;
    let weatherSampleRequestId = 0;
    let weatherSampleTimer = null;
    let weatherSampleLoading = false;
    let weatherSamplePendingRefresh = false;
    let weatherLastRequestAt = 0;
    let flightMap = null;
    let routeLayer = null;
    let routePolyline = null;
    let routePoints = [];
    let routeWeatherRequestId = 0;
    let fmcRouteLayer = null;
    let fmcRoutePolyline = null;
    let fmcRoutePoints = [];
    let fmcRouteLastUpdate = 0;
    let flightTrackLayer = null;
    let flightTrackSegments = [];
    let flightTrackPointCount = 0;
    let lastFlightTrackSave = 0;
    let aircraftMarker = null;
    let aircraftPosition = null;
    let aircraftLastUpdate = 0;
    let aircraftStatusTimer = null;

    let chartPdfDoc = null;
    let chartDocuments = [];
    let activeChartDocument = null;
    let chartPdfPage = 1;
    let chartPdfZoom = 1.0;
    let chartImageZoom = 1.0;
    let chartRotation = 0;
    let chartPdfRenderTask = null;
    let chartAnnotationCanvas = null;
    let chartDrawingEnabled = false;
    let chartPanStart = null;
    let chartPinchStart = null;
    let chartZoomTimer = null;
    const chartPointers = new Map();
    let chartDrawingColor = "#ff3030";
    let chartEraserEnabled = false;
    let chartAnnotationStrokes = {};
    let notesCanvas = null;
    let notesContext = null;
    let notesColorInput = null;
    let notesTextInput = null;
    let notesStatus = null;
    let notesMode = "draw";
    let notesElements = [];
    let notesActiveStroke = null;
    let notesPanStart = null;
    let notesZoom = 2;
    let notesPinchStart = null;
    const notesPointers = new Map();
    let abnormalPdfDoc = null;
    let abnormalPdfPage = 1;
    let abnormalPdfZoom = 1;
    let abnormalPdfRenderTask = null;
    let abnormalPdfLoadPromise = null;
    let abnormalChecklistReference = "";
    let abnormalChecklistTitle = "Quick Action Index";
    let abnormalChecklistRows = [];
    let abnormalChecklistContext = "";
    let abnormalChecklistState = {};
    let abnormalChecklistEntries = [];

    const phaseRail = document.getElementById("phaseRail");
    const checklistItems = document.getElementById("checklistItems");
    const phaseTitle = document.getElementById("phaseTitle");
    const phaseRole = document.getElementById("phaseRole");
    const phaseCompletionStatus = document.getElementById("phaseCompletionStatus");
    const phaseCount = document.getElementById("phaseCount");
    const phaseProgress = document.getElementById("phaseProgress");
    const checklistStorageStatus = document.getElementById("checklistStorageStatus");
    const addChecklistItemButton = document.getElementById("addChecklistItemButton");
    const addChecklistItemForm = document.getElementById("addChecklistItemForm");
    const fileInput = document.getElementById("fileInput");
    const fileMeta = document.getElementById("fileMeta");
    const fileViewer = document.getElementById("fileViewer");
    const pdfTools = document.getElementById("pdfTools");
    const pdfPageLabel = document.getElementById("pdfPageLabel");
    const chartFileInput = document.getElementById("chartFileInput");
    const chartDocumentTabs = document.getElementById("chartDocumentTabs");
    const chartViewer = document.getElementById("chartViewer");
    const chartPdfPageLabel = document.getElementById("chartPdfPageLabel");
    const chartStatus = document.getElementById("chartStatus");
    const chartDrawToggle = document.getElementById("chartDrawToggle");
    const chartDrawingTools = document.getElementById("chartDrawingTools");
    const chartEraserToggle = document.getElementById("chartEraserToggle");
    const chartCustomColor = document.getElementById("chartCustomColor");
    notesCanvas = document.getElementById("notesCanvas");
    notesContext = notesCanvas.getContext("2d");
    notesColorInput = document.getElementById("notesColor");
    notesTextInput = document.getElementById("notesTextInput");
    notesStatus = document.getElementById("notesStatus");
    const radarStatus = document.getElementById("radarStatus");
    const radarPlayButton = document.getElementById("radarPlay");
    const rainViewerTimeSlider = document.getElementById("rainViewerTimeSlider");
    const rainViewerTimeLabel = document.getElementById("rainViewerTimeLabel");
    const forecastLayerToggle = document.getElementById("forecastLayerToggle");
    const rainViewerLayerToggle = document.getElementById("rainViewerLayerToggle");
    const routeLayerToggle = document.getElementById("routeLayerToggle");
    const flightMapElement = document.getElementById("flightMap");
    const flightPlanInput = document.getElementById("flightPlanInput");
    const simbriefUsername = document.getElementById("simbriefUsername");
    const routeStatus = document.getElementById("routeStatus");
    const routeList = document.getElementById("routeList");
    const routeAirportWeather = document.getElementById("routeAirportWeather");
    const xplaneTelemetryStatus = document.getElementById("xplaneTelemetryStatus");
    const xplaneStatusRow = xplaneTelemetryStatus && xplaneTelemetryStatus.parentElement;
    const centerAircraftButton = document.getElementById("centerAircraftButton");
    const xplaneFmsStatus = document.getElementById("xplaneFmsStatus");
    const xplaneFmsStatusRow = xplaneFmsStatus && xplaneFmsStatus.parentElement;
    const centerFmcRouteButton = document.getElementById("centerFmcRouteButton");
    const xplaneTrackStatus = document.getElementById("xplaneTrackStatus");
    const xplaneTrackStatusRow = xplaneTrackStatus && xplaneTrackStatus.parentElement;
    const clearFlightTrackButton = document.getElementById("clearFlightTrackButton");
    const xplaneTrackStorageKey = "b737-xplane-flight-track-v1";
    const airportSearchForm = document.getElementById("airportSearchForm");
    const airportCodeInput = document.getElementById("airportCodeInput");
    const airportSearchButton = document.getElementById("airportSearchButton");
    const refreshAirportButton = document.getElementById("refreshAirportButton");
    const airportStatus = document.getElementById("airportStatus");
    const airportResults = document.getElementById("airportResults");
    const airportDocumentTabs = document.getElementById("airportDocumentTabs");
    let airportRequestInProgress = false;
    const abnormalSearchForm = document.getElementById("abnormalSearchForm");
    const abnormalSearchInput = document.getElementById("abnormalSearchInput");
    const abnormalSearchStatus = document.getElementById("abnormalSearchStatus");
    const abnormalIndexButton = document.getElementById("abnormalIndexButton");
    const abnormalChecklistTitleElement = document.getElementById("abnormalChecklistTitle");
    const abnormalChecklistCount = document.getElementById("abnormalChecklistCount");
    const abnormalChecklistProgress = document.getElementById("abnormalChecklistProgress");
    const abnormalCompletionStatus = document.getElementById("abnormalCompletionStatus");
    const abnormalChecklistItems = document.getElementById("abnormalChecklistItems");
    const abnormalChecklistStorageKey = "b737-abnormal-checklist-state-v1";
    const abnormalPdfViewer = document.getElementById("abnormalPdfViewer");
    const abnormalPdfStatus = document.getElementById("abnormalPdfStatus");
    const abnormalPdfPageInput = document.getElementById("abnormalPdfPage");
    const abnormalPdfPageCount = document.getElementById("abnormalPdfPageCount");
    const airportDataCache = new Map();
    const airportCsvCache = new Map();
    let airportAtisStationsPromise = null;
    const airportWeatherCallbacks = new Map();
    let airportWeatherRequestId = 0;
    let airportDatabasePromise = null;
    const airportDocuments = [];
    let activeAirportDocument = null;
    const simbriefStorageKey = "b737-simbrief-user-v1";
    let airportCacheWarning = false;

    function setChecklistStorageStatus(message) {
        if (checklistStorageStatus) checklistStorageStatus.textContent = message;
    }

    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
    }

    function itemId(phaseIndex, itemIndex) {
        return phaseIndex + ":" + itemIndex;
    }

    function loadState() {
        try {
            const savedState = JSON.parse(localStorage.getItem(stateKey));
            if (savedState && typeof savedState === "object") return savedState;
            return {};
        } catch (error) {
            console.error("Checklist-Status konnte nicht geladen werden.", error);
            return {};
        }
    }

    function saveState() {
        localStorage.setItem(stateKey, JSON.stringify(state));
    }

    function checklistOrderToken(entry) {
        return entry.custom ? "custom:" + entry.id : "default:" + entry.index;
    }

    function loadCustomChecklistData() {
        try {
            const currentRaw = localStorage.getItem(customChecklistStorageKey);
            if (currentRaw === null) {
                migrateLegacyCustomChecklistData();
                return;
            }
            const saved = JSON.parse(currentRaw);
            if (!saved || typeof saved !== "object") {
                throw new Error("Ungültiges Speicherformat für eigene Checklist-Punkte.");
            }

            const archivedItems = normalizeCustomChecklistItems(saved[phases.length]?.items);
            if (archivedItems.length) {
                phases.push({
                    title: "Meine Punkte (alte Listen)",
                    role: "EIGEN",
                    items: []
                });
                customChecklistData.push({ items: [], order: [] });
            }

            phases.forEach((phase, phaseIndex) => {
                const phaseData = saved[phaseIndex];
                if (!phaseData || typeof phaseData !== "object") return;
                customChecklistData[phaseIndex].items = normalizeCustomChecklistItems(phaseData.items);
                customChecklistData[phaseIndex].order = Array.isArray(phaseData.order)
                    ? phaseData.order.filter((token) => typeof token === "string")
                    : [];
            });
        } catch (error) {
            console.error("Eigene Checklistenpunkte konnten nicht geladen werden.", error);
            setChecklistStorageStatus("Eigene Punkte konnten nicht geladen werden. Der lokale Speicher ist möglicherweise beschädigt.");
        }
    }

    function normalizeCustomChecklistItems(items) {
        return (Array.isArray(items) ? items : [])
            .filter((item) => item && typeof item.id === "string" &&
                typeof item.label === "string" && item.label.trim())
            .map((item) => ({
                id: item.id,
                label: item.label.slice(0, 120),
                response: typeof item.response === "string" ? item.response.slice(0, 120) : "",
                crew: typeof item.crew === "string" ? item.crew.slice(0, 12) : "",
                section: typeof item.section === "string" ? item.section.slice(0, 100) : ""
            }));
    }

    function migrateLegacyCustomChecklistData() {
        const legacyRaw = localStorage.getItem(previousCustomChecklistStorageKey);
        if (legacyRaw === null) return;
        const legacy = JSON.parse(legacyRaw);
        if (!Array.isArray(legacy)) {
            throw new Error("Ungültiges älteres Speicherformat für eigene Checklist-Punkte.");
        }
        const legacyItems = [];
        const legacyOrder = [];
        legacy.forEach((phaseData) => {
            if (!phaseData || typeof phaseData !== "object") return;
            const items = normalizeCustomChecklistItems(phaseData.items);
            const itemsByToken = new Map(items.map((item) => ["custom:" + item.id, item]));
            const orderedIds = [];
            (Array.isArray(phaseData.order) ? phaseData.order : []).forEach((token) => {
                const item = itemsByToken.get(token);
                if (item && !orderedIds.includes(item.id)) orderedIds.push(item.id);
            });
            items.forEach((item) => {
                if (!orderedIds.includes(item.id)) orderedIds.push(item.id);
            });
            orderedIds.forEach((id) => {
                const token = "custom:" + id;
                legacyItems.push(itemsByToken.get(token));
                legacyOrder.push(token);
            });
        });

        if (legacyItems.length) {
            const archivePhaseIndex = phases.length;
            phases.push({
                title: "Meine Punkte (alte Listen)",
                role: "EIGEN",
                items: []
            });
            customChecklistData.push({ items: legacyItems, order: legacyOrder });
            try {
                const previousState = JSON.parse(localStorage.getItem(previousStateKey) || "{}");
                legacyItems.forEach((item) => {
                    const previouslyChecked = legacy.some((phaseData, phaseIndex) =>
                        phaseData && Array.isArray(phaseData.items) &&
                        phaseData.items.some((storedItem) => storedItem && storedItem.id === item.id &&
                            previousState[phaseIndex + ":custom:" + item.id])
                    );
                    if (previouslyChecked) state[archivePhaseIndex + ":custom:" + item.id] = true;
                });
                saveState();
            } catch (error) {
                console.error("Häkchen alter eigener Checklist-Punkte konnten nicht übernommen werden.", error);
                setChecklistStorageStatus("Eigene Punkte wurden übernommen, aber alte Häkchen konnten nicht migriert werden.");
            }
        }
        saveCustomChecklistData();
    }

    function saveCustomChecklistData() {
        try {
            localStorage.setItem(customChecklistStorageKey, JSON.stringify(customChecklistData));
            setChecklistStorageStatus("Eigene Punkte und Reihenfolge werden dauerhaft auf diesem Gerät gespeichert.");
            return true;
        } catch (error) {
            console.error("Eigene Checklistenpunkte konnten nicht gespeichert werden.", error);
            setChecklistStorageStatus("Speichern fehlgeschlagen. Prüfe den verfügbaren Speicherplatz auf diesem Gerät.");
            return false;
        }
    }

    function getChecklistEntries(phaseIndex) {
        const defaults = phases[phaseIndex].items.map(([label, response, crew, section], index) => ({
            id: itemId(phaseIndex, index),
            index,
            label,
            response,
            crew,
            section: section || "",
            custom: false
        }));
        const custom = customChecklistData[phaseIndex].items.map((entry) => ({
            ...entry,
            index: -1,
            custom: true
        }));
        const entriesByToken = new Map(defaults.concat(custom).map((entry) => [
            checklistOrderToken(entry),
            entry
        ]));
        const ordered = [];
        const seen = new Set();
        customChecklistData[phaseIndex].order.forEach((token) => {
            const entry = entriesByToken.get(token);
            if (entry && !seen.has(token)) {
                ordered.push(entry);
                seen.add(token);
            }
        });
        defaults.concat(custom).forEach((entry) => {
            const token = checklistOrderToken(entry);
            if (!seen.has(token)) {
                ordered.push(entry);
                seen.add(token);
            }
        });
        return ordered;
    }

    function checklistEntryStateKey(phaseIndex, entry) {
        return entry.custom
            ? phaseIndex + ":custom:" + entry.id
            : itemId(phaseIndex, entry.index);
    }

    function addChecklistEntry(event) {
        event.preventDefault();
        if (!addChecklistItemForm.reportValidity()) return;
        const formData = new FormData(addChecklistItemForm);
        const entries = getChecklistEntries(activePhase);
        const requestedPosition = Number(formData.get("position"));
        if (!Number.isInteger(requestedPosition) || requestedPosition < 1 || requestedPosition > entries.length + 1) {
            setChecklistStorageStatus("Bitte eine Position zwischen 1 und " + (entries.length + 1) + " auswählen.");
            return;
        }

        let id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        while (customChecklistData[activePhase].items.some((item) => item.id === id)) {
            id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        }
        const entry = {
            id,
            label: String(formData.get("label") || "").trim(),
            response: String(formData.get("response") || "").trim(),
            crew: String(formData.get("crew") || "").trim(),
            section: entries[requestedPosition - 1]?.section ||
                entries[requestedPosition - 2]?.section || "",
            custom: true
        };
        if (!entry.label) return;
        const order = entries.map(checklistOrderToken);
        customChecklistData[activePhase].items.push({
            id: entry.id,
            label: entry.label,
            response: entry.response,
            crew: entry.crew,
            section: entry.section
        });
        order.splice(requestedPosition - 1, 0, checklistOrderToken(entry));
        customChecklistData[activePhase].order = order;
        saveCustomChecklistData();
        addChecklistItemForm.reset();
        addChecklistItemForm.elements.namedItem("position").value = String(requestedPosition);
        addChecklistItemForm.classList.add("hidden");
        addChecklistItemButton.setAttribute("aria-expanded", "false");
        render();
    }

    function removeChecklistEntry(entry) {
        customChecklistData[activePhase].items = customChecklistData[activePhase].items
            .filter((item) => item.id !== entry.id);
        customChecklistData[activePhase].order = getChecklistEntries(activePhase)
            .filter((item) => !item.custom || item.id !== entry.id)
            .map(checklistOrderToken);
        delete state[checklistEntryStateKey(activePhase, entry)];
        saveState();
        saveCustomChecklistData();
        render();
    }

    function checkedCount(phaseIndex) {
        return getChecklistEntries(phaseIndex).filter((entry) => state[checklistEntryStateKey(phaseIndex, entry)]).length;
    }

    function renderPhases() {
        phaseRail.innerHTML = "";
        phases.forEach((phase, index) => {
            const entries = getChecklistEntries(index);
            const done = checkedCount(index);
            const complete = entries.length > 0 && done === entries.length;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "phase-button" + (index === activePhase ? " active" : "") +
                (complete ? " complete" : "");
            button.innerHTML = `
                <span class="phase-name">${phase.title}</span>
                <span class="phase-pill">${complete ? "Abgeschlossen" : done + "/" + entries.length}</span>
            `;
            button.addEventListener("click", () => {
                activePhase = index;
                render();
            });
            phaseRail.appendChild(button);
        });
    }

    function renderChecklist() {
        const phase = phases[activePhase];
        const entries = getChecklistEntries(activePhase);
        const done = checkedCount(activePhase);
        const complete = entries.length > 0 && done === entries.length;
        phaseTitle.textContent = phase.title;
        phaseRole.textContent = phase.role;
        phaseCompletionStatus.textContent = complete ? phase.title + " abgeschlossen" : "";
        phaseCompletionStatus.classList.toggle("hidden", !complete);
        phaseCount.textContent = done + " / " + entries.length;
        phaseProgress.style.width = (entries.length ? done / entries.length * 100 : 0) + "%";
        checklistItems.innerHTML = "";

        let currentSection = "";
        entries.forEach((entry) => {
            if (entry.section && entry.section !== currentSection) {
                currentSection = entry.section;
                const sectionHeader = document.createElement("div");
                sectionHeader.className = "checklist-section-row";
                sectionHeader.textContent = currentSection;
                checklistItems.appendChild(sectionHeader);
            }
            const id = checklistEntryStateKey(activePhase, entry);
            const rowWrap = document.createElement("div");
            rowWrap.className = "check-row-wrap" + (entry.custom ? " has-controls" : "");
            rowWrap.dataset.orderToken = checklistOrderToken(entry);
            const row = document.createElement("button");
            row.type = "button";
            row.className = "check-row" + (state[id] ? " done" : "");
            row.title = "Gedrückt halten und ziehen, um die Position zu ändern";
            row.setAttribute("aria-pressed", state[id] ? "true" : "false");
            row.innerHTML = `
                <span class="check-toggle" aria-hidden="true"></span>
                <span class="call"><span>${escapeHtml(entry.label)}</span><span class="leader"></span></span>
                <span class="response"><span class="leader"></span><span>${escapeHtml(entry.response)}</span></span>
                <span class="crew">${escapeHtml(entry.crew)}</span>
            `;
            row.addEventListener("click", () => {
                if (suppressChecklistClick) {
                    suppressChecklistClick = false;
                    return;
                }
                state[id] = !state[id];
                saveState();
                render();
            });
            if (entry.custom) {
                const controls = document.createElement("div");
                controls.className = "check-row-controls";
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "check-row-remove";
                remove.textContent = "×";
                remove.setAttribute("aria-label", entry.label + " löschen");
                remove.addEventListener("click", () => removeChecklistEntry(entry));
                controls.appendChild(remove);
                rowWrap.append(row, controls);
            } else {
                rowWrap.appendChild(row);
            }
            checklistItems.appendChild(rowWrap);
        });
    }

    function render() {
        renderPhases();
        renderChecklist();
    }

    function initializeChecklistDragReordering() {
        checklistItems.addEventListener("pointerdown", (event) => {
            if (!event.isPrimary || event.button !== 0 || event.target.closest(".check-row-controls")) return;
            const row = event.target.closest(".check-row");
            const rowWrap = row && row.closest(".check-row-wrap");
            if (!rowWrap) return;

            const session = {
                pointerId: event.pointerId,
                row,
                source: rowWrap,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
                holdTimer: null,
                initialOrder: Array.from(checklistItems.querySelectorAll(":scope > .check-row-wrap"))
                    .map((item) => item.dataset.orderToken)
            };
            session.holdTimer = window.setTimeout(() => {
                if (checklistDragSession !== session) return;
                session.active = true;
                rowWrap.classList.add("is-dragging");
                document.body.classList.add("checklist-dragging");
                try {
                    row.setPointerCapture(event.pointerId);
                } catch (error) {
                    console.warn("Checklist-Zeile konnte nicht für Ziehen fixiert werden.", error);
                }
                setChecklistStorageStatus("Punkt wird verschoben. Ziehe ihn an die gewünschte Stelle und lasse los.");
            }, 400);
            checklistDragSession = session;
        });

        document.addEventListener("pointermove", (event) => {
            const session = checklistDragSession;
            if (!session || event.pointerId !== session.pointerId) return;
            if (!session.active) {
                if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 10) {
                    window.clearTimeout(session.holdTimer);
                    checklistDragSession = null;
                }
                return;
            }

            event.preventDefault();
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".check-row-wrap");
            if (!target || target.parentElement !== checklistItems || target === session.source) return;
            const bounds = target.getBoundingClientRect();
            const insertAfter = event.clientY >= bounds.top + bounds.height / 2;
            checklistItems.insertBefore(session.source, insertAfter ? target.nextSibling : target);
        }, { passive: false });

        const finishDrag = (event) => {
            const session = checklistDragSession;
            if (!session || event.pointerId !== session.pointerId) return;
            window.clearTimeout(session.holdTimer);
            checklistDragSession = null;
            document.body.classList.remove("checklist-dragging");
            session.source.classList.remove("is-dragging");
            if (!session.active) return;

            const order = event.type === "pointercancel"
                ? session.initialOrder
                : Array.from(checklistItems.querySelectorAll(":scope > .check-row-wrap"))
                .map((rowWrap) => rowWrap.dataset.orderToken)
                .filter(Boolean);
            if (event.type === "pointercancel") {
                const rowsByToken = new Map(Array.from(checklistItems.querySelectorAll(":scope > .check-row-wrap"))
                    .map((rowWrap) => [rowWrap.dataset.orderToken, rowWrap]));
                order.forEach((token) => {
                    const rowWrap = rowsByToken.get(token);
                    if (rowWrap) checklistItems.appendChild(rowWrap);
                });
            }
            customChecklistData[activePhase].order = order;
            saveCustomChecklistData();
            if (event.type === "pointercancel") {
                setChecklistStorageStatus("Verschieben abgebrochen. Die ursprüngliche Reihenfolge bleibt erhalten.");
                render();
                return;
            }
            suppressChecklistClick = true;
            window.setTimeout(() => { suppressChecklistClick = false; }, 0);
            setChecklistStorageStatus("Reihenfolge gespeichert. Änderungen bleiben auf diesem Gerät erhalten.");
            renderPhases();
        };

        document.addEventListener("pointerup", finishDrag);
        document.addEventListener("pointercancel", finishDrag);
    }

    function initializeAbnormalChecklists() {
        const content = window.abnormalQrH;
        if (!content || !content.checklistText || !content.indexText || !content.quickActionIndex) {
            abnormalSearchStatus.textContent = "QRH-Inhalt konnte nicht geladen werden.";
            abnormalSearchInput.disabled = true;
            abnormalIndexButton.disabled = true;
            return;
        }

        try {
            const savedState = JSON.parse(localStorage.getItem(abnormalChecklistStorageKey) || "{}");
            if (savedState && typeof savedState === "object" && !Array.isArray(savedState)) {
                abnormalChecklistState = savedState;
            }
        } catch (error) {
            console.error("Abnormal-Checklist-Status konnte nicht geladen werden.", error);
            abnormalSearchStatus.textContent = "Gespeicherte QRH-Häkchen konnten nicht geladen werden.";
        }

        abnormalChecklistEntries = parseAbnormalIndex(content.indexText);
        const quickActionEntries = parseAbnormalIndex(content.quickActionIndex);
        renderAbnormalIndex(quickActionEntries);
        abnormalSearchStatus.textContent = "Quick Action Index. Die Suche durchsucht den QRH-Index und alle Checklisten.";

        abnormalSearchForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const rawQuery = abnormalSearchInput.value.trim();
            const query = rawQuery.toLocaleLowerCase();
            if (!query) {
                renderAbnormalIndex(quickActionEntries);
                abnormalSearchStatus.textContent = "Quick Action Index. Die Suche durchsucht den QRH-Index und alle Checklisten.";
                return;
            }

            const indexedMatches = abnormalChecklistEntries.filter((entry) =>
                (entry.title + " " + entry.reference).toLocaleLowerCase().includes(query)
            );
            const bodyMatches = findAbnormalTextMatches(content, rawQuery);
            const matchKeys = new Set(indexedMatches.map((entry) => entry.reference + "|" + entry.title));
            const matches = indexedMatches.concat(bodyMatches.filter((entry) => {
                const key = entry.reference + "|" + entry.title;
                if (matchKeys.has(key)) return false;
                matchKeys.add(key);
                return true;
            }));
            if (!matches.length) {
                abnormalChecklistTitle = "Suchergebnisse";
                abnormalChecklistReference = "";
                abnormalChecklistRows = [];
                abnormalChecklistContext = "";
                abnormalChecklistTitleElement.textContent = abnormalChecklistTitle;
                updateAbnormalChecklistProgress();
                abnormalChecklistItems.replaceChildren();
                abnormalSearchStatus.textContent = "0 Treffer für „" + rawQuery + "“.";
                return;
            }

            renderAbnormalIndex(matches.slice(0, 100), "Suchergebnisse: " + rawQuery);
            abnormalSearchStatus.textContent = matches.length + " Treffer" +
                (matches.length > 100 ? " (erste 100 angezeigt)" : "") +
                " für „" + rawQuery + "“.";
        });

        abnormalIndexButton.addEventListener("click", () => {
            abnormalSearchInput.value = "";
            renderAbnormalIndex(quickActionEntries);
            abnormalSearchStatus.textContent = "Quick Action Index. Die Suche durchsucht den QRH-Index und alle Checklisten.";
        });

        document.getElementById("abnormalResetButton").addEventListener("click", resetAbnormalChecklist);
        document.getElementById("abnormalPdfPrev").addEventListener("click", () => changeAbnormalPdfPage(-1));
        document.getElementById("abnormalPdfNext").addEventListener("click", () => changeAbnormalPdfPage(1));
        document.getElementById("abnormalPdfZoomOut").addEventListener("click", () => changeAbnormalPdfZoom(-0.15));
        document.getElementById("abnormalPdfZoomIn").addEventListener("click", () => changeAbnormalPdfZoom(0.15));
        document.getElementById("abnormalPdfViewer").closest("details").addEventListener("toggle", (event) => {
            if (event.currentTarget.open) loadAbnormalPdf().then(renderAbnormalPdfPage);
        });
        abnormalPdfPageInput.addEventListener("change", () => {
            if (!abnormalPdfDoc) return;
            const requestedPage = Number(abnormalPdfPageInput.value);
            if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > abnormalPdfDoc.numPages) {
                abnormalPdfPageInput.value = String(abnormalPdfPage);
                abnormalPdfStatus.textContent = "Bitte eine Seitenzahl zwischen 1 und " + abnormalPdfDoc.numPages + " eingeben.";
                return;
            }
            abnormalPdfPage = requestedPage;
            renderAbnormalPdfPage();
        });
    }

    function parseAbnormalIndex(text) {
        const pageMap = window.abnormalQrHPages || {};
        const entries = [];
        const seen = new Set();
        let pendingTitle = "";
        String(text).split(/\r?\n/).forEach((line) => {
            const referenceMatch = line.match(/((?:Back Cover\.\d+)|(?:\d{1,2}\.\d{1,2}))\s*$/i);
            if (referenceMatch && Number.isInteger(pageMap[referenceMatch[1]])) {
                const titlePart = line.slice(0, referenceMatch.index).replace(/[.\s]+$/g, "").trim();
                const title = [pendingTitle, titlePart].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
                const key = referenceMatch[1] + "|" + title.toLocaleLowerCase();
                if (title && !seen.has(key)) {
                    seen.add(key);
                    entries.push({ title, reference: referenceMatch[1] });
                }
                pendingTitle = "";
            } else if (/\.{2,}/.test(line) && !/copyright|boeing|revision|quick action/i.test(line)) {
                const continuation = line.replace(/[.\s]+$/g, "").trim();
                if (continuation && continuation.length < 140) {
                    pendingTitle = [pendingTitle, continuation].filter(Boolean).join(" ");
                }
            }
        });
        return entries;
    }

    function findAbnormalTextMatches(content, query) {
        const normalizedQuery = query.toLocaleLowerCase();
        const matches = [];
        [
            { title: "QRH-Index", text: content.indexText },
            { title: "Checkliste", text: content.checklistText }
        ].forEach((source) => {
            const lines = source.text.split(/\r?\n/);
            lines.forEach((line, lineIndex) => {
                if (!line.toLocaleLowerCase().includes(normalizedQuery)) return;
                const context = lines.slice(Math.max(0, lineIndex - 1), lineIndex + 2)
                    .join(" ").replace(/\s+/g, " ").trim();
                const referenceMatch = line.match(/((?:Back Cover\.\d+)|(?:\d{1,2}\.\d{1,2}))\s*$/i);
                const pageReference = referenceMatch && window.abnormalQrHPages &&
                    Number.isInteger(window.abnormalQrHPages[referenceMatch[1]])
                    ? referenceMatch[1]
                    : findAbnormalReferenceNearLine(source.text, line, lineIndex, lines);
                matches.push({
                    title: context || source.title,
                    reference: pageReference || "",
                    source: source.title
                });
            });
        });
        return matches.slice(0, 500);
    }

    function findAbnormalReferenceNearLine(text, line, lineIndex, lines) {
        const pageMap = window.abnormalQrHPages || {};
        for (let index = lineIndex; index >= Math.max(0, lineIndex - 40); index -= 1) {
            const match = lines[index].match(/((?:Back Cover\.\d+)|(?:\d{1,2}\.\d{1,2}))\s*$/i);
            if (match && Number.isInteger(pageMap[match[1]])) return match[1];
        }
        const position = text.indexOf(line);
        if (position >= 0) {
            const preceding = text.slice(Math.max(0, position - 2500), position);
            const references = preceding.match(/(?:Back Cover\.\d+|\b\d{1,2}\.\d{1,2}\b)/gi) || [];
            for (let index = references.length - 1; index >= 0; index -= 1) {
                if (Number.isInteger(pageMap[references[index]])) return references[index];
            }
        }
        return "";
    }

    function renderAbnormalIndex(entries, title) {
        abnormalChecklistTitle = title || "Quick Action Index";
        abnormalChecklistReference = "";
        abnormalChecklistRows = [];
        abnormalChecklistContext = "";
        abnormalChecklistTitleElement.textContent = abnormalChecklistTitle;
        abnormalChecklistItems.replaceChildren();
        updateAbnormalChecklistProgress();

        entries.forEach((entry) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "check-row abnormal-entry";
            row.innerHTML = `
                <span class="check-toggle" aria-hidden="true"></span>
                <span class="call"><span>${escapeHtml(entry.title)}</span><span class="leader"></span></span>
                <span class="response"><span class="leader"></span><span>${escapeHtml(entry.reference || entry.source || "")}</span></span>
                <span class="crew">QRH</span>
            `;
            row.addEventListener("click", () => {
                if (entry.reference) navigateAbnormalToReference(entry.reference, entry.title);
                else abnormalSearchStatus.textContent = "Für diesen Treffer ist keine QRH-Seite zugeordnet.";
            });
            abnormalChecklistItems.appendChild(row);
        });
    }

    function renderAbnormalChecklistRows(rows, reference, title, context) {
        if (typeof context === "string") abnormalChecklistContext = context;
        abnormalChecklistReference = reference;
        abnormalChecklistTitle = title || ("QRH " + reference);
        abnormalChecklistRows = rows;
        abnormalChecklistTitleElement.textContent = abnormalChecklistTitle;
        abnormalChecklistItems.replaceChildren();
        if (abnormalChecklistContext) {
            const contextElement = document.createElement("p");
            contextElement.className = "abnormal-context";
            contextElement.textContent = abnormalChecklistContext;
            abnormalChecklistItems.appendChild(contextElement);
        }
        rows.forEach((item, index) => {
            const row = document.createElement("button");
            const id = reference + ":" + index;
            row.type = "button";
            row.className = "check-row" + (abnormalChecklistState[id] ? " done" : "");
            row.setAttribute("aria-pressed", abnormalChecklistState[id] ? "true" : "false");
            row.innerHTML = `
                <span class="check-toggle" aria-hidden="true"></span>
                <span class="call"><span>${escapeHtml(item.call)}</span><span class="leader"></span></span>
                <span class="response"><span class="leader"></span><span>${escapeHtml(item.response || "")}</span></span>
                <span class="crew">${escapeHtml(item.crew || "QRH")}</span>
            `;
            row.addEventListener("click", () => {
                abnormalChecklistState[id] = !abnormalChecklistState[id];
                try {
                    localStorage.setItem(abnormalChecklistStorageKey, JSON.stringify(abnormalChecklistState));
                } catch (error) {
                    console.error("Abnormal-Checklist-Status konnte nicht gespeichert werden.", error);
                    abnormalSearchStatus.textContent = "QRH-Häkchen konnten nicht gespeichert werden.";
                }
                renderAbnormalChecklistRows(abnormalChecklistRows, reference, abnormalChecklistTitle, abnormalChecklistContext);
            });
            abnormalChecklistItems.appendChild(row);
        });
        updateAbnormalChecklistProgress();
    }

    function updateAbnormalChecklistProgress() {
        const doneCount = abnormalChecklistRows.reduce((count, item, index) =>
            count + (abnormalChecklistState[abnormalChecklistReference + ":" + index] ? 1 : 0), 0);
        const total = abnormalChecklistReference ? abnormalChecklistRows.length : 0;
        abnormalChecklistCount.textContent = doneCount + " / " + total;
        abnormalChecklistProgress.style.width = total ? (doneCount / total * 100) + "%" : "0%";
        abnormalCompletionStatus.classList.toggle("hidden", !total || doneCount !== total);
        abnormalCompletionStatus.textContent = total && doneCount === total ? "Abschnitt vollständig" : "";
    }

    function resetAbnormalChecklist() {
        if (!abnormalChecklistReference) {
            abnormalSearchStatus.textContent = "Wähle zuerst eine QRH-Checkliste aus.";
            return;
        }
        abnormalChecklistRows.forEach((item, index) => {
            delete abnormalChecklistState[abnormalChecklistReference + ":" + index];
        });
        try {
            localStorage.setItem(abnormalChecklistStorageKey, JSON.stringify(abnormalChecklistState));
        } catch (error) {
            console.error("Abnormal-Checklist-Status konnte nicht gespeichert werden.", error);
            abnormalSearchStatus.textContent = "QRH-Häkchen konnten nicht zurückgesetzt werden.";
        }
        renderAbnormalChecklistRows(abnormalChecklistRows, abnormalChecklistReference, abnormalChecklistTitle, abnormalChecklistContext);
    }

    async function extractAbnormalChecklistPage(pdfPageNumber) {
        const page = await abnormalPdfDoc.getPage(pdfPageNumber);
        const textContent = await page.getTextContent();
        const lines = [];
        textContent.items.forEach((item) => {
            if (!item.str || !item.str.trim()) return;
            const y = Math.round(item.transform[5] / 2) * 2;
            let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2);
            if (!line) {
                line = { y, items: [] };
                lines.push(line);
            }
            line.items.push({ x: item.transform[4], text: item.str.trim() });
        });
        const pageLines = lines
            .sort((left, right) => right.y - left.y)
            .filter((line) => line.y >= 34 && line.y <= 700)
            .map((line) => ({
                y: line.y,
                text: line.items
                    .filter((item) => item.text !== ":")
                    .sort((left, right) => left.x - right.x)
                    .map((item) => item.text)
                    .join(" ")
                    .replace(/\s+([,.;:])/g, "$1")
                    .replace(/\s+/g, " ")
                    .trim()
            }))
            .filter((line) => line.text && !/^(?:(?:[-.]\s*){3,}|737|boeing|qrh\b|non-normal|page\s+\d+|d6-\d{5,}|copyright|revision)/i.test(line.text));

        const rows = [];
        const contextLines = [];
        let currentStep = null;
        let pendingStepNumber = "";
        const commitStep = () => {
            if (!currentStep) return;
            const leaderMatch = currentStep.text.match(/\s+(?:\.\s*){2,}(.*)$/);
            const call = leaderMatch
                ? currentStep.text.slice(0, leaderMatch.index).trim()
                : currentStep.text.trim();
            rows.push({
                call: (currentStep.number ? currentStep.number + ". " : "") + call,
                response: leaderMatch ? leaderMatch[1].trim() : "",
                crew: "QRH"
            });
            currentStep = null;
        };

        pageLines.forEach(({ text: line }) => {
            const numberOnly = line.match(/^(\d{1,2})[.)]?$/);
            if (numberOnly) {
                commitStep();
                pendingStepNumber = numberOnly[1];
                return;
            }
            const numberedLine = line.match(/^(\d{1,2})[.)]?\s+(.+)$/);
            if (numberedLine) {
                commitStep();
                currentStep = { number: numberedLine[1], text: numberedLine[2] };
                pendingStepNumber = "";
                return;
            }
            if (currentStep) {
                currentStep.text += " " + line;
            } else if (pendingStepNumber) {
                currentStep = { number: pendingStepNumber, text: line };
                pendingStepNumber = "";
            } else if (/^(?:condition:|warning:|caution:|note:|•)/i.test(line) ||
                (contextLines.length && !/^(?:memory items|qrh|non-normal)/i.test(line))) {
                contextLines.push(line);
            }
        });
        commitStep();
        return { rows, context: contextLines.join(" ") };
    }

    async function navigateAbnormalToReference(reference, title) {
        const pdfPageNumber = window.abnormalQrHPages && window.abnormalQrHPages[reference];
        if (!Number.isInteger(pdfPageNumber)) {
            abnormalPdfStatus.textContent = "Für den Verweis „" + reference + "“ wurde keine PDF-Seite gefunden.";
            return;
        }

        try {
            abnormalPdfPage = pdfPageNumber;
            abnormalPdfPageInput.value = String(pdfPageNumber);
            await loadAbnormalPdf();
            if (!abnormalPdfDoc) return;
            const checklist = await extractAbnormalChecklistPage(pdfPageNumber);
            if (!checklist.rows.length) {
                abnormalSearchStatus.textContent = "Auf QRH-Seite " + pdfPageNumber + " wurde kein extrahierbarer Checklistentext gefunden.";
                return;
            }
            renderAbnormalChecklistRows(checklist.rows, reference, title || ("QRH " + reference), checklist.context);
            abnormalSearchStatus.textContent = "QRH-Verweis " + reference + " · PDF-Seite " + pdfPageNumber;
        } catch (error) {
            console.error("QRH-Checkliste konnte nicht geöffnet werden.", error);
            abnormalSearchStatus.textContent = "QRH-Checkliste konnte nicht gelesen werden.";
        }
    }

    async function loadAbnormalPdf() {
        if (abnormalPdfDoc || abnormalPdfLoadPromise) return abnormalPdfLoadPromise;
        if (!window.pdfjsLib) {
            abnormalPdfStatus.textContent = "PDF-Engine nicht verfügbar.";
            return;
        }

        abnormalPdfStatus.textContent = "QRH PDF wird geladen...";
        abnormalPdfLoadPromise = window.pdfjsLib.getDocument({ url: "abnormal-qrh.pdf" }).promise
            .then((document) => {
                abnormalPdfDoc = document;
                abnormalPdfPageCount.textContent = "/ " + document.numPages;
                abnormalPdfPageInput.max = String(document.numPages);
                abnormalPdfStatus.textContent = "QRH PDF geladen.";
                return renderAbnormalPdfPage();
            })
            .catch((error) => {
                console.error("QRH PDF konnte nicht geladen werden.", error);
                abnormalPdfStatus.textContent = "QRH PDF konnte nicht geladen werden: " + (error.message || "unbekannter Fehler");
                abnormalPdfLoadPromise = null;
            });
        return abnormalPdfLoadPromise;
    }

    async function renderAbnormalPdfPage() {
        if (!abnormalPdfDoc) return;
        if (abnormalPdfRenderTask) {
            abnormalPdfRenderTask.cancel();
            abnormalPdfRenderTask = null;
        }

        let currentRenderTask = null;
        try {
            const page = await abnormalPdfDoc.getPage(abnormalPdfPage);
            const baseViewport = page.getViewport({ scale: 1 });
            const maxWidth = Math.max(320, abnormalPdfViewer.clientWidth - 32);
            const fitScale = Math.min(2.4, maxWidth / baseViewport.width);
            const viewport = page.getViewport({ scale: fitScale * abnormalPdfZoom });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            abnormalPdfViewer.replaceChildren(canvas);
            abnormalPdfPageInput.value = String(abnormalPdfPage);
            abnormalPdfStatus.textContent = "Seite " + abnormalPdfPage + " von " + abnormalPdfDoc.numPages;
            currentRenderTask = page.render({ canvasContext: context, viewport });
            abnormalPdfRenderTask = currentRenderTask;
            await currentRenderTask.promise;
        } catch (error) {
            if (error && error.name !== "RenderingCancelledException") {
                console.error("QRH-Seite konnte nicht gerendert werden.", error);
                abnormalPdfStatus.textContent = "QRH-Seite konnte nicht angezeigt werden.";
            }
        } finally {
            if (abnormalPdfRenderTask === currentRenderTask) abnormalPdfRenderTask = null;
        }
    }

    function changeAbnormalPdfPage(offset) {
        if (!abnormalPdfDoc) {
            loadAbnormalPdf();
            return;
        }
        abnormalPdfPage = Math.max(1, Math.min(abnormalPdfDoc.numPages, abnormalPdfPage + offset));
        renderAbnormalPdfPage();
    }

    function changeAbnormalPdfZoom(offset) {
        abnormalPdfZoom = Math.max(0.6, Math.min(3, abnormalPdfZoom + offset));
        renderAbnormalPdfPage();
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function setView(viewName) {
        document.querySelectorAll(".view-tabs button").forEach((button) => {
            button.classList.toggle("active", button.dataset.view === viewName);
        });
        document.querySelectorAll(".view").forEach((view) => {
            view.classList.toggle("active", view.id === viewName + "View");
        });
        phaseRail.style.display = viewName === "checklist" ? "" : "none";

        if (viewName === "map") {
            initFlightMap();
            setTimeout(() => flightMap && flightMap.invalidateSize(), 120);
        }
        if (viewName === "notes") {
            setTimeout(resizeNotesCanvas, 80);
        }
        if (viewName === "charts") {
            setTimeout(() => {
                if (chartPdfDoc) renderChartPdfPage();
                else {
                    const image = chartViewer.querySelector("img");
                    if (image && image.complete && image.naturalWidth > 0) renderChartImage(image);
                }
            }, 120);
        }
    }

    function loadNotes() {
        try {
            const saved = localStorage.getItem("b737-notes-canvas");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    notesElements = parsed.map((element) => {
                        if (element.type === "text") {
                            return { ...element, x: element.x / 2, y: element.y / 2 };
                        }
                        if (element.type === "stroke" && Array.isArray(element.points)) {
                            return {
                                ...element,
                                points: element.points.map((point) => ({
                                    x: point.x / 2,
                                    y: point.y / 2
                                }))
                            };
                        }
                        return element;
                    });
                    saveNotes();
                } else if (parsed && parsed.version === 2 && Array.isArray(parsed.elements)) {
                    notesElements = parsed.elements;
                } else {
                    throw new Error("Unbekanntes Notizformat.");
                }
            }
        } catch (error) {
            notesStatus.textContent = "Gespeicherte Notizen konnten nicht geladen werden.";
        }
    }

    function saveNotes() {
        try {
            localStorage.setItem("b737-notes-canvas", JSON.stringify({
                version: 2,
                elements: notesElements
            }));
            notesStatus.textContent = "Gespeichert auf diesem Gerät.";
        } catch (error) {
            notesStatus.textContent = "Notizen konnten nicht gespeichert werden. Gerätespeicher eventuell voll.";
        }
    }

    function resizeNotesCanvas() {
        if (!notesCanvas || !notesContext) return;
        notesCanvas.style.width = (notesZoom * 100) + "%";
        notesCanvas.style.height = (notesZoom * 100) + "%";
        const bounds = notesCanvas.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.round(bounds.width * pixelRatio);
        const height = Math.round(bounds.height * pixelRatio);
        if (notesCanvas.width !== width || notesCanvas.height !== height) {
            notesCanvas.width = width;
            notesCanvas.height = height;
        }
        notesContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        drawNotes();
    }

    function zoomNotesAt(nextZoom, clientX, clientY) {
        const wrapper = notesCanvas.parentElement;
        const bounds = notesCanvas.getBoundingClientRect();
        const wrapperBounds = wrapper.getBoundingClientRect();
        const focalX = clientX === undefined ? wrapperBounds.left + wrapper.clientWidth / 2 : clientX;
        const focalY = clientY === undefined ? wrapperBounds.top + wrapper.clientHeight / 2 : clientY;
        const contentX = (wrapper.scrollLeft + focalX - bounds.left) / bounds.width;
        const contentY = (wrapper.scrollTop + focalY - bounds.top) / bounds.height;
        notesZoom = Math.max(0.5, Math.min(4, nextZoom));
        notesCanvas.style.width = (notesZoom * 100) + "%";
        notesCanvas.style.height = (notesZoom * 100) + "%";
        resizeNotesCanvas();
        wrapper.scrollLeft = contentX * notesCanvas.getBoundingClientRect().width
            - (focalX - wrapperBounds.left);
        wrapper.scrollTop = contentY * notesCanvas.getBoundingClientRect().height
            - (focalY - wrapperBounds.top);
    }

    function notesPointerDistance(first, second) {
        return Math.hypot(first.x - second.x, first.y - second.y);
    }

    function drawNotes() {
        if (!notesCanvas || !notesContext) return;
        const width = notesCanvas.clientWidth;
        const height = notesCanvas.clientHeight;
        notesContext.clearRect(0, 0, width, height);
        notesElements.forEach((element) => {
            if (element.type === "text") {
                notesContext.fillStyle = element.color;
                notesContext.font = "20px Arial, sans-serif";
                notesContext.textBaseline = "top";
                String(element.text).split("\n").forEach((line, index) => {
                    notesContext.fillText(line, element.x * width, element.y * height + index * 24);
                });
                return;
            }
            if (element.type !== "stroke" || !Array.isArray(element.points) || !element.points.length) return;
            notesContext.beginPath();
            notesContext.strokeStyle = element.erase ? "#ffffff" : element.color;
            notesContext.lineWidth = element.erase ? 24 : 3;
            notesContext.lineCap = "round";
            notesContext.lineJoin = "round";
            notesContext.moveTo(element.points[0].x * width, element.points[0].y * height);
            element.points.slice(1).forEach((point) => {
                notesContext.lineTo(point.x * width, point.y * height);
            });
            if (element.points.length === 1) {
                notesContext.lineTo(element.points[0].x * width + 0.1, element.points[0].y * height + 0.1);
            }
            notesContext.stroke();
        });
    }

    function notesPoint(event) {
        const bounds = notesCanvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
            y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
        };
    }

    async function searchAirport(event) {
        event.preventDefault();
        if (airportRequestInProgress) return;
        const code = airportCodeInput.value.trim().toUpperCase();
        if (!/^[A-Z0-9]{3,4}$/.test(code)) {
            airportStatus.textContent = "Bitte einen gültigen 3- oder 4-stelligen ICAO- oder IATA-Code eingeben.";
            return;
        }

        airportRequestInProgress = true;
        setAirportLoading(true);
        airportStatus.textContent = "Flughafendaten werden geladen. Beim ersten Abruf können die offenen Datensätze einige MB umfassen.";

        try {
            const airportDocument = await createAirportDocument(code, false);
            updateAirportDocument(airportDocument, null);
            activateAirportDocument(airportDocument);
        } catch (error) {
            airportStatus.textContent = error.message || "Flughafeninformationen konnten nicht geladen werden.";
        } finally {
            airportRequestInProgress = false;
            setAirportLoading(false);
        }
    }

    async function refreshActiveAirport() {
        if (!activeAirportDocument || airportRequestInProgress) return;
        const previousDocument = activeAirportDocument;
        airportRequestInProgress = true;
        setAirportLoading(true);
        airportStatus.textContent = "Daten für " + previousDocument.ident + " werden aktualisiert...";

        try {
            const refreshedDocument = await createAirportDocument(previousDocument.searchCode, true);
            if (!airportDocuments.includes(previousDocument)) return;
            updateAirportDocument(refreshedDocument, previousDocument);
            if (activeAirportDocument === previousDocument) {
                activateAirportDocument(refreshedDocument);
            } else {
                renderAirportDocumentTabs();
            }
        } catch (error) {
            if (activeAirportDocument === previousDocument) {
                airportStatus.textContent =
                    "Aktualisierung fehlgeschlagen: " + (error.message || "Flughafeninformationen konnten nicht geladen werden.");
            }
        } finally {
            airportRequestInProgress = false;
            setAirportLoading(false);
        }
    }

    async function createAirportDocument(code, forceRefresh) {
        airportCacheWarning = false;
        const airportInfo = forceRefresh
            ? await loadAirportInfo(code, true)
            : airportDataCache.get(code) || await loadAirportInfo(code);
        airportDataCache.set(code, airportInfo);
        const airport = airportInfo.airport;
        airportStatus.textContent =
            "Wetter, ATIS, Runways, Frequenzen und Anflughilfen für " + airport.ident + " werden abgerufen...";
        const weatherCode = airport.icao_code || airport.ident;
        const [metarResult, tafResult, atisResult, runwaysResult, frequenciesResult, navaidsResult] = await Promise.allSettled([
            fetchWeatherProduct("metar", weatherCode),
            fetchWeatherProduct("taf", weatherCode),
            fetchLatestAtis(weatherCode),
            loadAirportCsv("runways.csv", (row) => row.airport_ident === airport.ident, forceRefresh),
            loadAirportCsv("airport-frequencies.csv", (row) => row.airport_ident === airport.ident, forceRefresh),
            loadAirportCsv("navaids.csv", (row) => row.associated_airport === airport.ident, forceRefresh)
        ]);
        const html = renderAirportInfo(
            airportInfo,
            metarResult.status === "fulfilled" ? metarResult.value : null,
            tafResult.status === "fulfilled" ? tafResult.value : null,
            atisResult.status === "fulfilled" ? atisResult.value : { unavailable: true },
            runwaysResult.status === "fulfilled" ? runwaysResult.value : [],
            frequenciesResult.status === "fulfilled" ? frequenciesResult.value : [],
            navaidsResult.status === "fulfilled" ? navaidsResult.value : []
        );

        const failedSources = [];
        if (metarResult.status === "rejected") failedSources.push("METAR");
        if (tafResult.status === "rejected") failedSources.push("TAF");
        if (atisResult.status === "rejected") failedSources.push("ATIS");
        if (runwaysResult.status === "rejected") failedSources.push("Runway-Daten");
        if (frequenciesResult.status === "rejected") failedSources.push("Frequenzen");
        if (navaidsResult.status === "rejected") failedSources.push("Navigationshilfen");
        const status = (failedSources.length
            ? "Airport gefunden. Einige Datenquellen sind nicht erreichbar: " + failedSources.join(", ") + "."
            : "Informationen für " + airport.ident + " geladen.")
            + (airportCacheWarning ? " Lokaler Datencache nicht verfügbar; Datensätze werden beim nächsten Abruf erneut geladen." : "");
        return {
            ident: airport.ident,
            title: airport.icao_code || airport.ident,
            name: airport.name,
            searchCode: code,
            html,
            status
        };
    }

    function updateAirportDocument(airportDocument, previousDocument) {
        const existingIndex = previousDocument
            ? airportDocuments.indexOf(previousDocument)
            : airportDocuments.findIndex((document) => document.ident === airportDocument.ident);
        if (existingIndex >= 0) airportDocuments[existingIndex] = airportDocument;
        else airportDocuments.push(airportDocument);
    }

    function setAirportLoading(isLoading) {
        airportSearchButton.disabled = isLoading;
        refreshAirportButton.disabled = isLoading || !activeAirportDocument;
    }

    function renderAirportDocumentTabs() {
        airportDocumentTabs.replaceChildren();
        refreshAirportButton.disabled = airportRequestInProgress || !activeAirportDocument;
        if (!airportDocuments.length) {
            const empty = document.createElement("span");
            empty.className = "chart-tabs-empty";
            empty.textContent = "Noch keine Flughäfen geöffnet";
            airportDocumentTabs.appendChild(empty);
            return;
        }
        airportDocuments.forEach((airportDocument) => {
            const tab = document.createElement("div");
            tab.className = "chart-document-tab"
                + (airportDocument === activeAirportDocument ? " is-active" : "");
            const select = document.createElement("button");
            select.type = "button";
            select.className = "chart-document-select";
            select.setAttribute("role", "tab");
            select.setAttribute("aria-selected", String(airportDocument === activeAirportDocument));
            select.title = airportDocument.name;
            select.textContent = airportDocument.title;
            select.addEventListener("click", () => activateAirportDocument(airportDocument));

            const close = document.createElement("button");
            close.type = "button";
            close.className = "chart-document-close";
            close.setAttribute("aria-label", airportDocument.title + " schließen");
            close.title = "Flughafen-Tab schließen";
            close.textContent = "×";
            close.addEventListener("click", () => closeAirportDocument(airportDocument));

            tab.append(select, close);
            airportDocumentTabs.appendChild(tab);
        });
    }

    function activateAirportDocument(airportDocument) {
        if (!airportDocuments.includes(airportDocument)) return;
        activeAirportDocument = airportDocument;
        airportResults.innerHTML = airportDocument.html;
        airportStatus.textContent = airportDocument.status;
        renderAirportDocumentTabs();
    }

    function closeAirportDocument(airportDocument) {
        const index = airportDocuments.indexOf(airportDocument);
        if (index < 0) return;
        const wasActive = airportDocument === activeAirportDocument;
        airportDocuments.splice(index, 1);
        if (wasActive) {
            activeAirportDocument = null;
            if (airportDocuments.length) {
                activateAirportDocument(airportDocuments[Math.min(index, airportDocuments.length - 1)]);
            } else {
                airportResults.replaceChildren();
                airportStatus.textContent =
                    "Gib einen Flughafen-Code ein, um Wetter, ATIS, Start- und Landebahnen sowie Frequenzen abzurufen.";
            }
        }
        renderAirportDocumentTabs();
    }

    async function loadAirportInfo(code, forceRefresh) {
        const airports = await loadAirportCsv("airports.csv", null, forceRefresh);
        const matches = airports.filter((airport) =>
            airport.icao_code === code ||
            airport.ident === code ||
            airport.gps_code === code ||
            airport.iata_code === code
        );
        matches.sort((a, b) => {
            const aScore = a.icao_code === code || a.ident === code ? 0 : 1;
            const bScore = b.icao_code === code || b.ident === code ? 0 : 1;
            return aScore - bScore;
        });

        if (!matches.length) {
            throw new Error("Kein Flughafen mit dem Code " + code + " in den OurAirports-Daten gefunden.");
        }
        return { airport: matches[0] };
    }

    async function fetchWeatherProduct(product, icao) {
        if (window.AndroidApp && typeof window.AndroidApp.fetchAirportWeather === "function") {
            return new Promise((resolve, reject) => {
                const callbackId = String(++airportWeatherRequestId);
                airportWeatherCallbacks.set(callbackId, { resolve, reject });
                window.AndroidApp.fetchAirportWeather(product, icao, callbackId);
            });
        }

        const url = new URL("https://aviationweather.gov/api/data/" + product);
        url.searchParams.set("ids", icao);
        url.searchParams.set("format", "json");
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Wetterdienst antwortet mit HTTP " + response.status + ".");
        }
        const data = await response.json();
        return Array.isArray(data) ? data[0] || null : null;
    }

    async function fetchLatestAtis(icao) {
        if (!airportAtisStationsPromise) {
            airportAtisStationsPromise = fetch("https://atis.info/api/stations", { cache: "no-store" })
                .then((response) => {
                    if (!response.ok) throw new Error("ATIS-Dienst antwortet mit HTTP " + response.status + ".");
                    return response.json();
                })
                .then((stations) => {
                    if (!Array.isArray(stations)) throw new Error("ATIS-Dienst lieferte ungültige Stationsdaten.");
                    return new Set(stations.map((station) => String(station).toUpperCase()));
                })
                .catch((error) => {
                    airportAtisStationsPromise = null;
                    throw error;
                });
        }

        const stations = await airportAtisStationsPromise;
        const station = String(icao || "").trim().toUpperCase();
        if (!stations.has(station)) return null;

        const response = await fetch("https://atis.info/api/" + encodeURIComponent(station), { cache: "no-store" });
        if (!response.ok) {
            throw new Error("ATIS-Dienst antwortet mit HTTP " + response.status + ".");
        }
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("ATIS-Dienst lieferte ungültige Meldungsdaten.");
        return data;
    }

    window.onAirportWeatherResponse = (callbackId, status, responseText) => {
        const callbacks = airportWeatherCallbacks.get(callbackId);
        if (!callbacks) return;
        airportWeatherCallbacks.delete(callbackId);
        if (status < 200 || status >= 300) {
            callbacks.reject(new Error("Wetterdienst antwortet mit HTTP " + status + "."));
            return;
        }
        try {
            const data = JSON.parse(responseText);
            callbacks.resolve(Array.isArray(data) ? data[0] || null : null);
        } catch (error) {
            callbacks.reject(new Error("Wetterdienst lieferte ungültige Daten."));
        }
    };

    async function loadAirportCsv(fileName, predicate, forceRefresh) {
        let csv = forceRefresh ? null : airportCsvCache.get(fileName);
        if (!csv) {
            const cached = forceRefresh ? null : await readCachedAirportCsv(fileName);
            if (cached && Date.now() - cached.savedAt < 7 * 24 * 60 * 60 * 1000) {
                csv = cached.csv;
            } else {
                const url = "https://davidmegginson.github.io/ourairports-data/" + fileName;
                const response = await fetch(url, { cache: forceRefresh ? "no-store" : "default" });
                if (!response.ok) {
                    throw new Error("OurAirports antwortet mit HTTP " + response.status + ".");
                }
                csv = await response.text();
                await writeCachedAirportCsv(fileName, csv);
            }
            airportCsvCache.set(fileName, csv);
        }

        const lines = csv.split(/\r?\n/);
        if (!lines.length || !lines[0]) {
            throw new Error("Die Flughafendaten haben ein ungültiges Format.");
        }
        const headers = parseCsvLine(lines[0]);
        const results = [];
        for (let i = 1; i < lines.length; i += 1) {
            if (!lines[i]) continue;
            const values = parseCsvLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || "";
            });
            if (!predicate || predicate(row)) results.push(row);
        }
        return results;
    }

    function openAirportDatabase() {
        if (!window.indexedDB) {
            airportCacheWarning = true;
            return Promise.resolve(null);
        }
        if (airportDatabasePromise) return airportDatabasePromise;
        airportDatabasePromise = new Promise((resolve) => {
            const request = window.indexedDB.open("b737-airport-data", 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore("csv", { keyPath: "name" });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                airportCacheWarning = true;
                console.error("Airport-Datencache konnte nicht geöffnet werden.", request.error);
                resolve(null);
            };
            request.onblocked = () => {
                airportCacheWarning = true;
                console.error("Airport-Datencache ist durch eine andere Verbindung blockiert.");
                resolve(null);
            };
        });
        return airportDatabasePromise;
    }

    async function readCachedAirportCsv(fileName) {
        const database = await openAirportDatabase();
        if (!database) return null;
        return new Promise((resolve) => {
            const transaction = database.transaction("csv", "readonly");
            const request = transaction.objectStore("csv").get(fileName);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => {
                airportCacheWarning = true;
                console.error("Airport-Datencache konnte nicht gelesen werden.", request.error);
                resolve(null);
            };
        });
    }

    async function writeCachedAirportCsv(fileName, csv) {
        const database = await openAirportDatabase();
        if (!database) return;
        await new Promise((resolve) => {
            const transaction = database.transaction("csv", "readwrite");
            transaction.objectStore("csv").put({ name: fileName, csv, savedAt: Date.now() });
            transaction.oncomplete = resolve;
            transaction.onerror = () => {
                airportCacheWarning = true;
                console.error("Airport-Datencache konnte nicht gespeichert werden.", transaction.error);
                resolve();
            };
            transaction.onabort = () => {
                airportCacheWarning = true;
                console.error("Speichern des Airport-Datencaches wurde abgebrochen.", transaction.error);
                resolve();
            };
        });
    }

    function parseCsvLine(line) {
        const fields = [];
        let field = "";
        let quoted = false;
        for (let i = 0; i < line.length; i += 1) {
            const character = line[i];
            if (character === '"' && quoted && line[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (character === '"') {
                quoted = !quoted;
            } else if (character === "," && !quoted) {
                fields.push(field);
                field = "";
            } else {
                field += character;
            }
        }
        fields.push(field);
        return fields;
    }

    function renderAirportInfo(info, metar, taf, atis, runways, frequencies, navaids) {
        const airport = info.airport;
        const coordinates = [airport.latitude_deg, airport.longitude_deg]
            .filter(Boolean)
            .join(", ");
        const elevation = airport.elevation_ft ? airport.elevation_ft + " ft" : "Keine Angabe";
        const runwayInUse = estimateRunwayInUse(metar, runways);
        return `
            <header class="airport-heading">
                <h3>${escapeHtml(airport.name)} (${escapeHtml(airport.icao_code || airport.ident)})</h3>
                <p>${escapeHtml([airport.municipality, airport.iso_country].filter(Boolean).join(", ") || "Standort nicht angegeben")}</p>
                <p>${coordinates ? escapeHtml(coordinates) + " · " : ""}Elevation ${escapeHtml(elevation)}${airport.iata_code ? " · IATA " + escapeHtml(airport.iata_code) : ""}</p>
            </header>
            <div class="airport-info-grid">
                <section class="airport-card">
                    <h3>Aktuelles METAR</h3>
                    ${metar ? `
                        <p class="airport-weather-raw">${escapeHtml(metar.rawOb || "Kein Rohbericht")}</p>
                        <p>Wind: ${escapeHtml(formatWind(metar))}</p>
                        <p>Temperatur / Taupunkt: ${escapeHtml(formatOptional(metar.temp, "°C"))} / ${escapeHtml(formatOptional(metar.dewp, "°C"))}</p>
                        <p>Sicht: ${escapeHtml(formatOptional(metar.visib, " km"))} · QNH: ${escapeHtml(formatAltimeter(metar.altim))}</p>
                        <p>Flugwetter: ${escapeHtml(metar.fltCat || "Keine Einstufung")}</p>
                    ` : "<p>Kein aktueller METAR verfügbar.</p>"}
                </section>
                <section class="airport-card">
                    <h3>Runway in use (Schätzung)</h3>
                    <p>${escapeHtml(runwayInUse)}</p>
                    <p class="airport-data-note">Aus METAR-Windrichtung und verfügbaren Runway-Daten abgeleitet. Fehlen exakte Richtungen, werden sie näherungsweise aus der Runway-Nummer abgeleitet; die magnetische Missweisung kann abweichen. Maßgeblich sind ATIS und Anweisungen der Flugsicherung.</p>
                </section>
                <section class="airport-card">
                    <h3>TAF Vorhersage</h3>
                    ${taf ? `<p class="airport-taf-raw">${escapeHtml(taf.rawTAF || "Kein TAF-Text verfügbar.")}</p>` : "<p>Keine TAF-Vorhersage verfügbar.</p>"}
                </section>
                <section class="airport-card">
                    <h3>Aktuelle ATIS</h3>
                    ${atis && atis.unavailable
                        ? "<p>ATIS konnte momentan nicht abgerufen werden. Bitte später erneut suchen.</p>"
                        : atis && atis.length ? atis.map((report) => {
                        const reportType = {
                            arr: "Ankunft",
                            dep: "Abflug",
                            combined: "Ankunft / Abflug"
                        }[report.type] || "ATIS";
                        const updatedAt = report.updatedAt ? new Date(report.updatedAt) : null;
                        const updateLabel = updatedAt && Number.isFinite(updatedAt.getTime())
                            ? updatedAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }) + " UTC"
                            : "";
                        return `
                            <div class="airport-data-row">
                                <strong>${escapeHtml(reportType)}${report.code ? " · Information " + escapeHtml(report.code) : ""}${updateLabel ? " · " + escapeHtml(updateLabel) : ""}</strong>
                                <p class="airport-weather-raw">${escapeHtml(report.datis || "Keine ATIS-Meldung verfügbar.")}</p>
                            </div>
                        `;
                    }).join("") : "<p>Keine digitale ATIS für diesen Flughafen verfügbar. Der Dienst deckt nur ausgewählte US-Flughäfen ab.</p>"}
                    <p class="airport-data-note">Quelle: FAA Digital ATIS via atis.info. Aktualisierungszeit in UTC; Verfügbarkeit und Aktualität vor Verwendung prüfen.</p>
                </section>
                <section class="airport-card">
                    <h3>Runways</h3>
                    ${runways.length ? runways.map((runway) => {
                        const runwayNavaids = navaids.filter((navaid) => navaidMatchesRunway(navaid, runway));
                        const approachSummary = formatRunwayApproaches(runwayNavaids, frequencies, runway);
                        const ilsFrequencies = formatRunwayIlsFrequencies(runwayNavaids, frequencies, runway);
                        return `
                            <div class="airport-data-row">
                                <strong>${escapeHtml(runway.le_ident || "?")} / ${escapeHtml(runway.he_ident || "?")} · ${escapeHtml(formatFeet(runway.length_ft))} × ${escapeHtml(formatFeet(runway.width_ft))}</strong>
                                <span><strong>Bahnrichtung:</strong> ${escapeHtml(formatRunwayDirection(runway))}</span>
                                <span>${escapeHtml(runway.surface || "Belag unbekannt")} · Runway-Beleuchtung: ${runway.lighted === "1" ? "ja" : runway.lighted === "0" ? "nein" : "nicht angegeben"}${runway.closed === "1" ? " · GESCHLOSSEN" : ""}</span>
                                <span><strong>ILS-Frequenz:</strong> ${escapeHtml(ilsFrequencies || "Keine ILS-Frequenz in den verfügbaren Daten gefunden")}</span>
                                <span>Anflug-/Navigationshilfen: ${escapeHtml(approachSummary || "Keine runway-spezifische Hilfe in den verfügbaren Daten gefunden")}</span>
                            </div>
                        `;
                    }).join("") : "<p>Keine Runway-Daten verfügbar.</p>"}
                </section>
                <section class="airport-card">
                    <h3>Anflug- und Navigationshilfen</h3>
                    ${navaids.length ? `
                        ${navaids.map((navaid) => `
                            <div class="airport-data-row">
                                <strong>${escapeHtml(navaid.type || "Navigationshilfe")} · ${escapeHtml(navaid.ident || "—")}${navaid.frequency_khz ? " · " + escapeHtml(formatNavaidFrequency(navaid.frequency_khz)) : ""}</strong>
                                <span>${escapeHtml(navaid.name || "Keine Bezeichnung")}${navaidMatchesRunway(navaid, null) ? " · " + escapeHtml(navaidRunwayLabel(navaid)) : ""}</span>
                            </div>
                        `).join("")}
                        <p class="airport-data-note">Die Datensätze zeigen Navigationshilfen, nicht die vollständigen veröffentlichten Anflugverfahren. Verfügbarkeit und Minima immer anhand aktueller AIP-/ChartFox-Karten prüfen.</p>
                    ` : "<p>Für diesen Flughafen wurden keine Navigationshilfen in OurAirports gefunden. Das bestätigt nicht, dass keine Anflugverfahren vorhanden sind.</p>"}
                </section>
                <section class="airport-card">
                    <h3>Frequenzen</h3>
                    ${frequencies.length ? frequencies.map((frequency) => `
                        <div class="airport-data-row">
                            <strong>${escapeHtml(frequency.type || "Frequenz")} · ${escapeHtml(frequency.frequency_mhz || "—")} MHz</strong>
                            <span>${escapeHtml(frequency.description || "Keine Beschreibung")}</span>
                        </div>
                    `).join("") : "<p>Keine Frequenzdaten verfügbar.</p>"}
                </section>
            </div>
        `;
    }

    function formatRunwayDirection(runway) {
        const ends = [
            { ident: runway.le_ident, heading: runway.le_heading_deg },
            { ident: runway.he_ident, heading: runway.he_heading_deg }
        ];
        const directions = ends.map((end) => {
            const direction = getRunwayEndDirection(end.ident, end.heading);
            if (!direction) return null;
            const roundedHeading = Math.round(direction.heading);
            const degrees = String(roundedHeading === 0 && direction.heading > 0 ? 360 : roundedHeading % 360).padStart(3, "0");
            const accuracy = direction.isApproximate ? " (ca., magnetisch)" : " (wahr)";
            return (end.ident ? "RWY " + end.ident + " " : "") + degrees + "°" + accuracy;
        }).filter(Boolean);

        return directions.length ? directions.join(" / ") : "Nicht verfügbar";
    }

    function getRunwayEndDirection(ident, rawHeading) {
        if (rawHeading !== null && rawHeading !== undefined && String(rawHeading).trim() !== "") {
            const heading = Number(rawHeading);
            if (Number.isFinite(heading) && heading >= 0 && heading <= 360) {
                return { heading, isApproximate: false };
            }
        }

        const match = String(ident || "").trim().match(/^(0[1-9]|[12]\d|3[0-6])[LRC]?$/i);
        if (!match) return null;
        return { heading: Number(match[1]) * 10, isApproximate: true };
    }

    function estimateRunwayInUse(metar, runways) {
        if (!metar) return "Keine Schätzung möglich: kein aktueller METAR verfügbar.";
        if (!Array.isArray(runways) || !runways.length) return "Keine Schätzung möglich: keine Runway-Daten verfügbar.";

        const hasWindDirection = metar.wdir !== null && metar.wdir !== undefined && String(metar.wdir).trim() !== "";
        const hasWindSpeed = metar.wspd !== null && metar.wspd !== undefined && String(metar.wspd).trim() !== "";
        const windDirection = Number(metar.wdir);
        const windSpeed = Number(metar.wspd);
        if (!hasWindDirection || !Number.isFinite(windDirection) || windDirection < 0 || windDirection > 360) {
            return "Keine Schätzung möglich: Windrichtung ist variabel oder nicht verfügbar.";
        }
        if (!hasWindSpeed || !Number.isFinite(windSpeed) || windSpeed < 3) {
            return "Kein eindeutiger Windhinweis: Wind ist ruhig oder nicht verfügbar.";
        }

        const runwayEnds = runways
            .filter((runway) => runway.closed !== "1")
            .flatMap((runway) => [
                { ident: runway.le_ident, direction: getRunwayEndDirection(runway.le_ident, runway.le_heading_deg) },
                { ident: runway.he_ident, direction: getRunwayEndDirection(runway.he_ident, runway.he_heading_deg) }
            ])
            .filter((end) => end.ident && end.direction)
            .map((end) => ({ ident: end.ident, ...end.direction }));
        if (!runwayEnds.length) return "Keine Schätzung möglich: Runway-Richtungen fehlen.";

        const candidates = runwayEnds.map((end) => {
            const difference = ((windDirection - end.heading + 540) % 360) - 180;
            const radians = difference * Math.PI / 180;
            return {
                ident: end.ident,
                heading: end.heading,
                isApproximate: end.isApproximate,
                headwind: windSpeed * Math.cos(radians),
                crosswind: Math.abs(windSpeed * Math.sin(radians))
            };
        }).sort((a, b) => b.headwind - a.headwind || a.crosswind - b.crosswind);

        const best = candidates[0];
        const likelyRunways = candidates.filter((candidate) => best.headwind - candidate.headwind <= 1);
        const labels = likelyRunways.map((candidate) => {
            const component = Math.round(Math.abs(candidate.headwind)) + " kt " +
                (candidate.headwind >= 0 ? "von vorn" : "von hinten");
            const accuracy = candidate.isApproximate ? " ca. " : " ";
            return "RWY " + candidate.ident + " (" + component + ", Heading" + accuracy + Math.round(candidate.heading) + "°" +
                (candidate.isApproximate ? " magnetisch" : " wahr") + ")";
        });
        return labels.join(" / ");
    }

    function formatOptional(value, suffix) {
        return value === null || value === undefined || value === "" ? "—" : value + suffix;
    }

    function navaidRunwayLabel(navaid) {
        const match = String(navaid.name || "").match(/\b(?:RWY|RUNWAY)\s*([0-3]?\d[LRCTW]?)\b/i);
        return match ? "RWY " + match[1].toUpperCase() : "";
    }

    function navaidMatchesRunway(navaid, runway) {
        const runwayLabel = navaidRunwayLabel(navaid);
        if (!runway) return Boolean(runwayLabel);
        if (!runwayLabel) return false;
        const runwayIds = [runway.le_ident, runway.he_ident].filter(Boolean).map((ident) => ident.toUpperCase());
        return runwayIds.some((ident) => runwayLabel === "RWY " + ident);
    }

    function formatNavaidFrequency(value) {
        const frequency = Number(value);
        return Number.isFinite(frequency) && frequency > 0
            ? (frequency / 1000).toFixed(2) + " MHz"
            : "Frequenz unbekannt";
    }

    function formatRunwayApproaches(navaids, frequencies, runway) {
        const approachAids = navaids.filter((navaid) =>
            /(ILS|LOC|LOCALIZER|LDA|SDF|GLS|GBAS|GS|GP|DME|VOR|NDB)/i.test(navaid.type || "")
        );
        const approaches = approachAids.map((navaid) => {
            const frequency = navaid.frequency_khz ? " " + formatNavaidFrequency(navaid.frequency_khz) : "";
            return (navaid.type || "Aid") + (navaid.ident ? " " + navaid.ident : "") + frequency;
        });

        frequencies.filter((frequency) => isIlsFrequencyForRunway(frequency, runway))
            .forEach((frequency) => {
                const description = String(frequency.description || "").trim();
                const label = !description ? "ILS" :
                    /\bILS\b/i.test(description) ? description : "ILS RWY " + description;
                approaches.push(label + " " + frequency.frequency_mhz + " MHz");
            });

        return [...new Set(approaches)].join("; ");
    }

    function formatRunwayIlsFrequencies(navaids, frequencies, runway) {
        const ilsNavaidFrequencies = navaids
            .filter((navaid) => /(ILS|LOC|LOCALIZER)/i.test(navaid.type || ""))
            .map((navaid) => {
                const runwayLabel = navaidRunwayLabel(navaid);
                return runwayLabel && navaid.frequency_khz
                    ? formatRunwayIlsFrequency(runwayLabel, formatNavaidFrequency(navaid.frequency_khz))
                    : "";
            })
            .filter(Boolean);
        const airportIlsFrequencies = frequencies
            .filter((frequency) => isIlsFrequencyForRunway(frequency, runway))
            .map((frequency) => {
                const value = Number(frequency.frequency_mhz);
                const description = String(frequency.description || "");
                const match = description.match(/\b(?:RWY|RUNWAY)\s*([0-3]?\d[LRCTW]?)\b|\bILS\s+([0-3]?\d[LRCTW]?)\b/i);
                const runwayIdent = match && (match[1] || match[2]);
                return runwayIdent && Number.isFinite(value) && value > 0
                    ? formatRunwayIlsFrequency("RWY " + runwayIdent, value.toFixed(2) + " MHz")
                    : "";
            })
            .filter(Boolean);
        return [...new Set([...ilsNavaidFrequencies, ...airportIlsFrequencies])].join(", ");
    }

    function formatRunwayIlsFrequency(runwayLabel, frequency) {
        const match = String(runwayLabel).match(/\bRWY\s*([0-3]?\d)([LRC]?)\b/i);
        if (!match || !frequency) return "";
        const ident = String(Number(match[1])) + match[2].toUpperCase();
        return "RWY " + ident + ": " + frequency;
    }

    function isIlsFrequencyForRunway(frequency, runway) {
        const type = String(frequency.type || "").toUpperCase();
        const description = String(frequency.description || "").toUpperCase();
        if (!/\bILS\b|\bLOC\b|LOCALIZER/.test(type + " " + description)) return false;

        const runwayIds = [runway.le_ident, runway.he_ident]
            .filter(Boolean)
            .map((ident) => ident.toUpperCase().match(/^0*(\d{1,2})([LRC]?)$/))
            .filter(Boolean)
            .flatMap((match) => {
                const number = String(Number(match[1]));
                const suffix = match[2];
                const paddedNumber = number.padStart(2, "0");
                return [...new Set([number, paddedNumber])].map((value) => value + suffix);
            });
        if (!runwayIds.length) return false;
        const runwayPattern = runwayIds
            .map((ident) => ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");
        return new RegExp("\\b(?:RWY|RUNWAY)\\s*(?:" + runwayPattern + ")\\b").test(description) ||
            new RegExp("\\bILS\\s+(?:" + runwayPattern + ")\\b").test(description) ||
            new RegExp("\\b(?:" + runwayPattern + ")\\b").test(description);
    }

    function formatWind(metar) {
        if (metar.wdir === null || metar.wdir === undefined || metar.wdir === "") return "—";
        const direction = metar.wdir === "VRB" ? "VRB" : metar.wdir + "°";
        return direction + " / " + (metar.wspd ?? "—") + " kt" + (metar.wgst ? " Böen " + metar.wgst + " kt" : "");
    }

    function formatAltimeter(value) {
        if (value === null || value === undefined || value === "") return "—";
        return Number(value) > 100 ? value + " hPa" : value + " inHg";
    }

    function formatFeet(value) {
        return value ? Number(value).toLocaleString("de-DE") + " ft" : "—";
    }

    function openChartFox() {
        if (window.AndroidApp && typeof window.AndroidApp.openChartFox === "function") {
            window.AndroidApp.openChartFox();
        } else {
            window.location.href = "https://chartfox.org";
        }
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function showEmpty(message) {
        fileViewer.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
    }

    function setPdfTools(visible) {
        pdfTools.classList.toggle("hidden", !visible);
    }

    async function handleFile(file) {
        pdfDoc = null;
        pdfPage = 1;
        pdfZoom = 1;
        setPdfTools(false);
        fileMeta.textContent = file.name + " · " + (file.type || "Datei") + " · " + formatBytes(file.size);

        if (file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            fileViewer.innerHTML = "";
            const img = document.createElement("img");
            img.src = url;
            img.alt = file.name;
            fileViewer.appendChild(img);
            return;
        }

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            await showPdf(file);
            return;
        }

        if (file.type.startsWith("text/") || /\.(txt|csv|json|xml|html|htm)$/i.test(file.name)) {
            const text = await file.text();
            fileViewer.innerHTML = "";
            const pre = document.createElement("pre");
            pre.textContent = text;
            fileViewer.appendChild(pre);
            return;
        }

        showEmpty("Keine Vorschau fuer diesen Dateityp.");
    }

    async function showPdf(file) {
        if (!window.pdfjsLib) {
            showEmpty("PDF-Viewer nicht geladen.");
            return;
        }

        try {
            const data = await file.arrayBuffer();
            pdfDoc = await window.pdfjsLib.getDocument({ data }).promise;
            setPdfTools(true);
            await renderPdfPage();
        } catch (error) {
            showEmpty("PDF konnte nicht angezeigt werden.");
        }
    }

    async function renderPdfPage() {
        if (!pdfDoc) return;
        if (pdfRenderTask) {
            pdfRenderTask.cancel();
            pdfRenderTask = null;
        }

        const page = await pdfDoc.getPage(pdfPage);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.max(320, fileViewer.clientWidth - 34);
        const scale = Math.min(2.4, Math.max(0.6, (maxWidth / baseViewport.width) * pdfZoom));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        fileViewer.innerHTML = "";
        fileViewer.appendChild(canvas);
        pdfPageLabel.textContent = "Seite " + pdfPage + " / " + pdfDoc.numPages;
        pdfRenderTask = page.render({ canvasContext: context, viewport });
        try {
            await pdfRenderTask.promise;
        } catch (error) {
            if (error && error.name !== "RenderingCancelledException") {
                showEmpty("PDF-Seite konnte nicht angezeigt werden.");
            }
        } finally {
            pdfRenderTask = null;
        }
    }

    async function handleChartFile(file) {
        if (!file) return;
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isImage && !isPdf) {
            chartStatus.textContent = "Format nicht unterstützt. Bitte PDF oder Bild (PNG/JPG) wählen.";
            return;
        }

        const chartDocument = {
            file,
            title: file.name,
            isImage,
            imageUrl: isImage ? URL.createObjectURL(file) : null,
            pdfDoc: null,
            page: 1,
            pdfZoom: 1.0,
            imageZoom: 1.0,
            rotation: 0,
            annotationStrokes: {}
        };
        chartDocuments.push(chartDocument);
        await activateChartDocument(chartDocument);
    }

    function renderChartDocumentTabs() {
        chartDocumentTabs.innerHTML = "";
        if (!chartDocuments.length) {
            const empty = document.createElement("span");
            empty.className = "chart-tabs-empty";
            empty.textContent = "Noch keine Charts geöffnet";
            chartDocumentTabs.appendChild(empty);
            return;
        }

        chartDocuments.forEach((chartDocument) => {
            const tab = document.createElement("div");
            tab.className = "chart-document-tab" +
                (chartDocument === activeChartDocument ? " is-active" : "");
            const select = document.createElement("button");
            select.type = "button";
            select.className = "chart-document-select";
            select.setAttribute("role", "tab");
            select.setAttribute("aria-selected", String(chartDocument === activeChartDocument));
            select.title = chartDocument.title;
            select.textContent = chartDocument.title;
            select.addEventListener("click", () => activateChartDocument(chartDocument));

            const close = document.createElement("button");
            close.type = "button";
            close.className = "chart-document-close";
            close.setAttribute("aria-label", chartDocument.title + " schließen");
            close.title = "Chart schließen";
            close.textContent = "×";
            close.addEventListener("click", () => closeChartDocument(chartDocument));

            tab.append(select, close);
            chartDocumentTabs.appendChild(tab);
        });
    }

    async function activateChartDocument(chartDocument) {
        if (!chartDocuments.includes(chartDocument)) return;
        saveActiveChartDocumentState();
        if (chartPdfRenderTask) {
            chartPdfRenderTask.cancel();
            chartPdfRenderTask = null;
        }
        activeChartDocument = chartDocument;
        chartPdfPage = chartDocument.page;
        chartPdfZoom = chartDocument.pdfZoom;
        chartImageZoom = chartDocument.imageZoom;
        chartRotation = chartDocument.rotation;
        chartPdfDoc = chartDocument.pdfDoc;
        chartAnnotationStrokes = chartDocument.annotationStrokes;
        chartStatus.textContent = chartDocument.title + " (" + formatBytes(chartDocument.file.size) + ")";
        chartViewer.classList.remove("is-drawing");
        renderChartDocumentTabs();

        if (chartDocument.isImage) {
            chartPdfDoc = null;
            chartViewer.innerHTML = "";
            chartAnnotationCanvas = null;
            const img = document.createElement("img");
            img.src = chartDocument.imageUrl;
            img.alt = chartDocument.title;
            img.onload = () => {
                if (activeChartDocument !== chartDocument) return;
                renderChartImage(img);
                ensureChartAnnotationCanvas();
                redrawChartAnnotations();
            };
            chartViewer.appendChild(img);
            chartPdfPageLabel.textContent = "Bild";
            return;
        }

        try {
            if (!chartDocument.pdfDoc) {
                const data = await chartDocument.file.arrayBuffer();
                chartDocument.pdfDoc = await window.pdfjsLib.getDocument({ data }).promise;
            }
            if (!chartDocuments.includes(chartDocument)) {
                chartDocument.pdfDoc.destroy();
                return;
            }
            if (activeChartDocument !== chartDocument) return;
            chartPdfDoc = chartDocument.pdfDoc;
            await renderChartPdfPage();
        } catch (error) {
            if (activeChartDocument === chartDocument) {
                chartViewer.innerHTML = '<div class="empty">Chart PDF konnte nicht geöffnet werden.</div>';
                chartStatus.textContent = chartDocument.title + " konnte nicht geöffnet werden.";
            }
        }
    }

    function saveActiveChartDocumentState() {
        if (!activeChartDocument) return;
        activeChartDocument.page = chartPdfPage;
        activeChartDocument.pdfZoom = chartPdfZoom;
        activeChartDocument.imageZoom = chartImageZoom;
        activeChartDocument.rotation = chartRotation;
        activeChartDocument.pdfDoc = chartPdfDoc;
        activeChartDocument.annotationStrokes = chartAnnotationStrokes;
    }

    function closeChartDocument(chartDocument) {
        const index = chartDocuments.indexOf(chartDocument);
        if (index < 0) return;
        const wasActive = chartDocument === activeChartDocument;
        if (wasActive) saveActiveChartDocumentState();
        chartDocuments.splice(index, 1);
        if (chartDocument.imageUrl) URL.revokeObjectURL(chartDocument.imageUrl);
        if (chartDocument.pdfDoc) chartDocument.pdfDoc.destroy();

        if (wasActive) {
            activeChartDocument = null;
            chartPdfDoc = null;
            chartAnnotationCanvas = null;
            if (chartPdfRenderTask) {
                chartPdfRenderTask.cancel();
                chartPdfRenderTask = null;
            }
            if (chartDocuments.length) {
                activateChartDocument(chartDocuments[Math.min(index, chartDocuments.length - 1)]);
            } else {
                chartViewer.innerHTML = '<div class="empty">Keine Chart geladen. Klicke auf "Charts laden" oder öffne ChartFox.</div>';
                chartPdfPageLabel.textContent = "Seite 1 / 1";
                chartStatus.textContent = "Keine Chart geöffnet";
            }
        }
        renderChartDocumentTabs();
    }

    function renderChartImage(img) {
        saveActiveChartDocumentState();
        const availableWidth = Math.max(1, chartViewer.clientWidth - 24);
        const availableHeight = Math.max(1, chartViewer.clientHeight - 24);
        const rotated = chartRotation % 180 !== 0;
        const maxWidth = rotated ? availableHeight : availableWidth;
        const maxHeight = rotated ? availableWidth : availableHeight;
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let width = Math.min(maxWidth, maxHeight * aspectRatio);
        let height = width / aspectRatio;

        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }

        width *= chartImageZoom;
        height *= chartImageZoom;
        img.style.width = width + "px";
        img.style.height = height + "px";
        img.style.maxWidth = "none";
        img.style.maxHeight = "none";
        img.style.position = "absolute";
        img.style.top = "50%";
        img.style.left = "50%";
        img.style.transform = "translate(-50%, -50%) rotate(" + chartRotation + "deg)";
        ensureChartAnnotationCanvas();
        redrawChartAnnotations();
    }

    function currentChartZoom() {
        return chartPdfDoc ? chartPdfZoom : chartImageZoom;
    }

    async function renderChartZoomAt(zoom, clientX, clientY) {
        const contentBounds = chartContentBounds();
        if (!contentBounds) return;
        const viewerBounds = chartViewer.getBoundingClientRect();
        const focalX = clientX ?? viewerBounds.left + chartViewer.clientWidth / 2;
        const focalY = clientY ?? viewerBounds.top + chartViewer.clientHeight / 2;
        const contentX = (focalX - contentBounds.left) / contentBounds.width;
        const contentY = (focalY - contentBounds.top) / contentBounds.height;
        const nextZoom = Math.max(0.25, Math.min(5, zoom));

        if (chartPdfDoc) {
            chartPdfZoom = nextZoom;
            await renderChartPdfPage();
        } else {
            const image = chartViewer.querySelector("img");
            if (!image) return;
            chartImageZoom = nextZoom;
            renderChartImage(image);
        }

        const nextBounds = chartContentBounds();
        if (!nextBounds) return;
        chartViewer.scrollLeft += nextBounds.left + contentX * nextBounds.width - focalX;
        chartViewer.scrollTop += nextBounds.top + contentY * nextBounds.height - focalY;
        redrawChartAnnotations();
        saveActiveChartDocumentState();
    }

    function scheduleChartZoom(zoom, clientX, clientY, immediate = false) {
        if (chartZoomTimer) {
            window.clearTimeout(chartZoomTimer);
            chartZoomTimer = null;
        }
        const applyZoom = () => {
            chartZoomTimer = null;
            void renderChartZoomAt(zoom, clientX, clientY);
        };
        if (immediate) applyZoom();
        else chartZoomTimer = window.setTimeout(applyZoom, 100);
    }

    async function renderChartPdfPage() {
        if (!chartPdfDoc) return;
        if (chartPdfRenderTask) {
            chartPdfRenderTask.cancel();
            chartPdfRenderTask = null;
        }

        const page = await chartPdfDoc.getPage(chartPdfPage);
        const baseViewport = page.getViewport({ scale: 1, rotation: chartRotation });
        const maxWidth = Math.max(1, chartViewer.clientWidth - 40);
        const maxHeight = Math.max(1, chartViewer.clientHeight - 24);
        const fitScale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
        const scale = Math.min(6.0, Math.max(0.1, fitScale * chartPdfZoom));
        const viewport = page.getViewport({ scale, rotation: chartRotation });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        chartViewer.innerHTML = "";
        chartViewer.appendChild(canvas);
        chartPdfPageLabel.textContent = "Seite " + chartPdfPage + " / " + chartPdfDoc.numPages;
        ensureChartAnnotationCanvas();
        redrawChartAnnotations();
        const renderTask = page.render({ canvasContext: context, viewport });
        chartPdfRenderTask = renderTask;
        saveActiveChartDocumentState();
        try {
            await renderTask.promise;
        } catch (error) {
            if (error && error.name !== "RenderingCancelledException") {
                chartViewer.innerHTML = '<div class="empty">Fehler beim Zeichnen der PDF-Seite.</div>';
            }
        } finally {
            if (chartPdfRenderTask === renderTask) chartPdfRenderTask = null;
        }
    }

    function ensureChartAnnotationCanvas() {
        if (!chartAnnotationCanvas || chartAnnotationCanvas.parentElement !== chartViewer) {
            chartAnnotationCanvas = document.createElement("canvas");
            chartAnnotationCanvas.className = "chart-annotation-canvas";
            chartAnnotationCanvas.setAttribute("aria-label", "Zeichenebene für die Chart");
            chartViewer.appendChild(chartAnnotationCanvas);
            let activeStroke = null;
            chartAnnotationCanvas.addEventListener("pointerdown", (event) => {
                if (!chartDrawingEnabled) return;
                event.preventDefault();
                event.stopPropagation();
                chartAnnotationCanvas.setPointerCapture(event.pointerId);
                activeStroke = null;
                const point = chartAnnotationPoint(event);
                if (!point) return;
                const strokes = currentChartAnnotationStrokes();
                activeStroke = {
                    points: [point],
                    width: chartEraserEnabled ? 0.025 : 0.004,
                    color: chartDrawingColor,
                    erase: chartEraserEnabled
                };
                strokes.push(activeStroke);
                redrawChartAnnotations();
            });
            chartAnnotationCanvas.addEventListener("pointermove", (event) => {
                if (!chartDrawingEnabled || !activeStroke ||
                    !chartAnnotationCanvas.hasPointerCapture(event.pointerId)) return;
                event.preventDefault();
                event.stopPropagation();
                const point = chartAnnotationPoint(event);
                if (!point) return;
                activeStroke.points.push(point);
                redrawChartAnnotations();
            });
            chartAnnotationCanvas.addEventListener("pointerup", (event) => {
                if (chartAnnotationCanvas.hasPointerCapture(event.pointerId)) {
                    chartAnnotationCanvas.releasePointerCapture(event.pointerId);
                }
                activeStroke = null;
            });
            chartAnnotationCanvas.addEventListener("pointercancel", (event) => {
                if (chartAnnotationCanvas.hasPointerCapture(event.pointerId)) {
                    chartAnnotationCanvas.releasePointerCapture(event.pointerId);
                }
                activeStroke = null;
            });
        }

        chartAnnotationCanvas.style.top = chartViewer.scrollTop + "px";
        chartAnnotationCanvas.style.left = chartViewer.scrollLeft + "px";
        const width = Math.max(1, chartViewer.clientWidth);
        const height = Math.max(1, chartViewer.clientHeight);
        const pixelRatio = window.devicePixelRatio || 1;
        if (chartAnnotationCanvas.width !== Math.round(width * pixelRatio) ||
            chartAnnotationCanvas.height !== Math.round(height * pixelRatio)) {
            chartAnnotationCanvas.width = Math.round(width * pixelRatio);
            chartAnnotationCanvas.height = Math.round(height * pixelRatio);
        }
        chartAnnotationCanvas.style.width = width + "px";
        chartAnnotationCanvas.style.height = height + "px";
        chartAnnotationCanvas.style.pointerEvents = chartDrawingEnabled ? "auto" : "none";
        chartViewer.classList.toggle("is-drawing", chartDrawingEnabled);
        chartAnnotationCanvas.style.cursor = chartDrawingEnabled
            ? (chartEraserEnabled ? "cell" : "crosshair")
            : "default";
    }

    function chartAnnotationPoint(event) {
        const bounds = chartContentBounds();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0 ||
            event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) return null;
        return {
            x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
            y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
        };
    }

    function chartContentBounds() {
        const content = chartViewer.querySelector("img") ||
            chartViewer.querySelector("canvas:not(.chart-annotation-canvas)");
        return content ? content.getBoundingClientRect() : null;
    }

    function currentChartAnnotationStrokes() {
        const pageKey = chartPdfDoc ? String(chartPdfPage) : "image";
        if (!chartAnnotationStrokes[pageKey]) chartAnnotationStrokes[pageKey] = [];
        return chartAnnotationStrokes[pageKey];
    }

    function redrawChartAnnotations() {
        if (!chartAnnotationCanvas || chartAnnotationCanvas.parentElement !== chartViewer) return;
        const context = chartAnnotationCanvas.getContext("2d");
        if (!context) return;
        const pixelRatio = window.devicePixelRatio || 1;
        const width = chartAnnotationCanvas.width / pixelRatio;
        const height = chartAnnotationCanvas.height / pixelRatio;
        const contentBounds = chartContentBounds();
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        if (!contentBounds) return;
        const overlayBounds = chartAnnotationCanvas.getBoundingClientRect();
        const offsetX = contentBounds.left - overlayBounds.left;
        const offsetY = contentBounds.top - overlayBounds.top;
        context.save();
        context.beginPath();
        context.rect(offsetX, offsetY, contentBounds.width, contentBounds.height);
        context.clip();
        context.lineCap = "round";
        context.lineJoin = "round";

        currentChartAnnotationStrokes().forEach((stroke) => {
            if (!stroke.points.length) return;
            context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
            context.strokeStyle = stroke.color || "#ff3030";
            context.lineWidth = Math.max(2, stroke.width * contentBounds.width);
            context.beginPath();
            context.moveTo(
                offsetX + stroke.points[0].x * contentBounds.width,
                offsetY + stroke.points[0].y * contentBounds.height
            );
            stroke.points.slice(1).forEach((point) => context.lineTo(
                offsetX + point.x * contentBounds.width,
                offsetY + point.y * contentBounds.height
            ));
            if (stroke.points.length === 1) {
                context.lineTo(
                    offsetX + stroke.points[0].x * contentBounds.width + 0.1,
                    offsetY + stroke.points[0].y * contentBounds.height + 0.1
                );
            }
            context.stroke();
        });
        context.globalCompositeOperation = "source-over";
        context.restore();
    }

    function setChartDrawingColor(color) {
        if (!/^#[0-9a-f]{6}$/i.test(color)) return;
        chartDrawingColor = color;
        chartEraserEnabled = false;
        if (chartEraserToggle) chartEraserToggle.setAttribute("aria-pressed", "false");
        document.querySelectorAll(".chart-color-swatch").forEach((button) => {
            const selected = button.dataset.drawColor.toLowerCase() === color.toLowerCase();
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
        ensureChartAnnotationCanvas();
    }

    function createBaseTileLayer() {
        return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>"
        });
    }

    async function fetchJsonWithRetry(url, attempts) {
        let lastError;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch(url, {
                    cache: "no-store",
                    signal: controller.signal
                });
                if (!response.ok) {
                    const error = new Error("HTTP " + response.status);
                    error.status = response.status;
                    if (response.status !== 429 && response.status < 500) throw error;
                    throw error;
                }
                return await response.json();
            } catch (error) {
                if (error.status && error.status !== 429 && error.status < 500) throw error;
                lastError = error.name === "AbortError"
                    ? new Error("Zeitüberschreitung beim Abruf.")
                    : error;
                if (attempt + 1 < attempts) {
                    await new Promise((resolve) => window.setTimeout(resolve, 500 * (2 ** attempt)));
                }
            } finally {
                window.clearTimeout(timeout);
            }
        }
        throw lastError || new Error("Daten konnten nicht geladen werden.");
    }

    async function loadRadarFrames() {
        if (!radarStatus) return;
        if (radarMetadataCache && Date.now() - radarMetadataFetchedAt < 5 * 60 * 1000) {
            if (radarEnabled) showRadarFrame(radarIndex);
            return;
        }
        if (radarMetadataRequest) return;
        radarStatus.textContent = "RainViewer-Radar lädt...";
        try {
            radarMetadataRequest = fetchJsonWithRetry(rainViewerApi, 3);
            const data = await radarMetadataRequest;
            const frames = data && data.radar && Array.isArray(data.radar.past)
                ? data.radar.past.filter((frame) =>
                    Number.isFinite(Number(frame.time)) &&
                    typeof frame.path === "string" &&
                    frame.path.startsWith("/")
                ).sort((a, b) => Number(a.time) - Number(b.time))
                : [];
            if (!data || !data.host || !frames.length) throw new Error("Keine gültigen Radarframes empfangen.");
            const previousTime = radarFrames[radarIndex] ? Number(radarFrames[radarIndex].time) : NaN;
            radarMetadataCache = data;
            radarMetadataFetchedAt = Date.now();
            radarErrorMessage = "";
            radarHost = data.host;
            radarFrames = frames;
            radarIndex = Number.isFinite(previousTime)
                ? frames.reduce((closest, frame, index) =>
                    Math.abs(Number(frame.time) - previousTime) <
                    Math.abs(Number(frames[closest].time) - previousTime) ? index : closest, 0)
                : frames.length - 1;
            updateRadarControls();
            rebuildRadarFrameLayers();
            if (radarEnabled) showRadarFrame(radarIndex);
        } catch (error) {
            console.error("RainViewer-Radar konnte nicht geladen werden.", error);
            if (radarMetadataCache && radarFrames.length) {
                radarErrorMessage = "Radar-API nicht erreichbar; Cache wird verwendet";
                if (radarEnabled) showRadarFrame(radarIndex);
            } else {
                radarErrorMessage = "Radar nicht verfügbar; Open-Meteo bleibt aktiv";
                updateRadarStatus("Wetterebenen");
                rainViewerTimeLabel.textContent = "Nicht verfügbar";
                updateRadarControls();
            }
        } finally {
            radarMetadataRequest = null;
        }
    }

    function rebuildRadarFrameLayers() {
        radarFrameLayers.forEach((layer) => flightMap.removeLayer(layer));
        radarFrameLayers = radarFrames.map((frame, frameIndex) => {
            const url = radarHost + frame.path + "/256/{z}/{x}/{y}/2/1_1.png";
            const layer = L.tileLayer(url, {
                opacity: 0,
                tileSize: 256,
                maxNativeZoom: 7,
                maxZoom: 13,
                keepBuffer: 0,
                pane: "overlayPane",
                zIndex: 450,
                attribution: 'Weather data by <a href="https://rainviewer.com" target="_blank" rel="noopener noreferrer">RainViewer</a>'
            });
            layer.rainViewerTileStats = { loaded: 0, failed: 0 };
            layer.on("tileload", () => { layer.rainViewerTileStats.loaded += 1; });
            layer.on("tileerror", () => {
                layer.rainViewerTileStats.failed += 1;
                checkRadarFrameTileStatus(frameIndex);
            });
            return layer;
        });
        if (radarEnabled && radarFrames.length) activateRadarFrameLayer(radarIndex);
    }

    function activateRadarFrameLayer(index) {
        radarFrameLayers.forEach((layer, frameIndex) => {
            if (frameIndex === index && radarEnabled) {
                if (!flightMap.hasLayer(layer)) layer.addTo(flightMap);
                layer.setOpacity(0.72);
            } else {
                layer.setOpacity(0);
                if (flightMap.hasLayer(layer)) flightMap.removeLayer(layer);
            }
        });
    }

    function checkRadarFrameTileStatus(frameIndex) {
        window.setTimeout(() => {
            const layer = radarFrameLayers[frameIndex];
            const stats = layer && layer.rainViewerTileStats;
            if (radarEnabled && frameIndex === radarIndex && stats &&
                stats.failed > 0 && stats.loaded === 0) {
                radarErrorMessage = "Radar nicht verfügbar; Open-Meteo bleibt aktiv";
                updateRadarStatus("Wetterebenen");
            }
        }, 3000);
    }

    function updateRainViewerTimeLabel() {
        const frame = radarFrames[radarIndex];
        if (!frame) {
            rainViewerTimeLabel.textContent = "Nicht verfügbar";
            return;
        }
        const time = new Date(Number(frame.time) * 1000);
        const local = time.toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
        const utc = time.toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC"
        });
        rainViewerTimeLabel.textContent = utc + " UTC · " + local + " lokal";
    }

    function updateRadarControls() {
        const disabled = !radarEnabled || radarFrames.length === 0;
        rainViewerTimeSlider.disabled = disabled;
        document.getElementById("radarPrev").disabled = disabled;
        document.getElementById("radarNext").disabled = disabled;
        radarPlayButton.disabled = disabled;
    }

    function showRadarFrame(index) {
        if (!flightMap || !radarEnabled || radarFrames.length === 0) return;
        radarIndex = (index + radarFrames.length) % radarFrames.length;
        rainViewerTimeSlider.value = String(radarIndex);
        activateRadarFrameLayer(radarIndex);
        checkRadarFrameTileStatus(radarIndex);
        updateRainViewerTimeLabel();
        updateRadarStatus("RainViewer · Echtwetter · Frame " +
            (radarIndex + 1) + " / " + radarFrames.length + " · " + rainViewerTimeLabel.textContent);
    }

    function updateRadarStatus(message) {
        radarStatus.textContent = message + (radarEnabled && radarErrorMessage
            ? " · " + radarErrorMessage
            : "");
    }

    function setRadarEnabled(enabled) {
        radarEnabled = Boolean(enabled);
        rainViewerLayerToggle.checked = radarEnabled;
        if (!radarEnabled) {
            radarErrorMessage = "";
            if (radarTimer) {
                clearInterval(radarTimer);
                radarTimer = null;
                radarPlayButton.textContent = "Play";
            }
            radarFrameLayers.forEach((layer) => flightMap.removeLayer(layer));
            updateRadarControls();
            updateRadarStatus(forecastEnabled
                ? "RainViewer-Radar ausgeblendet · Open-Meteo aktiv."
                : "RainViewer-Radar ausgeblendet.");
            return;
        }
        if (radarFrames.length) {
            updateRadarControls();
            showRadarFrame(radarIndex);
        }
        else loadRadarFrames();
    }

    function setForecastEnabled(enabled) {
        forecastEnabled = Boolean(enabled);
        forecastLayerToggle.checked = forecastEnabled;
        if (!forecastEnabled) {
            weatherSampleRequestId += 1;
            if (weatherSampleLayer) weatherSampleLayer.clearLayers();
            clearWeatherRaster();
            updateRadarStatus(radarEnabled
                ? "Open-Meteo-Vorhersage ausgeblendet · RainViewer-Echtwetter aktiv."
                : "Open-Meteo-Vorhersage ausgeblendet.");
            return;
        }
        setWeatherLayer();
    }

    function setRouteEnabled(enabled) {
        routeEnabled = Boolean(enabled);
        routeLayerToggle.checked = routeEnabled;
        if (!flightMap || !routeLayer) return;
        if (routeEnabled) routeLayer.addTo(flightMap);
        else flightMap.removeLayer(routeLayer);
    }

    function setWeatherLayer() {
        weatherSampleRequestId += 1;
        clearWeatherRaster();
        flightMapElement.classList.remove("hidden");
        if (!flightMap) return;
        window.setTimeout(() => flightMap.invalidateSize(), 0);

        if (weatherSampleLayer) weatherSampleLayer.clearLayers();
        if (forecastEnabled) loadWeatherSamples();
    }

    function queueWeatherSampleLoad() {
        if (!forecastEnabled) return;
        window.clearTimeout(weatherSampleTimer);
        weatherSampleTimer = window.setTimeout(loadWeatherSamples, 1500);
    }

    async function loadWeatherSamples(forceRefresh) {
        if (!flightMap || !forecastEnabled || !weatherSampleLayer) return;
        if (weatherSampleLoading) {
            weatherSamplePendingRefresh = true;
            return;
        }
        if (flightMap.getZoom() < 4) {
            weatherSampleLayer.clearLayers();
            clearWeatherRaster();
            updateRadarStatus("Für die Modell-Wetterkarte bitte näher heranzoomen.");
            return;
        }

        const requestId = ++weatherSampleRequestId;
        const bounds = flightMap.getBounds();
        const south = Math.max(-75, bounds.getSouth());
        const north = Math.min(75, bounds.getNorth());
        const west = Math.max(-180, bounds.getWest());
        const east = Math.min(180, bounds.getEast());
        const rows = 9;
        const columns = 9;
        const latitudeStep = (north - south) / rows;
        const longitudeStep = (east - west) / columns;
        const points = [];
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const cellSouth = south + latitudeStep * row;
                const cellWest = west + longitudeStep * column;
                points.push({
                    lat: cellSouth + latitudeStep / 2,
                    lon: cellWest + longitudeStep / 2,
                    cellBounds: [
                        [cellSouth, cellWest],
                        [cellSouth + latitudeStep, cellWest + longitudeStep]
                    ]
                });
            }
        }

        radarStatus.textContent = "Wettermodell wird geladen …";
        try {
            const params = new URLSearchParams({
                latitude: points.map((point) => point.lat.toFixed(3)).join(","),
                longitude: points.map((point) => point.lon.toFixed(3)).join(","),
                current: "precipitation,precipitation_probability",
                timezone: "UTC"
            });
            const forecastUrl = "https://api.open-meteo.com/v1/forecast?" + params.toString();
            const cachedForecast = weatherForecastCache.get(forecastUrl);
            let data;
            if (!forceRefresh && cachedForecast && Date.now() - cachedForecast.savedAt < 10 * 60 * 1000) {
                data = cachedForecast.data;
            } else {
                const cooldownRemaining = 10000 - (Date.now() - weatherLastRequestAt);
                if (!forceRefresh && cooldownRemaining > 0) {
                    radarStatus.textContent = "Wettermodell wartet auf das Abruflimit · letzte Anzeige bleibt sichtbar.";
                    weatherSampleTimer = window.setTimeout(
                        () => loadWeatherSamples(false),
                        cooldownRemaining
                    );
                    return;
                }
                weatherSampleLoading = true;
                weatherLastRequestAt = Date.now();
                data = await fetchJsonWithRetry(forecastUrl, 1);
                weatherForecastCache.set(forecastUrl, { data, savedAt: Date.now() });
                if (weatherForecastCache.size > 20) {
                    weatherForecastCache.delete(weatherForecastCache.keys().next().value);
                }
            }
            if (requestId !== weatherSampleRequestId) return;
            const locations = Array.isArray(data) ? data : [data];
            weatherSampleLayer.clearLayers();
            let renderedCount = 0;
            const precipitationSamples = [];
            locations.forEach((location, index) => {
                const weather = location.current;
                if (weather) {
                    renderedCount += addWeatherSample(points[index], weather);
                    precipitationSamples.push({
                        lat: points[index].lat,
                        lon: points[index].lon,
                        precipitation: Number(weather.precipitation),
                        probability: Number(weather.precipitation_probability)
                    });
                }
            });
            drawWeatherRaster(precipitationSamples, rows, columns);
            const sourceName = "Open-Meteo aktuell";
            const resultSummary = renderedCount
                ? renderedCount + " Niederschlagsflächen"
                : "im sichtbaren Ausschnitt kein signifikanter Niederschlag";
            updateRadarStatus(sourceName + " · " +
                resultSummary +
                " · Stand " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
        } catch (error) {
            if (requestId === weatherSampleRequestId) {
                console.error("Wettermodell konnte nicht geladen werden.", error);
                updateRadarStatus("Open-Meteo nicht erreichbar; letzte Wetteranzeige bleibt sichtbar.");
            }
        } finally {
            weatherSampleLoading = false;
            if (weatherSamplePendingRefresh) {
                weatherSamplePendingRefresh = false;
                queueWeatherSampleLoad();
            }
        }
    }

    function addWeatherSample(point, weather) {
        const precipitation = Number(weather.precipitation);
        return Number.isFinite(precipitation) && precipitation >= 0.125 ? 1 : 0;
    }

    function clearWeatherRaster() {
        if (!weatherRasterCanvas) return;
        const context = weatherRasterCanvas.getContext("2d");
        context.clearRect(0, 0, weatherRasterCanvas.width, weatherRasterCanvas.height);
    }

    function drawWeatherRaster(samples, rows, columns) {
        if (!flightMap || !weatherRasterCanvas || samples.length !== rows * columns) return;

        const mapSize = flightMap.getSize();
        const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.round(mapSize.x * pixelRatio));
        const height = Math.max(1, Math.round(mapSize.y * pixelRatio));
        if (weatherRasterCanvas.width !== width || weatherRasterCanvas.height !== height) {
            weatherRasterCanvas.width = width;
            weatherRasterCanvas.height = height;
            weatherRasterCanvas.style.width = mapSize.x + "px";
            weatherRasterCanvas.style.height = mapSize.y + "px";
        }
        const mapOrigin = flightMap.containerPointToLayerPoint([0, 0]);
        weatherRasterCanvas.style.left = mapOrigin.x + "px";
        weatherRasterCanvas.style.top = mapOrigin.y + "px";

        const positions = samples.map((sample) =>
            flightMap.latLngToContainerPoint([sample.lat, sample.lon]));
        const rowY = Array.from({ length: rows }, (_, row) => positions[row * columns].y);
        const columnX = Array.from({ length: columns }, (_, column) => positions[column].x);
        const amounts = samples.map((sample) =>
            Number.isFinite(sample.precipitation) ? Math.max(0, sample.precipitation) : 0);
        const probabilities = samples.map((sample) =>
            Number.isFinite(sample.probability) ? Math.max(0, Math.min(100, sample.probability)) / 100 : 0.65);
        const image = weatherRasterCanvas.getContext("2d").createImageData(width, height);
        const colors = [
            { value: 0.125, rgb: [65, 197, 242] },
            { value: 0.25, rgb: [0, 120, 210] },
            { value: 0.5, rgb: [255, 225, 0] },
            { value: 1.2, rgb: [255, 145, 0] },
            { value: 2.4, rgb: [239, 47, 35] },
            { value: 4.8, rgb: [245, 191, 215] }
        ];

        function gridPosition(values, target) {
            const descending = values[0] > values[values.length - 1];
            if (descending ? target >= values[0] : target <= values[0]) return [0, 0];
            const last = values.length - 1;
            if (descending ? target <= values[last] : target >= values[last]) return [last - 1, 1];
            let low = 0;
            let high = last;
            while (high - low > 1) {
                const middle = Math.floor((low + high) / 2);
                if (descending ? values[middle] >= target : values[middle] <= target) low = middle;
                else high = middle;
            }
            const span = values[low + 1] - values[low];
            return [low, span ? (target - values[low]) / span : 0];
        }

        function interpolateGrid(values, row, column, rowFraction, columnFraction) {
            const topLeft = values[row * columns + column];
            const topRight = values[row * columns + column + 1];
            const bottomLeft = values[(row + 1) * columns + column];
            const bottomRight = values[(row + 1) * columns + column + 1];
            const upper = topLeft + (topRight - topLeft) * columnFraction;
            const lower = bottomLeft + (bottomRight - bottomLeft) * columnFraction;
            return upper + (lower - upper) * rowFraction;
        }

        const rowLookup = Array.from({ length: height }, (_, y) =>
            gridPosition(rowY, (y + 0.5) / pixelRatio));
        const columnLookup = Array.from({ length: width }, (_, x) =>
            gridPosition(columnX, (x + 0.5) / pixelRatio));
        for (let y = 0; y < height; y += 1) {
            const [row, rowFraction] = rowLookup[y];
            for (let x = 0; x < width; x += 1) {
                const [column, columnFraction] = columnLookup[x];
                const amount = interpolateGrid(amounts, row, column, rowFraction, columnFraction);
                if (amount < 0.125) continue;
                const probability = interpolateGrid(probabilities, row, column, rowFraction, columnFraction);
                let stop = 1;
                while (stop < colors.length - 1 && amount > colors[stop].value) stop += 1;
                const lower = colors[stop - 1];
                const upper = colors[stop];
                const blend = Math.max(0, Math.min(1,
                    (amount - lower.value) / (upper.value - lower.value)));
                const pixel = (y * width + x) * 4;
                image.data[pixel] = Math.round(lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * blend);
                image.data[pixel + 1] = Math.round(lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * blend);
                image.data[pixel + 2] = Math.round(lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * blend);
                image.data[pixel + 3] = Math.round(
                    Math.max(0.18, Math.min(0.72, 0.18 + amount * 0.09)) *
                    (0.35 + probability * 0.65) * 255
                );
            }
        }
        const context = weatherRasterCanvas.getContext("2d");
        context.clearRect(0, 0, width, height);
        context.putImageData(image, 0, 0);
    }

    function toggleRadarPlay() {
        if (!radarEnabled || !radarFrames.length) return;
        if (radarTimer) {
            clearInterval(radarTimer);
            radarTimer = null;
            radarPlayButton.textContent = "Play";
            return;
        }
        radarPlayButton.textContent = "Pause";
        radarTimer = setInterval(() => showRadarFrame(radarIndex + 1), 2500);
    }

    function initFlightMap() {
        if (!window.L || flightMap) return;

        flightMap = L.map("flightMap", {
            zoomControl: true,
            maxZoom: 13,
            minZoom: 2,
            worldCopyJump: true
        }).setView([51.2, 10.4], 5);

        createBaseTileLayer().addTo(flightMap);
        weatherRasterCanvas = document.createElement("canvas");
        weatherRasterCanvas.className = "weather-raster-overlay";
        weatherRasterCanvas.setAttribute("aria-hidden", "true");
        flightMap.getPanes().mapPane.appendChild(weatherRasterCanvas);
        flightMap.createPane("flightRoutePane");
        flightMap.getPane("flightRoutePane").style.zIndex = "480";
        forecastEnabled = forecastLayerToggle.checked;
        radarEnabled = rainViewerLayerToggle.checked;
        routeEnabled = routeLayerToggle.checked;
        routeLayer = L.layerGroup();
        if (routeEnabled) routeLayer.addTo(flightMap);
        fmcRouteLayer = L.layerGroup().addTo(flightMap);
        flightTrackLayer = L.layerGroup().addTo(flightMap);
        weatherSampleLayer = L.layerGroup().addTo(flightMap);
        flightMap.on("moveend", queueWeatherSampleLoad);
        setWeatherLayer();
        if (radarEnabled) loadRadarFrames();
        renderFmcRoute();
        renderFlightTrack();
        renderAircraftPosition();
    }

    async function handleFlightPlan(file) {
        if (!file) return;
        initFlightMap();
        routeStatus.textContent = "Flugplan wird gelesen...";
        try {
            const text = await file.text();
            const points = parseFlightPlan(text, file.name);
            if (points.length < 2) {
                routeStatus.textContent = "Keine Route erkannt. Unterstützt: GPX, PLN, FMS, CSV/TXT mit Lat/Lon.";
                return;
            }
            routePoints = points;
            renderRoute(points, file.name);
        } catch (error) {
            routeStatus.textContent = error.message || "Flugplan konnte nicht gelesen werden.";
        }
    }

    async function loadSimBriefFlightPlan() {
        const username = simbriefUsername.value.trim();
        if (!username) {
            routeStatus.textContent = "Bitte SimBrief-Nutzername oder User-ID eingeben.";
            simbriefUsername.focus();
            return;
        }

        routeStatus.textContent = "SimBrief-Flugplan wird geladen...";
        const loadButton = document.getElementById("simbriefLoadButton");
        loadButton.disabled = true;

        try {
            const url = new URL("https://www.simbrief.com/api/xml.fetcher.php");
            url.searchParams.set("username", username);
            url.searchParams.set("json", "1");
            const cacheKey = url.toString();
            let data;
            const cached = simbriefRouteCache.get(username.toLowerCase());
            if (cached && Date.now() - cached.savedAt < 5 * 60 * 1000) {
                data = cached.data;
            } else {
                data = await fetchJsonWithRetry(cacheKey, 3);
                simbriefRouteCache.set(username.toLowerCase(), { data, savedAt: Date.now() });
            }
            const points = parseJsonRoute(JSON.stringify(data)).filter((point) =>
                Number.isFinite(point.lat) &&
                Number.isFinite(point.lon) &&
                Math.abs(point.lat) <= 90 &&
                Math.abs(point.lon) <= 180
            );
            if (points.length < 2) {
                const apiMessage = data && data.fetch && data.fetch.status
                    ? "SimBrief-Status: " + data.fetch.status + "."
                    : "Für diesen Nutzer wurde kein gültiger Flugplan mit Koordinaten gefunden.";
                throw new Error(apiMessage);
            }

            initFlightMap();
            routePoints = points;
            const flightNumber = data.params && data.params.callsign;
            const routeName = flightNumber ? "SimBrief " + flightNumber : "SimBrief";
            renderRoute(points, routeName);
        } catch (error) {
            routeStatus.textContent = error instanceof TypeError || error.name === "AbortError"
                ? "SimBrief nicht erreichbar (Netzwerk/CORS). Bitte Verbindung prüfen oder .fms-Datei laden."
                : (error.message || "SimBrief-Flugplan konnte nicht geladen werden.");
        } finally {
            loadButton.disabled = false;
        }
    }

    function parseFlightPlan(text, fileName) {
        const name = (fileName || "").toLowerCase();
        if (name.endsWith(".json") || /^\s*\{/.test(text)) {
            const fromJson = parseJsonRoute(text);
            if (fromJson.length >= 2) return fromJson;
        }
        if (name.endsWith(".gpx") || name.endsWith(".pln") || name.endsWith(".xml") || /^\s*</.test(text)) {
            const fromXml = parseXmlRoute(text);
            if (fromXml.length >= 2) return fromXml;
        }
        if (name.endsWith(".fms")) {
            const fromFms = parseFmsRoute(text);
            if (fromFms.length >= 2) return fromFms;
        }
        return parseTextRoute(text);
    }

    function parseJsonRoute(text) {
        try {
            const data = JSON.parse(text);
            const points = [];
            const origin = data.origin || data.departure || {};
            const destination = data.destination || data.arrival || {};
            if (origin.pos_lat !== undefined) {
                points.push({
                    name: origin.icao_code || origin.icao || data.params && data.params.orig_icao || "DEP",
                    lat: parseCoordinate(origin.pos_lat),
                    lon: parseCoordinate(origin.pos_long !== undefined ? origin.pos_long : origin.pos_lon)
                });
            }
            if (data.navlog && Array.isArray(data.navlog.fix)) {
                data.navlog.fix.forEach((fix) => {
                    const lat = parseCoordinate(fix.pos_lat);
                    const lon = parseCoordinate(fix.pos_long);
                    if (Number.isFinite(lat) && Number.isFinite(lon)) {
                        points.push({ name: fix.ident || "WP", lat, lon });
                    }
                });
            }
            if (destination.pos_lat !== undefined) {
                points.push({
                    name: destination.icao_code || destination.icao || data.params && data.params.dest_icao || "DEST",
                    lat: parseCoordinate(destination.pos_lat),
                    lon: parseCoordinate(destination.pos_long !== undefined ? destination.pos_long : destination.pos_lon)
                });
            }
            if (Array.isArray(data.waypoints)) {
                data.waypoints.forEach((wp) => {
                    const lat = parseCoordinate(wp.lat !== undefined ? wp.lat : wp.latitude);
                    const lon = parseCoordinate(wp.lon !== undefined ? wp.lon : wp.lng !== undefined ? wp.lng : wp.longitude);
                    if (Number.isFinite(lat) && Number.isFinite(lon)) {
                        points.push({ name: wp.name || wp.ident || "WP", lat, lon });
                    }
                });
            }
            return uniquePoints(points);
        } catch (e) {
            return [];
        }
    }

    function parseXmlRoute(text) {
        const xml = new DOMParser().parseFromString(text, "application/xml");
        if (xml.querySelector("parsererror")) return [];

        const directPoints = Array.from(xml.querySelectorAll("trkpt, rtept, wpt"))
            .map((node, index) => pointFromLatLon(
                node.getAttribute("lat"),
                node.getAttribute("lon"),
                getXmlName(node) || "WP" + (index + 1)
            ))
            .filter(Boolean);
        if (directPoints.length >= 2) return directPoints;

        const waypoints = Array.from(xml.querySelectorAll("ATCWaypoint, Waypoint, waypoint"));
        const points = [];
        waypoints.forEach((node, index) => {
            const id = node.getAttribute("id") || getXmlName(node) || "WP" + (index + 1);
            const worldPosition = childText(node, "WorldPosition") || childText(node, "worldPosition");
            if (worldPosition) {
                const parsed = parseWorldPosition(worldPosition, id);
                if (parsed) points.push(parsed);
            }
            const lat = childText(node, "Latitude") || childText(node, "lat");
            const lon = childText(node, "Longitude") || childText(node, "lon");
            const decimal = pointFromLatLon(lat, lon, id);
            if (decimal) points.push(decimal);
        });
        return uniquePoints(points);
    }

    function getXmlName(node) {
        return childText(node, "name") || childText(node, "Name") || childText(node, "ICAOIdent");
    }

    function childText(node, tagName) {
        const child = node.getElementsByTagName(tagName)[0];
        return child && child.textContent ? child.textContent.trim() : "";
    }

    function pointFromLatLon(latValue, lonValue, name) {
        const lat = parseFloat(String(latValue).replace(",", "."));
        const lon = parseFloat(String(lonValue).replace(",", "."));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
        return { name, lat, lon };
    }

    function parseWorldPosition(value, name) {
        const parts = value.split(",");
        if (parts.length < 2) return null;
        const lat = parseCoordinate(parts[0]);
        const lon = parseCoordinate(parts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { name, lat, lon };
    }

    function parseCoordinate(value) {
        const trimmed = String(value).trim();
        const hemi = trimmed.match(/[NSEW]/i);
        const sign = hemi
            ? /[SW]/i.test(hemi[0]) ? -1 : 1
            : trimmed.startsWith("-") ? -1 : 1;
        const nums = trimmed.match(/-?\d+(?:\.\d+)?/g);
        if (!nums || nums.length === 0) return NaN;
        if (nums.length === 1) {
            const valueNumber = parseFloat(nums[0]);
            return hemi ? sign * Math.abs(valueNumber) : valueNumber;
        }
        const deg = Math.abs(parseFloat(nums[0]));
        const min = parseFloat(nums[1] || "0");
        const sec = parseFloat(nums[2] || "0");
        return sign * (deg + min / 60 + sec / 3600);
    }

    function parseFmsRoute(text) {
        const points = [];
        text.split(/\r?\n/).forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("I") || trimmed.startsWith("A")) return;
            const parts = trimmed.split(/\s+/);
            const numbers = parts.map((part) => Number(part)).filter(Number.isFinite);
            if (numbers.length < 2) return;
            const lat = numbers[numbers.length - 2];
            const lon = numbers[numbers.length - 1];
            if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                const ident = parts.slice(1).reverse().find((part) =>
                    /^[A-Z0-9]{2,8}$/i.test(part) && /[A-Z]/i.test(part)
                ) || "WP" + (index + 1);
                points.push({ name: ident, lat, lon });
            }
        });
        return uniquePoints(points);
    }

    function parseTextRoute(text) {
        const points = [];
        text.split(/\r?\n/).forEach((line, index) => {
            const cleaned = line.trim();
            if (!cleaned || cleaned.startsWith("#")) return;
            const parts = cleaned.split(/[,\t; ]+/).filter(Boolean);
            for (let i = 0; i < parts.length - 1; i += 1) {
                const lat = Number(parts[i]);
                const lon = Number(parts[i + 1]);
                if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    const name = parts.find((part) => /[A-Za-z]/.test(part)) || "WP" + (index + 1);
                    points.push({ name, lat, lon });
                    return;
                }
            }
        });
        return uniquePoints(points);
    }

    function uniquePoints(points) {
        const seen = new Set();
        return points.filter((point) => {
            const key = point.lat.toFixed(5) + ":" + point.lon.toFixed(5) + ":" + point.name;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function distanceNM(lat1, lon1, lat2, lon2) {
        const R = 3440.065;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function calculateTotalDistance(points) {
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            total += distanceNM(points[i].lat, points[i].lon, points[i + 1].lat, points[i + 1].lon);
        }
        return Math.round(total);
    }

    const demoFlightPlan = [
        { name: "EDDV (Hannover)", lat: 52.4602, lon: 9.6835 },
        { name: "AMOSA", lat: 52.0125, lon: 9.8764 },
        { name: "WRB", lat: 50.4988, lon: 8.5303 },
        { name: "KRH", lat: 49.0069, lon: 8.4489 },
        { name: "LUL", lat: 47.7478, lon: 7.5028 },
        { name: "MOBLO", lat: 46.1264, lon: 6.0986 },
        { name: "MTL", lat: 44.5756, lon: 4.7439 },
        { name: "PPG", lat: 42.6936, lon: 2.8719 },
        { name: "MEROS", lat: 40.8522, lon: 3.1205 },
        { name: "LEPA (Palma)", lat: 39.5517, lon: 2.7388 }
    ];

    function renderRoute(points, fileName) {
        if (!flightMap || !routeLayer) return;
        routeLayer.clearLayers();

        const latLngs = points.map((point) => [point.lat, point.lon]);
        routePolyline = L.polyline(latLngs, {
            color: "#00a0e2",
            weight: 4,
            opacity: 0.95,
            pane: "flightRoutePane"
        });
        routeLayer.addLayer(routePolyline);

        points.forEach((point, index) => {
            const isDeparture = index === 0;
            const isArrival = index === points.length - 1;
            const isEndpoint = isDeparture || isArrival;
            const label = isEndpoint ? routeAirportLabel(point.name) : "";
            const icon = L.divIcon({
                className: isEndpoint ? "route-endpoint-marker" : "route-waypoint-marker",
                html: isEndpoint
                    ? '<span class="route-endpoint-dot ' + (isDeparture ? "is-departure" : "is-arrival") + '"></span><strong>' + escapeHtml(label) + "</strong>"
                    : '<span class="route-waypoint-square"></span>',
                iconSize: isEndpoint ? [110, 30] : [12, 12],
                iconAnchor: isEndpoint ? (isDeparture ? [0, 15] : [110, 15]) : [6, 6]
            });
            const marker = L.marker([point.lat, point.lon], { icon })
                .bindPopup("<strong>" + escapeHtml(point.name) + "</strong><br>" + point.lat.toFixed(5) + ", " + point.lon.toFixed(5));
            routeLayer.addLayer(marker);
        });

        fitRoute();
        const dist = calculateTotalDistance(points);
        routeStatus.textContent = fileName + " · " + points.length + " WPs · " + dist + " NM";
        routeList.innerHTML = points.map((point, index) => `
            <div class="route-item">${index + 1}. ${escapeHtml(point.name)}
                <span>${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}</span>
            </div>
        `).join("");
        loadRouteAirportWeather(points);
    }

    function routeAirportLabel(name) {
        const code = String(name || "").trim().match(/^[A-Z0-9]{4}/i);
        return code ? code[0].toUpperCase() : String(name || "AIRPORT").slice(0, 8).toUpperCase();
    }

    async function loadRouteAirportWeather(points) {
        const requestId = ++routeWeatherRequestId;
        const codes = [...new Set([points[0], points[points.length - 1]]
            .map((point) => routeAirportLabel(point.name))
            .filter((code) => /^[A-Z]{4}$/.test(code)))];
        if (!codes.length) {
            routeAirportWeather.innerHTML = "<p>METAR/TAF-Karten verfügbar, wenn Start- und Zielflugplatz im Flugplan als ICAO-Code angegeben sind.</p>";
            return;
        }

        routeAirportWeather.innerHTML = "<p>METAR/TAF für " + codes.map(escapeHtml).join(", ") + " werden geladen...</p>";
        const results = await Promise.all(["metar", "taf"].map(async (product) => {
            const url = new URL("https://aviationweather.gov/api/data/" + product);
            url.searchParams.set("ids", codes.join(","));
            url.searchParams.set("format", "json");
            const cacheKey = url.toString();
            const cached = routeWeatherCache.get(cacheKey);
            if (cached && Date.now() - cached.savedAt < 5 * 60 * 1000) {
                return { product, data: Array.isArray(cached.data) ? cached.data : [], error: null };
            }
            try {
                const data = await fetchJsonWithRetry(cacheKey, 3);
                const reports = Array.isArray(data) ? data : [];
                routeWeatherCache.set(cacheKey, { data: reports, savedAt: Date.now() });
                if (routeWeatherCache.size > 20) {
                    routeWeatherCache.delete(routeWeatherCache.keys().next().value);
                }
                return { product, data: reports, error: null };
            } catch (error) {
                return { product, data: [], error };
            }
        }));

        const metarResult = results.find((result) => result.product === "metar");
        const tafResult = results.find((result) => result.product === "taf");
        if (requestId !== routeWeatherRequestId) return;
        const cards = codes.map((code) => {
            const metar = metarResult.data.find((item) =>
                String(item.icaoId || item.stationId || "").toUpperCase() === code
            );
            const taf = tafResult.data.find((item) =>
                String(item.icaoId || item.stationId || "").toUpperCase() === code
            );
            const metarDetails = metar ? [
                metar.wdir !== undefined && metar.wspd !== undefined
                    ? "Wind " + (Number.isFinite(Number(metar.wdir)) ? metar.wdir + "°" : metar.wdir) + " / " + metar.wspd + " kt"
                    : "",
                metar.visib !== undefined ? "Sicht " + metar.visib + " mi" : "",
                metar.temp !== undefined ? "Temperatur " + metar.temp + " °C" : "",
                metar.altim !== undefined ? "QNH " + metar.altim + " hPa" : "",
                Array.isArray(metar.clouds) && metar.clouds.length
                    ? "Wolken " + metar.clouds.map((cloud) =>
                        [cloud.cover, cloud.base !== undefined ? cloud.base + " ft" : ""].filter(Boolean).join(" ")
                    ).join(", ")
                    : ""
            ].filter(Boolean) : [];
            return `
                <section class="route-weather-card">
                    <h3>${escapeHtml(code)}</h3>
                    <strong>METAR</strong>
                    <p>${escapeHtml(metar && metar.rawOb || (metarResult.error ? "METAR momentan nicht erreichbar." : "Kein aktueller METAR gefunden."))}</p>
                    ${metarDetails.length ? `<p>${escapeHtml(metarDetails.join(" · "))}</p>` : ""}
                    <strong>TAF</strong>
                    <p>${escapeHtml(taf && taf.rawTAF || (tafResult.error ? "TAF momentan nicht erreichbar." : "Kein aktueller TAF gefunden."))}</p>
                </section>
            `;
        });
        routeAirportWeather.innerHTML = cards.join("");
    }

    function fitRoute() {
        if (!flightMap || routePoints.length === 0) return;
        const bounds = L.latLngBounds(routePoints.map((point) => [point.lat, point.lon]));
        flightMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
    }

    function setXPlaneStatus(message, state) {
        if (!xplaneTelemetryStatus || !xplaneStatusRow) return;
        xplaneTelemetryStatus.textContent = message;
        xplaneStatusRow.classList.toggle("is-connected", state === "connected");
        xplaneStatusRow.classList.toggle("is-error", state === "error");
    }

    function makeAircraftIcon(heading) {
        return L.divIcon({
            className: "aircraft-marker-shell",
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            html: `<div class="aircraft-marker-arrow"><svg viewBox="0 0 36 36" aria-hidden="true"><path transform="rotate(${heading} 18 18)" d="M18 1 22 13 33 20 33 24 21 21 22 33 18 31 14 33 15 21 3 24 3 20 14 13Z"/></svg></div>`
        });
    }

    function renderAircraftPosition() {
        if (!flightMap || !aircraftPosition || !window.L) return;
        const position = aircraftPosition;
        const latLng = [position.lat, position.lon];
        const telemetry = [
            Number.isFinite(position.altitudeMeters) ? position.altitudeMeters.toFixed(0) + " m" : "",
            Number.isFinite(position.groundspeedKnots) ? position.groundspeedKnots.toFixed(0) + " kt" : ""
        ].filter(Boolean).join(" · ");
        const popup = `<strong>X-Plane-Flugzeug</strong><br>${telemetry ? telemetry + "<br>" : ""}Kurs ${position.heading.toFixed(0)}°`;

        if (!aircraftMarker) {
            aircraftMarker = L.marker(latLng, {
                icon: makeAircraftIcon(position.heading),
                keyboard: false,
                zIndexOffset: 1000
            }).addTo(flightMap);
            aircraftMarker.bindPopup(popup);
        } else {
            aircraftMarker.setLatLng(latLng);
            aircraftMarker.setPopupContent(popup);
            const aircraftPath = aircraftMarker.getElement()?.querySelector(".aircraft-marker-arrow path");
            if (aircraftPath) aircraftPath.setAttribute("transform", `rotate(${position.heading} 18 18)`);
        }
    }

    function setFmcRouteStatus(message, state) {
        if (!xplaneFmsStatus || !xplaneFmsStatusRow) return;
        xplaneFmsStatus.textContent = message;
        xplaneFmsStatusRow.classList.toggle("is-connected", state === "connected");
        xplaneFmsStatusRow.classList.toggle("is-error", state === "error");
    }

    function receiveXPlaneFmsRoute(payload) {
        try {
            const data = JSON.parse(payload);
            if (!data || data.type !== "b737route" || !Array.isArray(data.points)) {
                throw new Error("Ungültige FMC-Routendaten");
            }
            fmcRoutePoints = data.points.slice(0, 512).filter((point) =>
                point &&
                typeof point.name === "string" &&
                Number.isFinite(point.lat) &&
                Number.isFinite(point.lon) &&
                Math.abs(point.lat) <= 90 &&
                Math.abs(point.lon) <= 180
            );
            fmcRouteLastUpdate = Date.now();
            if (fmcRoutePoints.length >= 2) {
                setFmcRouteStatus(
                    `FMC-Route empfangen · ${fmcRoutePoints.length} Punkte (SID/STAR, sofern im FMC-Flugplan enthalten)`,
                    "connected"
                );
            } else {
                setFmcRouteStatus("Im aktiven FMC-Flugplan sind noch keine Routenpunkte.", "error");
            }
            renderFmcRoute();
        } catch (error) {
            console.error("X-Plane FMC route could not be read:", error);
            setFmcRouteStatus("FMC-Flugplan konnte nicht gelesen werden.", "error");
        }
    }

    function renderFmcRoute() {
        if (!flightMap || !fmcRouteLayer || !window.L) return;
        fmcRouteLayer.clearLayers();
        fmcRoutePolyline = null;
        if (fmcRoutePoints.length < 2) return;

        const latLngs = fmcRoutePoints.map((point) => [point.lat, point.lon]);
        fmcRoutePolyline = L.polyline(latLngs, {
            color: "#d985ff",
            weight: 3,
            opacity: 0.9,
            dashArray: "8 6"
        }).addTo(fmcRouteLayer);

        fmcRoutePoints.forEach((point) => {
            const marker = L.circleMarker([point.lat, point.lon], {
                radius: 4,
                color: "#f0c4ff",
                weight: 1.5,
                fillColor: "#a943d4",
                fillOpacity: 0.95
            }).bindPopup(
                "<strong>" + escapeHtml(point.name || "FMC-Wegpunkt") + "</strong><br>"
                + point.lat.toFixed(5) + ", " + point.lon.toFixed(5)
            );
            fmcRouteLayer.addLayer(marker);
        });
    }

    function centerFmcRoute() {
        if (!flightMap || fmcRoutePoints.length < 2) {
            setFmcRouteStatus("Keine FMC-Route zum Zentrieren empfangen.", "error");
            return;
        }
        const bounds = L.latLngBounds(fmcRoutePoints.map((point) => [point.lat, point.lon]));
        flightMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
    }

    function countFlightTrackPoints() {
        return flightTrackSegments.reduce((total, segment) => total + segment.points.length, 0);
    }

    function loadFlightTrack() {
        try {
            const savedTrack = localStorage.getItem(xplaneTrackStorageKey);
            if (!savedTrack) return;
            const parsed = JSON.parse(savedTrack);
            if (!Array.isArray(parsed)) throw new Error("Gespeicherte Flugspur hat ein falsches Format.");

            let remaining = 12000;
            flightTrackSegments = [];
            parsed.slice(-12000).reverse().forEach((segment) => {
                if (remaining <= 0) return;
                const points = segment && Array.isArray(segment.points)
                    ? segment.points.filter((point) =>
                        point &&
                        Number.isFinite(point.lat) &&
                        Number.isFinite(point.lon) &&
                        Number.isFinite(point.time) &&
                        Math.abs(point.lat) <= 90 &&
                        Math.abs(point.lon) <= 180
                    ).slice(-remaining)
                    : [];
                remaining -= points.length;
                if (points.length > 0) flightTrackSegments.unshift({ points });
            });
            flightTrackPointCount = countFlightTrackPoints();
        } catch (error) {
            console.error("Saved X-Plane flight track could not be loaded:", error);
            setFlightTrackStatus("Gespeicherte Flugspur konnte nicht geladen werden.", "error");
            flightTrackSegments = [];
            flightTrackPointCount = 0;
        }
    }

    function saveFlightTrack() {
        if (flightTrackPointCount === 0) return;
        try {
            localStorage.setItem(xplaneTrackStorageKey, JSON.stringify(flightTrackSegments));
            lastFlightTrackSave = Date.now();
        } catch (error) {
            console.error("X-Plane flight track could not be saved:", error);
            setFlightTrackStatus("Flugspur kann nicht lokal gespeichert werden.", "error");
        }
    }

    function setFlightTrackStatus(message, state) {
        if (!xplaneTrackStatus || !xplaneTrackStatusRow) return;
        xplaneTrackStatus.textContent = message;
        xplaneTrackStatusRow.classList.toggle("is-connected", state === "connected");
        xplaneTrackStatusRow.classList.toggle("is-error", state === "error");
    }

    function updateFlightTrackStatus() {
        if (flightTrackPointCount === 0) {
            setFlightTrackStatus("Noch keine Flugspur aufgezeichnet", "");
            return;
        }
        let distance = 0;
        flightTrackSegments.forEach((segment) => {
            for (let index = 0; index < segment.points.length - 1; index++) {
                distance += distanceNM(
                    segment.points[index].lat,
                    segment.points[index].lon,
                    segment.points[index + 1].lat,
                    segment.points[index + 1].lon
                );
            }
        });
        setFlightTrackStatus(
            `Flugspur gespeichert · ${flightTrackPointCount} Punkte · ${distance.toFixed(1)} NM`,
            "connected"
        );
    }

    function renderFlightTrack() {
        if (!flightMap || !flightTrackLayer || !window.L) return;
        flightTrackLayer.clearLayers();
        flightTrackSegments.forEach((segment) => {
            if (segment.points.length < 2) return;
            L.polyline(segment.points.map((point) => [point.lat, point.lon]), {
                color: "#ffd84d",
                weight: 3,
                opacity: 0.9
            }).addTo(flightTrackLayer);
        });
    }

    function recordFlightTrack(position) {
        const now = Date.now();
        let segment = flightTrackSegments[flightTrackSegments.length - 1];
        const previous = segment && segment.points[segment.points.length - 1];
        const elapsed = previous ? now - previous.time : 0;
        const distance = previous
            ? distanceNM(previous.lat, previous.lon, position.lat, position.lon)
            : 0;

        if (!segment || elapsed > 10 * 60 * 1000 || distance > 25) {
            segment = { points: [] };
            flightTrackSegments.push(segment);
        } else if (distance < 0.05 && elapsed < 3000) {
            return;
        }

        segment.points.push({ lat: position.lat, lon: position.lon, time: now });
        flightTrackPointCount = countFlightTrackPoints();
        while (flightTrackPointCount > 12000) {
            const oldest = flightTrackSegments[0];
            oldest.points.shift();
            if (oldest.points.length === 0) flightTrackSegments.shift();
            flightTrackPointCount--;
        }

        renderFlightTrack();
        updateFlightTrackStatus();
        if (now - lastFlightTrackSave >= 15000) saveFlightTrack();
    }

    function clearFlightTrack() {
        flightTrackSegments = [];
        flightTrackPointCount = 0;
        if (flightTrackLayer) flightTrackLayer.clearLayers();
        try {
            localStorage.removeItem(xplaneTrackStorageKey);
            lastFlightTrackSave = 0;
            updateFlightTrackStatus();
        } catch (error) {
            console.error("Saved X-Plane flight track could not be cleared:", error);
            setFlightTrackStatus("Flugspur konnte nicht aus dem lokalen Speicher gelöscht werden.", "error");
        }
    }

    function centerAircraft() {
        if (!aircraftPosition) {
            setXPlaneStatus("Noch keine X-Plane-Position empfangen.", "error");
            return;
        }
        initFlightMap();
        if (flightMap) {
            flightMap.setView([aircraftPosition.lat, aircraftPosition.lon], Math.max(flightMap.getZoom(), 7));
            renderAircraftPosition();
        }
    }

    function updateAircraftPosition(latitude, longitude, altitudeMeters, headingDegrees, groundspeedKnots) {
        aircraftPosition = {
            lat: latitude,
            lon: longitude,
            altitudeMeters,
            heading: ((headingDegrees % 360) + 360) % 360,
            groundspeedKnots
        };
        aircraftLastUpdate = Date.now();
        recordFlightTrack(aircraftPosition);
        renderAircraftPosition();
        setXPlaneStatus(
            `X-Plane verbunden · ${latitude.toFixed(4)}, ${longitude.toFixed(4)} · ${aircraftPosition.heading.toFixed(0)}°`,
            "connected"
        );
    }

    function initializeXPlaneTelemetry() {
        if (!xplaneTelemetryStatus) return;
        if (!window.AndroidApp || typeof window.AndroidApp.getXPlaneLocalIpAddress !== "function") {
            setXPlaneStatus("Live-Position ist in der Android-App verfügbar.", "error");
            setFmcRouteStatus("FMC-Route ist in der Android-App verfügbar.", "error");
            return;
        }

        const ipAddress = window.AndroidApp.getXPlaneLocalIpAddress();
        if (!window.AndroidApp.isXPlaneReceiverRunning()) {
            const error = window.AndroidApp.getXPlaneReceiverError();
            setXPlaneStatus(
                "UDP-Empfang auf Port 49009 nicht verfügbar" + (error ? ` · ${error}` : ""),
                "error"
            );
            setFmcRouteStatus("UDP-Empfang für FMC-Route nicht verfügbar.", "error");
            return;
        }

        setXPlaneStatus(
            `Warte auf X-Plane · UDP 49009 · App-IP ${ipAddress} (diese IP im Plugin eintragen)`,
            ""
        );
        if (!aircraftStatusTimer) {
            aircraftStatusTimer = setInterval(() => {
                if (aircraftPosition && Date.now() - aircraftLastUpdate > 3000) {
                    setXPlaneStatus("Keine aktuellen X-Plane-Daten · UDP 49009", "error");
                }
                if (xplaneFmsStatus && fmcRouteLastUpdate > 0 && Date.now() - fmcRouteLastUpdate > 10000) {
                    setFmcRouteStatus("Keine aktuellen FMC-Routendaten empfangen.", "error");
                }
            }, 1000);
        }
    }

    function clearRoute() {
        routePoints = [];
        routeWeatherRequestId += 1;
        if (routeLayer) routeLayer.clearLayers();
        routePolyline = null;
        routeList.innerHTML = "";
        routeAirportWeather.replaceChildren();
        routeStatus.textContent = "Noch kein Flugplan geladen";
    }

    document.querySelectorAll(".view-tabs button").forEach((button) => {
        button.addEventListener("click", () => setView(button.dataset.view));
    });

    if (centerAircraftButton) centerAircraftButton.addEventListener("click", centerAircraft);
    if (centerFmcRouteButton) centerFmcRouteButton.addEventListener("click", centerFmcRoute);
    if (clearFlightTrackButton) clearFlightTrackButton.addEventListener("click", clearFlightTrack);
    document.getElementById("chartTopButton").addEventListener("click", openChartFox);
    document.getElementById("chartMainButton").addEventListener("click", openChartFox);

    if (chartFileInput) {
        chartFileInput.addEventListener("change", async () => {
            const files = Array.from(chartFileInput.files || []);
            chartFileInput.value = "";
            for (const file of files) {
                await handleChartFile(file);
            }
        });
    }
    chartDrawToggle.addEventListener("click", () => {
        chartDrawingEnabled = !chartDrawingEnabled;
        chartDrawToggle.setAttribute("aria-pressed", String(chartDrawingEnabled));
        chartDrawToggle.textContent = chartDrawingEnabled ? "Zeichnen beenden" : "Zeichnen";
        chartDrawingTools.classList.toggle("hidden", !chartDrawingEnabled);
        ensureChartAnnotationCanvas();
    });
    document.querySelectorAll(".chart-color-swatch").forEach((button) => {
        button.addEventListener("click", () => setChartDrawingColor(button.dataset.drawColor));
    });
    chartCustomColor.addEventListener("input", () => setChartDrawingColor(chartCustomColor.value));
    chartEraserToggle.addEventListener("click", () => {
        chartEraserEnabled = !chartEraserEnabled;
        chartEraserToggle.setAttribute("aria-pressed", String(chartEraserEnabled));
        if (chartEraserEnabled) {
            document.querySelectorAll(".chart-color-swatch").forEach((button) => {
                button.classList.remove("is-selected");
                button.setAttribute("aria-pressed", "false");
            });
        }
        ensureChartAnnotationCanvas();
    });
    chartViewer.addEventListener("scroll", () => {
        if (!chartAnnotationCanvas || chartAnnotationCanvas.parentElement !== chartViewer) return;
        chartAnnotationCanvas.style.top = chartViewer.scrollTop + "px";
        chartAnnotationCanvas.style.left = chartViewer.scrollLeft + "px";
        redrawChartAnnotations();
    });
    chartViewer.addEventListener("pointerdown", (event) => {
        if (chartDrawingEnabled || event.button !== 0) return;
        event.preventDefault();
        chartPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        chartViewer.setPointerCapture(event.pointerId);
        if (chartPointers.size >= 2) {
            const pointers = Array.from(chartPointers.values());
            chartPinchStart = {
                distance: Math.max(1, notesPointerDistance(pointers[0], pointers[1])),
                zoom: currentChartZoom(),
                nextZoom: currentChartZoom(),
                focalX: (pointers[0].x + pointers[1].x) / 2,
                focalY: (pointers[0].y + pointers[1].y) / 2
            };
            chartPanStart = null;
            return;
        }
        chartPanStart = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            scrollLeft: chartViewer.scrollLeft,
            scrollTop: chartViewer.scrollTop
        };
    });
    chartViewer.addEventListener("pointermove", (event) => {
        if (chartDrawingEnabled || !chartPointers.has(event.pointerId)) return;
        chartPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (chartPinchStart && chartPointers.size >= 2) {
            const pointers = Array.from(chartPointers.values());
            const midpointX = (pointers[0].x + pointers[1].x) / 2;
            const midpointY = (pointers[0].y + pointers[1].y) / 2;
            const distance = notesPointerDistance(pointers[0], pointers[1]);
            if (distance > 0) {
                chartPinchStart.nextZoom = chartPinchStart.zoom * distance / chartPinchStart.distance;
                chartPinchStart.focalX = midpointX;
                chartPinchStart.focalY = midpointY;
                scheduleChartZoom(
                    chartPinchStart.nextZoom,
                    midpointX,
                    midpointY
                );
            }
            return;
        }
        if (!chartPanStart) return;
        chartViewer.scrollLeft = chartPanStart.scrollLeft - (event.clientX - chartPanStart.pointerX);
        chartViewer.scrollTop = chartPanStart.scrollTop - (event.clientY - chartPanStart.pointerY);
    });
    const finishChartPointer = (event) => {
        if (!chartPointers.has(event.pointerId)) return;
        chartPointers.delete(event.pointerId);
        if (chartViewer.hasPointerCapture(event.pointerId)) {
            chartViewer.releasePointerCapture(event.pointerId);
        }
        if (chartPinchStart) {
            if (chartZoomTimer) {
                window.clearTimeout(chartZoomTimer);
                chartZoomTimer = null;
            }
            if (chartPinchStart.nextZoom !== chartPinchStart.zoom) {
                scheduleChartZoom(
                    chartPinchStart.nextZoom,
                    chartPinchStart.focalX,
                    chartPinchStart.focalY,
                    true
                );
            }
            const pointers = Array.from(chartPointers.values());
            if (pointers.length === 1) {
                const remainingPointer = pointers[0];
                chartPanStart = {
                    pointerX: remainingPointer.x,
                    pointerY: remainingPointer.y,
                    scrollLeft: chartViewer.scrollLeft,
                    scrollTop: chartViewer.scrollTop
                };
            } else {
                chartPanStart = null;
            }
            chartPinchStart = null;
            return;
        }
        chartPanStart = null;
    };
    chartViewer.addEventListener("pointerup", finishChartPointer);
    chartViewer.addEventListener("pointercancel", finishChartPointer);
    chartViewer.addEventListener("lostpointercapture", finishChartPointer);
    document.getElementById("notesDrawTool").addEventListener("click", () => {
        notesMode = notesMode === "draw" ? "pan" : "draw";
        updateNotesTools();
    });
    document.getElementById("notesTextTool").addEventListener("click", () => {
        notesMode = "text";
        updateNotesTools();
        notesTextInput.focus();
    });
    document.getElementById("notesEraseTool").addEventListener("click", () => {
        notesMode = "erase";
        updateNotesTools();
    });
    notesCanvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (notesMode === "pan") {
            const wrapper = notesCanvas.parentElement;
            notesPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            notesCanvas.setPointerCapture(event.pointerId);
            if (notesPointers.size === 2) {
                const pointers = Array.from(notesPointers.values());
                notesPinchStart = {
                    distance: Math.max(1, notesPointerDistance(pointers[0], pointers[1])),
                    zoom: notesZoom
                };
                notesPanStart = null;
                return;
            }
            notesPanStart = {
                pointerX: event.clientX,
                pointerY: event.clientY,
                scrollLeft: wrapper.scrollLeft,
                scrollTop: wrapper.scrollTop
            };
            return;
        }
        if (notesMode === "text") {
            const text = notesTextInput.value.trim();
            if (!text) {
                notesStatus.textContent = "Bitte zuerst Text eingeben.";
                notesTextInput.focus();
                return;
            }
            const point = notesPoint(event);
            notesElements.push({
                type: "text",
                text,
                color: notesColorInput.value,
                x: point.x,
                y: point.y
            });
            drawNotes();
            saveNotes();
            return;
        }
        notesActiveStroke = {
            type: "stroke",
            color: notesColorInput.value,
            erase: notesMode === "erase",
            points: [notesPoint(event)]
        };
        notesElements.push(notesActiveStroke);
        notesCanvas.setPointerCapture(event.pointerId);
        drawNotes();
    });
    notesCanvas.addEventListener("pointermove", (event) => {
        if (notesMode === "pan" && notesPointers.has(event.pointerId)) {
            notesPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (notesPinchStart && notesPointers.size >= 2) {
                const pointers = Array.from(notesPointers.values());
                const midpointX = (pointers[0].x + pointers[1].x) / 2;
                const midpointY = (pointers[0].y + pointers[1].y) / 2;
                const distance = notesPointerDistance(pointers[0], pointers[1]);
                if (distance === 0) return;
                zoomNotesAt(
                    notesPinchStart.zoom * distance / notesPinchStart.distance,
                    midpointX,
                    midpointY
                );
                return;
            }
        }
        if (notesPanStart && notesCanvas.hasPointerCapture(event.pointerId)) {
            const wrapper = notesCanvas.parentElement;
            wrapper.scrollLeft = notesPanStart.scrollLeft - (event.clientX - notesPanStart.pointerX);
            wrapper.scrollTop = notesPanStart.scrollTop - (event.clientY - notesPanStart.pointerY);
            return;
        }
        if (!notesActiveStroke || !notesCanvas.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        notesActiveStroke.points.push(notesPoint(event));
        drawNotes();
    });
    notesCanvas.addEventListener("pointerup", (event) => {
        notesPointers.delete(event.pointerId);
        if (notesCanvas.hasPointerCapture(event.pointerId)) {
            notesCanvas.releasePointerCapture(event.pointerId);
        }
        if (notesPinchStart) {
            notesPinchStart = null;
            const remainingPointer = Array.from(notesPointers.values())[0];
            notesPanStart = remainingPointer ? {
                pointerX: remainingPointer.x,
                pointerY: remainingPointer.y,
                scrollLeft: notesCanvas.parentElement.scrollLeft,
                scrollTop: notesCanvas.parentElement.scrollTop
            } : null;
            return;
        }
        if (notesPanStart) {
            notesPanStart = null;
            return;
        }
        if (!notesActiveStroke) return;
        notesActiveStroke = null;
        saveNotes();
    });
    notesCanvas.addEventListener("pointercancel", () => {
        notesPointers.clear();
        notesPinchStart = null;
        if (notesPanStart) {
            notesPanStart = null;
            return;
        }
        if (!notesActiveStroke) return;
        notesActiveStroke = null;
        saveNotes();
    });
    document.getElementById("notesClearButton").addEventListener("click", () => {
        notesElements = [];
        notesActiveStroke = null;
        notesTextInput.value = "";
        drawNotes();
        saveNotes();
        notesStatus.textContent = "Alle Notizen gelöscht.";
    });
    document.getElementById("chartDrawClear").addEventListener("click", () => {
        chartAnnotationStrokes[chartPdfDoc ? String(chartPdfPage) : "image"] = [];
        redrawChartAnnotations();
    });

    const chartPrevBtn = document.getElementById("chartPdfPrev");
    if (chartPrevBtn) {
        chartPrevBtn.addEventListener("click", async () => {
            if (chartPdfDoc && chartPdfPage > 1) {
                chartPdfPage -= 1;
                await renderChartPdfPage();
            }
        });
    }

    const chartNextBtn = document.getElementById("chartPdfNext");
    if (chartNextBtn) {
        chartNextBtn.addEventListener("click", async () => {
            if (chartPdfDoc && chartPdfPage < chartPdfDoc.numPages) {
                chartPdfPage += 1;
                await renderChartPdfPage();
            }
        });
    }

    const chartRotateLeftBtn = document.getElementById("chartRotateLeft");
    if (chartRotateLeftBtn) {
        chartRotateLeftBtn.addEventListener("click", async () => {
            chartRotation = (chartRotation + 270) % 360;
            await rotateChartPreview();
        });
    }

    const chartRotateRightBtn = document.getElementById("chartRotateRight");
    if (chartRotateRightBtn) {
        chartRotateRightBtn.addEventListener("click", async () => {
            chartRotation = (chartRotation + 90) % 360;
            await rotateChartPreview();
        });
    }

    async function rotateChartPreview() {
        if (chartPdfDoc) {
            await renderChartPdfPage();
            return;
        }
        const image = chartViewer.querySelector("img");
        if (image && image.complete && image.naturalWidth > 0) {
            renderChartImage(image);
        }
    }

    document.getElementById("resetPhaseButton").addEventListener("click", () => {
        getChecklistEntries(activePhase).forEach((entry) => {
            delete state[checklistEntryStateKey(activePhase, entry)];
        });
        saveState();
        render();
    });

    document.getElementById("resetAllButton").addEventListener("click", () => {
        Object.keys(state).forEach((key) => delete state[key]);
        saveState();
        render();
    });

    addChecklistItemButton.addEventListener("click", () => {
        const isOpen = !addChecklistItemForm.classList.contains("hidden");
        addChecklistItemForm.classList.toggle("hidden", isOpen);
        addChecklistItemButton.setAttribute("aria-expanded", String(!isOpen));
        if (!isOpen) {
            const positionInput = addChecklistItemForm.elements.namedItem("position");
            positionInput.max = String(getChecklistEntries(activePhase).length + 1);
            positionInput.value = positionInput.max;
            addChecklistItemForm.elements.namedItem("label").focus();
        }
    });
    addChecklistItemForm.addEventListener("submit", addChecklistEntry);
    document.getElementById("cancelAddChecklistItemButton").addEventListener("click", () => {
        addChecklistItemForm.reset();
        addChecklistItemForm.classList.add("hidden");
        addChecklistItemButton.setAttribute("aria-expanded", "false");
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) {
            handleFile(file);
        }
    });

    try {
        simbriefUsername.value = localStorage.getItem(simbriefStorageKey) || "";
    } catch (error) {
        console.error("SimBrief-Nutzername konnte nicht geladen werden.", error);
    }
    simbriefUsername.addEventListener("input", () => {
        try {
            const username = simbriefUsername.value.trim();
            if (username) localStorage.setItem(simbriefStorageKey, username);
            else localStorage.removeItem(simbriefStorageKey);
        } catch (error) {
            console.error("SimBrief-Nutzername konnte nicht gespeichert werden.", error);
            routeStatus.textContent = "SimBrief-Nutzername konnte nicht auf diesem Gerät gespeichert werden.";
        }
    });

    document.getElementById("radarPrev").addEventListener("click", () => showRadarFrame(radarIndex - 1));
    document.getElementById("radarNext").addEventListener("click", () => showRadarFrame(radarIndex + 1));
    document.getElementById("radarPlay").addEventListener("click", toggleRadarPlay);
    document.getElementById("radarRefresh").addEventListener("click", () => {
        const mapWasInitialized = Boolean(flightMap);
        initFlightMap();
        if (!mapWasInitialized) return;
        if (radarEnabled) loadRadarFrames();
        if (forecastEnabled) loadWeatherSamples(true);
    });
    rainViewerTimeSlider.addEventListener("input", () => showRadarFrame(rainViewerTimeSlider.value));
    forecastLayerToggle.addEventListener("change", () => {
        const mapWasInitialized = Boolean(flightMap);
        initFlightMap();
        if (mapWasInitialized) setForecastEnabled(forecastLayerToggle.checked);
    });
    rainViewerLayerToggle.addEventListener("change", () => {
        const mapWasInitialized = Boolean(flightMap);
        initFlightMap();
        if (mapWasInitialized) setRadarEnabled(rainViewerLayerToggle.checked);
    });
    routeLayerToggle.addEventListener("change", () => {
        const mapWasInitialized = Boolean(flightMap);
        initFlightMap();
        if (mapWasInitialized) setRouteEnabled(routeLayerToggle.checked);
    });
    rainViewerTimeSlider.value = "0";
    updateRadarControls();

    flightPlanInput.addEventListener("change", () => {
        const file = flightPlanInput.files && flightPlanInput.files[0];
        handleFlightPlan(file);
    });
    document.getElementById("simbriefLoadButton").addEventListener("click", loadSimBriefFlightPlan);
    document.getElementById("simbriefNativeInputButton").addEventListener("click", () => {
        if (window.AndroidApp && typeof window.AndroidApp.requestSimbriefId === "function") {
            window.AndroidApp.requestSimbriefId(simbriefUsername.value);
        } else {
            simbriefUsername.focus();
        }
    });
    simbriefUsername.addEventListener("keydown", (event) => {
        if (event.key === "Enter") loadSimBriefFlightPlan();
    });
    window.setSimbriefUsername = (value) => {
        simbriefUsername.value = String(value || "");
        simbriefUsername.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.getElementById("fitRouteButton").addEventListener("click", fitRoute);
    document.getElementById("clearRouteButton").addEventListener("click", clearRoute);
    airportSearchForm.addEventListener("submit", searchAirport);
    refreshAirportButton.addEventListener("click", refreshActiveAirport);
    const demoRouteBtn = document.getElementById("demoRouteButton");
    if (demoRouteBtn) {
        demoRouteBtn.addEventListener("click", () => {
            initFlightMap();
            routePoints = demoFlightPlan;
            renderRoute(demoFlightPlan, "TUIfly: EDDV ➔ LEPA");
        });
    }

    document.getElementById("pdfPrev").addEventListener("click", async () => {
        if (pdfDoc && pdfPage > 1) {
            pdfPage -= 1;
            await renderPdfPage();
        }
    });

    document.getElementById("pdfNext").addEventListener("click", async () => {
        if (pdfDoc && pdfPage < pdfDoc.numPages) {
            pdfPage += 1;
            await renderPdfPage();
        }
    });

    document.getElementById("pdfZoomOut").addEventListener("click", async () => {
        if (pdfDoc) {
            pdfZoom = Math.max(0.7, pdfZoom - 0.15);
            await renderPdfPage();
        }
    });

    document.getElementById("pdfZoomIn").addEventListener("click", async () => {
        if (pdfDoc) {
            pdfZoom = Math.min(2, pdfZoom + 0.15);
            await renderPdfPage();
        }
    });

    window.addEventListener("resize", () => {
        if (document.getElementById("notesView").classList.contains("active")) {
            resizeNotesCanvas();
        }
        if (pdfDoc) {
            window.clearTimeout(window.__pdfResize);
            window.__pdfResize = window.setTimeout(renderPdfPage, 120);
        }
        if (document.getElementById("chartsView").classList.contains("active")) {
            if (chartPdfDoc) {
                window.clearTimeout(window.__chartResize);
                window.__chartResize = window.setTimeout(renderChartPdfPage, 120);
            } else {
                const image = chartViewer.querySelector("img");
                if (image && image.complete && image.naturalWidth > 0) {
                    renderChartImage(image);
                } else {
                    ensureChartAnnotationCanvas();
                    redrawChartAnnotations();
                }
            }
        }
        if (flightMap) flightMap.invalidateSize();
    });

    showEmpty("Datei wählen");
    loadNotes();
    window.onXPlanePosition = updateAircraftPosition;
    window.onXPlaneFmsRoute = receiveXPlaneFmsRoute;
    window.setAircraftPosition = (latitude, longitude, headingDegrees) => {
        const lat = Number(latitude);
        const lon = Number(longitude);
        const heading = Number(headingDegrees);
        if (!Number.isFinite(lat) || Math.abs(lat) > 90 ||
            !Number.isFinite(lon) || Math.abs(lon) > 180 ||
            !Number.isFinite(heading)) {
            setXPlaneStatus("Ungültige Flugzeugposition empfangen.", "error");
            return false;
        }
        initFlightMap();
        updateAircraftPosition(lat, lon, null, heading, null);
        return true;
    };
    loadFlightTrack();
    updateFlightTrackStatus();
    window.addEventListener("pagehide", saveFlightTrack);

    function updateNotesTools() {
        const drawTool = document.getElementById("notesDrawTool");
        drawTool.setAttribute("aria-pressed", String(notesMode === "draw"));
        drawTool.textContent = notesMode === "pan" ? "Stift aus" : "Stift";
        document.getElementById("notesTextTool").setAttribute("aria-pressed", String(notesMode === "text"));
        document.getElementById("notesEraseTool").setAttribute("aria-pressed", String(notesMode === "erase"));
        notesCanvas.style.cursor = notesMode === "text" ? "text"
            : notesMode === "erase" ? "cell"
                : notesMode === "pan" ? "grab" : "crosshair";
        notesCanvas.classList.toggle("is-panning", notesMode === "pan");
        notesStatus.textContent = notesMode === "text"
            ? "Text eingeben und an die gewünschte Stelle auf der Leinwand tippen."
            : notesMode === "erase"
                ? "Radierer aktiv: über die zu entfernenden Striche fahren."
                : notesMode === "pan"
                    ? "Stift aus: mit einem Finger verschieben, mit zwei Fingern zoomen."
                    : "Stift aktiv: auf der Leinwand zeichnen.";
    }
    initializeXPlaneTelemetry();
    loadCustomChecklistData();
    initializeChecklistDragReordering();
    render();
    initializeAbnormalChecklists();
})();
