(function () {
    "use strict";

    const calculator = window.PerformanceCalculator;
    const formIds = ["takeoffForm", "landingForm", "fuelForm"];
    const unitNames = {
        elevation: { metric: "ft", imperial: "ft" },
        length: { metric: "ft", imperial: "ft" },
        pressure: { metric: "hPa", imperial: "inHg" },
        weight: { metric: "kg", imperial: "lb" },
        weightKg: { metric: "kg", imperial: "kg" },
        altitude: { metric: "ft", imperial: "ft" }
    };

    function unitFor(input, system) {
        const unit = unitNames[input.dataset.unit];
        return unit && unit[system];
    }

    function convertInput(input, fromSystem, toSystem, config) {
        const unit = unitFor(input, "imperial");
        if (!unit || fromSystem === toSystem ||
            ["altitude", "elevation", "length"].includes(input.dataset.unit)) return;
        const direction = toSystem === "imperial" ? "fromMetric" : "toMetric";
        ["value", "min", "max", "step"].forEach((attribute) => {
            const raw = attribute === "value" ? input.value : input.getAttribute(attribute);
            if (raw === null || raw === "") return;
            const number = Number(raw);
            if (!Number.isFinite(number) || (attribute === "step" && number === "any")) return;
            const converted = calculator.convertUnit(number, unit, direction, config);
            const precision = input.dataset.unit === "pressure" ? 5 : 2;
            if (attribute === "value") input.value = String(Number(converted.toFixed(precision)));
            else input.setAttribute(attribute, String(Number(converted.toFixed(precision))));
        });
    }

    function configureUnits(form, config) {
        const unitSelect = form.elements.namedItem("unitSystem");
        let currentSystem = unitSelect.value;
        unitSelect.addEventListener("change", () => {
            const nextSystem = unitSelect.value;
            form.querySelectorAll("[data-unit]").forEach((input) => {
                convertInput(input, currentSystem, nextSystem, config);
            });
            form.querySelectorAll("[data-unit-label]").forEach((label) => {
                label.textContent = "(" + label.dataset[nextSystem] + ")";
            });
            currentSystem = nextSystem;
        });
        form.querySelectorAll("[data-unit-label]").forEach((label) => {
            label.textContent = "(" + label.dataset[currentSystem] + ")";
        });
    }

    function normalizeZfwThousandsSeparator(form) {
        const input = form.elements.namedItem("zfw");
        const normalize = () => {
            const value = Number(input.value);
            const minimum = Number(input.min);
            const maximum = Number(input.max);
            if (value >= minimum || value < minimum / 1000 || value > maximum / 1000) return;
            input.value = String(value * 1000);
        };
        input.addEventListener("change", normalize);
        input.addEventListener("blur", normalize);
    }

    function metricValue(form, name, unit, config) {
        const input = form.elements.namedItem(name);
        const value = Number(input.value);
        if (input.dataset.unit === "weightKg") return value;
        if (["elevation", "length", "altitude"].includes(input.dataset.unit)) {
            return calculator.convertUnit(value, "ft", "toMetric", config);
        }
        const system = form.elements.namedItem("unitSystem").value;
        if (system === "metric") return value;
        return calculator.convertUnit(value, unit, "toMetric", config);
    }

    function takeoffInput(form, config) {
        return {
            elevationMeters: metricValue(form, "elevation", "ft", config),
            qnhHpa: metricValue(form, "qnh", "inHg", config),
            oatC: Number(form.elements.namedItem("oat").value),
            toraMeters: metricValue(form, "tora", "ft", config),
            todaMeters: metricValue(form, "toda", "ft", config),
            asdaMeters: metricValue(form, "asda", "ft", config),
            slopePercent: Number(form.elements.namedItem("slope").value),
            windDirection: Number(form.elements.namedItem("windDirection").value),
            windSpeedKt: Number(form.elements.namedItem("windSpeed").value),
            runwayHeading: Number(form.elements.namedItem("runwayHeading").value),
            obstacleHeightFt: optionalNumber(form.elements.namedItem("obstacleHeightFt")),
            obstacleDistanceFt: optionalNumber(form.elements.namedItem("obstacleDistanceFt")),
            surface: form.elements.namedItem("surface").value,
            weightKg: metricValue(form, "weight", "lb", config),
            cgPercentMac: Number(form.elements.namedItem("cg").value),
            flaps: form.elements.namedItem("flaps").value,
            derate: form.elements.namedItem("derate").value,
            antiIce: form.elements.namedItem("antiIce").checked,
            bleed: form.elements.namedItem("bleed").checked
        };
    }

    function landingInput(form, config) {
        return {
            elevationMeters: metricValue(form, "elevation", "ft", config),
            qnhHpa: metricValue(form, "qnh", "inHg", config),
            oatC: Number(form.elements.namedItem("oat").value),
            ldaMeters: metricValue(form, "lda", "ft", config),
            slopePercent: Number(form.elements.namedItem("slope").value),
            windDirection: Number(form.elements.namedItem("windDirection").value),
            windSpeedKt: Number(form.elements.namedItem("windSpeed").value),
            gustKt: Number(form.elements.namedItem("gust").value),
            runwayHeading: Number(form.elements.namedItem("runwayHeading").value),
            surface: form.elements.namedItem("surface").value,
            weightKg: metricValue(form, "weight", "lb", config),
            measuredBrakingDistanceMeters: optionalNumber(form.elements.namedItem("measuredBrakingDistanceFt")) === null
                ? null
                : calculator.convertUnit(
                    optionalNumber(form.elements.namedItem("measuredBrakingDistanceFt")),
                    "ft",
                    "toMetric",
                    config
                ),
            measuredVrefKt: optionalNumber(form.elements.namedItem("measuredVrefKt")),
            flaps: form.elements.namedItem("flaps").value,
            autobrake: form.elements.namedItem("autobrake").value,
            reverseThrust: form.elements.namedItem("reverseThrust").checked
        };
    }

    function fuelInput(form, config) {
        return {
            distanceNm: Number(form.elements.namedItem("distance").value),
            cruiseAltitudeFt: Number(form.elements.namedItem("altitude").value),
            windComponentKt: Number(form.elements.namedItem("wind").value),
            isaDeviationC: Number(form.elements.namedItem("isaDeviation").value),
            costIndex: Number(form.elements.namedItem("costIndex").value),
            zfwKg: metricValue(form, "zfw", "lb", config),
            zfwCgPercentMac: Number(form.elements.namedItem("zfwCg").value),
            apuEnabled: form.elements.namedItem("apuEnabled").checked,
            apuMinutes: Number(form.elements.namedItem("apuMinutes").value),
            antiIce: form.elements.namedItem("antiIceFuel").checked,
            weatherFuel: form.elements.namedItem("weatherFuel").checked,
            alternateNm: Number(form.elements.namedItem("alternate").value),
            taxiMinutes: Number(form.elements.namedItem("taxiMinutes").value),
            contingencyPercent: Number(form.elements.namedItem("contingency").value),
            extraFuelKg: metricValue(form, "extra", "lb", config)
        };
    }

    function number(value, digits) {
        return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits === undefined ? 0 : digits })
            .format(value);
    }

    function optionalNumber(input) {
        return input.value === "" ? null : Number(input.value);
    }

    function formatDistance(meters, config) {
        return number(calculator.convertUnit(meters, "ft", "fromMetric", config)) + " ft";
    }

    function formatWeight(kg, system, config) {
        return system === "imperial"
            ? number(calculator.convertUnit(kg, "lb", "fromMetric", config)) + " lb"
            : number(kg) + " kg";
    }

    function addCard(container, label, value, className) {
        const card = document.createElement("div");
        card.className = "performance-result-card" + (className ? " " + className : "");
        const title = document.createElement("span");
        title.textContent = label;
        const result = document.createElement("strong");
        result.textContent = value;
        card.append(title, result);
        container.appendChild(card);
    }

    function addLimits(container, limits, limitingFactor) {
        const section = document.createElement("div");
        section.className = "performance-limit-list";
        const heading = document.createElement("h3");
        heading.textContent = "Limits";
        section.appendChild(heading);
        limits.forEach((limit) => {
            const item = document.createElement("div");
            item.className = "performance-limit " + (limit.passed ? "is-passed" : "is-failed");
            if (limit.label === limitingFactor) item.classList.add("is-limiting");
            const label = document.createElement("span");
            label.textContent = limit.label;
            const status = document.createElement("strong");
            status.textContent = limit.passed ? "OK" : "LIMIT";
            item.append(label, status);
            section.appendChild(item);
        });
        container.appendChild(section);
    }

    function addWarnings(container, warnings) {
        const section = document.createElement("div");
        section.className = "performance-warning-list" + (warnings.length ? " has-warnings" : "");
        const heading = document.createElement("h3");
        heading.textContent = warnings.length ? "Warnungen" : "Keine Modell-Limits überschritten";
        section.appendChild(heading);
        if (warnings.length) {
            const list = document.createElement("ul");
            warnings.forEach((warning) => {
                const item = document.createElement("li");
                item.textContent = warning;
                list.appendChild(item);
            });
            section.appendChild(list);
        }
        container.appendChild(section);
    }

    function addDisclaimer(container) {
        const disclaimer = document.createElement("p");
        disclaimer.className = "performance-result-disclaimer";
        disclaimer.textContent = "Näherungswert für den Simulator, nicht zertifiziert.";
        container.appendChild(disclaimer);
    }

    function renderTakeoff(result, form, container, config) {
        const system = form.elements.namedItem("unitSystem").value;
        container.replaceChildren();
        const cards = document.createElement("div");
        cards.className = "performance-result-grid";
        addCard(cards, "V1", number(result.v1Kt) + " kt");
        addCard(cards, "VR", number(result.vrKt) + " kt");
        addCard(cards, "V2", number(result.v2Kt) + " kt");
        addCard(cards, "Flex-Temperatur", result.derate === "TO"
            ? "Nicht verwendet"
            : number(result.flexTemperatureC) + " °C");
        addCard(cards, "Derate", result.derate);
        addCard(cards, "Stab-Trim", number(result.trimUnits, 2) + " Units");
        addCard(cards, "Startstrecke bis 35 ft", formatDistance(result.takeoffDistanceMeters, config));
        addCard(cards, "Abbruchstrecke", formatDistance(result.accelerateStopDistanceMeters, config));
        addCard(cards, "Bahnreserve", formatDistance(result.runwayReserveMeters, config));
        addCard(cards, "Kürzeste verfügbare Bahn", formatDistance(result.availableRunwayMeters, config));
        addCard(cards, "Limitierender Faktor", result.limitingFactor);
        addCard(cards, "Steiggradient (OEI)", number(result.climbGradientPercent, 1) + " %");
        addCard(cards, "Bremsenergie", number(result.brakeEnergyMj, 1) + " MJ");
        addCard(cards, "Druckhöhe", number(result.pressureAltitudeFt) + " ft");
        addCard(cards, "Luftdichte", number(result.densityKgM3, 3) + " kg/m³");
        addCard(cards, "Wind längs / quer", number(result.headwindKt, 1) + " / "
            + number(result.crosswindKt, 1) + " kt");
        addCard(cards, "Modellierter Schub", number(result.thrustN / 1000, 1) + " kN");
        addCard(cards, "Schubfaktor bei V2", "× " + number(result.thrustSpeedFactor, 3));
        addCard(cards, "Kalibrierung", result.calibrationApplied ? "FMC-Referenz interpoliert" : "Physikalisches Modell");
        addCard(cards, "Hindernisprüfung", result.obstacleRequiredGradientPercent === null
            ? "Nicht geprüft"
            : number(result.obstacleRequiredGradientPercent, 2) + " % erforderlich");
        const fmcSpeeds = [
            ["V1", "fmcV1", result.v1Kt],
            ["VR", "fmcVr", result.vrKt],
            ["V2", "fmcV2", result.v2Kt]
        ];
        fmcSpeeds.forEach(([label, name, calculated]) => {
            const entered = form.elements.namedItem(name).value;
            if (entered !== "") {
                const difference = calculated - Number(entered);
                addCard(cards, label + " Abweichung zum FMC", (difference > 0 ? "+" : "") + number(difference) + " kt");
            }
        });
        container.append(cards);
        addLimits(container, result.limits, result.limitingFactor);
        addWarnings(container, result.warnings);
        addDisclaimer(container);
    }

    function renderLanding(result, container, config) {
        container.replaceChildren();
        const cards = document.createElement("div");
        cards.className = "performance-result-grid";
        addCard(cards, "Vref", number(result.vrefKt) + " kt");
        addCard(cards, "Vapp", number(result.vappKt) + " kt");
        addCard(cards, "Windzuschlag", number(result.windCorrectionKt) + " kt");
        addCard(cards, "Sicherheitsfaktor", "× " + number(result.safetyFactor, 2));
        addCard(cards, "Umkehrschub", result.reverseThrust ? "Ein" : "Aus");
        addCard(
            cards,
            "Autobrake-Empfehlung",
            result.recommendedAutobrake || "Keine Stufe innerhalb der LDA"
        );
        if (!result.allAutobrakes) {
            addCard(cards, "Landestrecke (unfaktoriert)", formatDistance(result.rawDistanceMeters, config));
            addCard(cards, "Landestrecke mit Faktor", formatDistance(result.factoredDistanceMeters, config));
            addCard(cards, "Bahnreserve", formatDistance(result.runwayReserveMeters, config));
        }
        if (result.vrefDifferenceKt !== null) {
            addCard(cards, "VREF-Abweichung zum Sim", (result.vrefDifferenceKt > 0 ? "+" : "")
                + number(result.vrefDifferenceKt, 1) + " kt");
        }
        addCard(cards, "Limitierender Faktor", result.limitingFactor);
        container.append(cards);
        addLandingRunwayComparison(result, container, config);
        addLimits(container, result.limits, result.limitingFactor);
        addWarnings(container, result.warnings);
        addDisclaimer(container);
    }

    function addLandingRunwayComparison(result, container, config) {
        const comparison = document.createElement("section");
        comparison.className = "landing-runway-comparison";
        const heading = document.createElement("h3");
        heading.textContent = result.allAutobrakes
            ? "Landestrecke je Autobrake-Stufe"
            : "Landestrecke auf der Bahn · Autobrake " + result.scenarios[0].autobrake;
        const meta = document.createElement("p");
        meta.textContent = "LDA " + formatDistance(result.ldaMeters, config)
            + " · Umkehrschub " + (result.reverseThrust ? "ein" : "aus")
            + " · Markierung: überschrittene LDA";
        comparison.append(heading, meta);

        const runwayScale = Math.max(
            result.ldaMeters,
            ...result.scenarios.map((scenario) => scenario.factoredDistanceMeters)
        ) * 1.1;
        result.scenarios.forEach((scenario) => {
            const row = document.createElement("div");
            row.className = "landing-runway-row" + (scenario.runwayPassed ? "" : " is-overrun");
            const label = document.createElement("div");
            label.className = "landing-runway-label";
            const stage = document.createElement("strong");
            stage.textContent = "Autobrake " + scenario.autobrake;
            const distance = document.createElement("span");
            distance.textContent = formatDistance(scenario.rawDistanceMeters, config)
                + " unfaktoriert · " + formatDistance(scenario.factoredDistanceMeters, config)
                + " faktoriert";
            label.append(stage, distance);

            const scale = document.createElement("div");
            scale.className = "landing-runway-scale";
            scale.setAttribute("role", "img");
            scale.setAttribute(
                "aria-label",
                "Autobrake " + scenario.autobrake + ": "
                    + formatDistance(scenario.rawDistanceMeters, config) + " unfaktoriert, "
                    + formatDistance(scenario.factoredDistanceMeters, config) + " faktoriert"
                    + (scenario.runwayPassed ? ", innerhalb der LDA" : ", LDA überschritten")
            );
            const runway = document.createElement("div");
            runway.className = "landing-runway-surface";
            runway.style.width = (result.ldaMeters / runwayScale * 100) + "%";
            const landing = document.createElement("div");
            landing.className = "landing-runway-distance";
            landing.style.width = (scenario.factoredDistanceMeters / runwayScale * 100) + "%";
            const limit = document.createElement("div");
            limit.className = "landing-runway-limit";
            limit.style.left = (result.ldaMeters / runwayScale * 100) + "%";
            scale.append(runway, landing, limit);
            const reserve = document.createElement("span");
            reserve.className = "landing-runway-reserve";
            reserve.textContent = scenario.runwayPassed
                ? "Reserve " + formatDistance(scenario.runwayReserveMeters, config)
                : "LDA überschritten um " + formatDistance(-scenario.runwayReserveMeters, config);
            row.append(label, scale, reserve);
            if (scenario.measuredBrakingDistanceDifferenceMeters !== null) {
                const measurement = document.createElement("span");
                measurement.className = "landing-runway-reserve";
                measurement.textContent = "Bremsweg-Modell Δ zum Sim "
                    + (scenario.measuredBrakingDistanceDifferenceMeters > 0 ? "+" : "")
                    + formatDistance(scenario.measuredBrakingDistanceDifferenceMeters, config);
                row.appendChild(measurement);
            }
            comparison.appendChild(row);
        });
        const legend = document.createElement("p");
        legend.className = "landing-runway-legend";
        legend.textContent = "Die gestrichelte Markierung zeigt das Ende der verfügbaren Landestrecke (LDA).";
        comparison.appendChild(legend);
        container.appendChild(comparison);
    }

    function formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        return hours + " h " + remainingMinutes + " min";
    }

    function renderFuel(result, form, container, config) {
        const system = form.elements.namedItem("unitSystem").value;
        container.replaceChildren();
        const cards = document.createElement("div");
        cards.className = "performance-result-grid";
        addCard(cards, "Block Fuel", formatWeight(result.blockFuelKg, system, config));
        addCard(cards, "Trip Fuel", formatWeight(result.tripFuelKg, system, config));
        addCard(cards, "Taxi", formatWeight(result.taxiFuelKg, system, config));
        addCard(cards, "APU", formatWeight(result.apuFuelKg, system, config));
        addCard(cards, "Contingency", formatWeight(result.contingencyFuelKg, system, config));
        addCard(cards, "Contingency-Mindestwert", formatWeight(result.contingencyMinimumKg, system, config));
        addCard(cards, "Alternate", formatWeight(result.alternateFuelKg, system, config));
        addCard(
            cards,
            "Final Reserve · " + number(result.finalReserveHoldingAltitudeFt) + " ft",
            formatWeight(result.finalReserveFuelKg, system, config)
        );
        addCard(cards, "Startgewicht", formatWeight(result.takeoffWeightKg, system, config));
        addCard(cards, "Landegewicht", formatWeight(result.landingWeightKg, system, config));
        addCard(cards, "ZFW-Schwerpunkt", number(result.zfwCgPercentMac, 1) + " % MAC");
        addCard(cards, "Schwerpunkt beim Start", number(result.takeoffCgPercentMac, 1) + " % MAC");
        addCard(cards, "Schwerpunkt bei Landung", number(result.landingCgPercentMac, 1) + " % MAC");
        addCard(cards, "Angenommene Fuel-CG", number(result.fuelCgPercentMac, 1) + " % MAC");
        addCard(cards, "Reisezeit", formatTime(result.flightTimeMinutes));
        addCard(cards, "Ausweichflugzeit", formatTime(result.alternateTimeMinutes));
        addCard(cards, "Reiseflughöhe", number(result.phases.cruiseAltitudeFt) + " ft");
        addCard(cards, "Alternate-Reiseflughöhe", number(result.alternatePhases.cruiseAltitudeFt) + " ft");
        addCard(cards, "Gewichts-Iterationen", number(result.iterations));
        addCard(cards, "Cruise Groundspeed", number(result.cruiseGroundspeedKt) + " kt");
        container.append(cards);

        const phaseHeading = document.createElement("h3");
        phaseHeading.className = "performance-phase-heading";
        phaseHeading.textContent = "Trip Fuel nach Flugphase";
        container.appendChild(phaseHeading);
        const phaseCards = document.createElement("div");
        phaseCards.className = "performance-result-grid";
        [
            ["Steigflug", result.phases.climb],
            ["Reiseflug", result.phases.cruise],
            ["Sinkflug", result.phases.descent]
        ].forEach(([name, phase]) => {
            addCard(phaseCards, name + " · Kraftstoff", formatWeight(phase.fuelKg, system, config));
            addCard(phaseCards, name + " · Zeit", formatTime(phase.timeMinutes));
            addCard(phaseCards, name + " · Strecke", number(phase.distanceNm, 1) + " NM");
        });
        container.appendChild(phaseCards);
        addWarnings(container, result.warnings);
        addDisclaimer(container);
    }

    function setupForm(formId, statusId, resultsId, config, calculate, render) {
        const form = document.getElementById(formId);
        const status = document.getElementById(statusId);
        const results = document.getElementById(resultsId);
        configureUnits(form, config);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            try {
                const result = calculate(form, config);
                status.textContent = "";
                render(result, form, results, config);
            } catch (error) {
                if (!(error instanceof calculator.ValidationError)) {
                    console.error("Performance-Näherung fehlgeschlagen.", error);
                    status.textContent = "Berechnung fehlgeschlagen. Prüfe die Eingaben und die Konfiguration.";
                    results.replaceChildren();
                    return;
                }
                status.textContent = error.message;
                results.replaceChildren();
            }
        });
    }

    function loadConfiguration() {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open("GET", "aircraft_737-800.json", true);
            request.onload = () => {
                if (request.status !== 0 && (request.status < 200 || request.status >= 300)) {
                    reject(new Error("Konfigurationsdatei: HTTP " + request.status));
                    return;
                }
                if (!request.responseText) {
                    reject(new Error("Konfigurationsdatei ist leer."));
                    return;
                }
                try {
                    resolve(JSON.parse(request.responseText));
                } catch (error) {
                    reject(new Error("Konfigurationsdatei enthält kein gültiges JSON.", { cause: error }));
                }
            };
            request.onerror = () => reject(new Error("Konfigurationsdatei konnte nicht gelesen werden."));
            request.send();
        });
    }

    function setupTakeoffRunwayControls(form) {
        const tora = form.elements.namedItem("tora");
        const sameRunwayDistances = form.elements.namedItem("sameRunwayDistances");
        const dependentLengths = ["toda", "asda"].map((name) => form.elements.namedItem(name));
        const syncRunwayLengths = () => {
            dependentLengths.forEach((input) => {
                input.readOnly = sameRunwayDistances.checked;
                if (sameRunwayDistances.checked) input.value = tora.value;
            });
        };
        tora.addEventListener("input", syncRunwayLengths);
        sameRunwayDistances.addEventListener("change", syncRunwayLengths);
        syncRunwayLengths();

        form.elements.namedItem("runwayPreset").addEventListener("change", (event) => {
            const presets = {
                "eddl-05r": { heading: 50, slope: 0.3 },
                "eddl-23l": { heading: 230, slope: -0.3 }
            };
            const preset = presets[event.target.value];
            if (!preset) return;
            form.elements.namedItem("runwayHeading").value = String(preset.heading);
            form.elements.namedItem("slope").value = String(preset.slope);
        });
    }

    function renderReferenceChecks(config) {
        const takeoffReference = config.takeoff.referenceCase;
        const takeoffResult = calculator.calculateTakeoff(takeoffReference, config);
        const takeoffTarget = document.getElementById("takeoffReferenceResults");
        const takeoffCards = document.createElement("div");
        takeoffCards.className = "performance-result-grid";
        [
            ["V1", takeoffResult.v1Kt, takeoffReference.expectedV1Kt, "kt"],
            ["VR", takeoffResult.vrKt, takeoffReference.expectedVrKt, "kt"],
            ["V2", takeoffResult.v2Kt, takeoffReference.expectedV2Kt, "kt"],
            ["Trim", takeoffResult.trimUnits, takeoffReference.expectedTrimUnits, "Units"]
        ].forEach(([name, actual, expected, unit]) => {
            addCard(
                takeoffCards,
                name + " · Soll " + number(expected, 2) + " " + unit,
                number(actual, 2) + " " + unit + " · Δ " + (actual - expected > 0 ? "+" : "")
                    + number(actual - expected, 2) + " " + unit
            );
        });
        takeoffTarget.replaceChildren(takeoffCards);

        const fuelReference = config.fuel.referenceCase;
        const fuelResult = calculator.calculateFuel({
            ...fuelReference,
            apuEnabled: false,
            apuMinutes: 0,
            antiIce: false,
            weatherFuel: false
        }, config);
        const fuelTarget = document.getElementById("fuelReferenceResults");
        const fuelCards = document.createElement("div");
        fuelCards.className = "performance-result-grid";
        [
            ["Trip Fuel", fuelResult.tripFuelKg, fuelReference.expectedTripFuelKg, "kg"],
            ["Flugzeit", fuelResult.flightTimeMinutes, fuelReference.expectedFlightTimeMinutes, "min"],
            ["Steigflug · Fuel", fuelResult.phases.climb.fuelKg, null, "kg"],
            ["Steigflug · Zeit", fuelResult.phases.climb.timeMinutes, null, "min"],
            ["Steigflug · Strecke", fuelResult.phases.climb.distanceNm, null, "NM"],
            ["Reiseflug · Fuel", fuelResult.phases.cruise.fuelKg, null, "kg"],
            ["Sinkflug · Fuel", fuelResult.phases.descent.fuelKg, null, "kg"],
            ["Alternate-Höhe", fuelResult.alternatePhases.cruiseAltitudeFt, null, "ft"]
        ].forEach(([name, actual, expected, unit]) => {
            addCard(
                fuelCards,
                expected === null ? name : name + " · Soll " + number(expected) + " " + unit,
                number(actual, 1) + " " + unit + (expected === null ? ""
                    : " · Δ " + (actual - expected > 0 ? "+" : "") + number(actual - expected, 1) + " " + unit)
            );
        });
        fuelTarget.replaceChildren(fuelCards);
    }

    async function initialize() {
        try {
            const config = await loadConfiguration();
            if (config.modelVersion !== 1 || !config.aircraft || !config.units || !config.takeoff || !config.landing || !config.fuel) {
                throw new Error("Unbekannte oder unvollständige Flugzeugkonfiguration.");
            }
            const fuelForm = document.getElementById("fuelForm");
            const takeoffForm = document.getElementById("takeoffForm");
            const takeoffLimits = config.takeoff.plausibility;
            const cgRange = config.takeoff.cgRangePercentMac;
            takeoffForm.elements.namedItem("elevation").min = String(-500 / config.units.metersPerFoot);
            takeoffForm.elements.namedItem("elevation").max = String(takeoffLimits.inputMaximumElevationFt);
            takeoffForm.elements.namedItem("qnh").min = String(takeoffLimits.inputMinimumQnhHpa);
            takeoffForm.elements.namedItem("qnh").max = String(takeoffLimits.inputMaximumQnhHpa);
            ["tora", "toda", "asda"].forEach((name) => {
                takeoffForm.elements.namedItem(name).min = String(
                    takeoffLimits.inputMinimumRunwayMeters / config.units.metersPerFoot
                );
                takeoffForm.elements.namedItem(name).max = String(
                    takeoffLimits.inputMaximumRunwayMeters / config.units.metersPerFoot
                );
            });
            takeoffForm.elements.namedItem("slope").min = String(-takeoffLimits.inputMaximumSlopePercent);
            takeoffForm.elements.namedItem("slope").max = String(takeoffLimits.inputMaximumSlopePercent);
            takeoffForm.elements.namedItem("weight").min = String(takeoffLimits.inputMinimumWeightKg);
            takeoffForm.elements.namedItem("weight").max = String(takeoffLimits.inputMaximumWeightKg);
            takeoffForm.elements.namedItem("cg").min = String(cgRange.minimum);
            takeoffForm.elements.namedItem("cg").max = String(cgRange.maximum);
            setupTakeoffRunwayControls(takeoffForm);
            fuelForm.elements.namedItem("zfw").min = String(config.aircraft.oewKg);
            fuelForm.elements.namedItem("zfw").max = String(config.fuel.maxZfwInputKg);
            fuelForm.elements.namedItem("zfwCg").min = String(cgRange.minimum);
            fuelForm.elements.namedItem("zfwCg").max = String(cgRange.maximum);
            fuelForm.elements.namedItem("altitude").max = String(config.fuel.maxCruiseAltitudeFt);
            fuelForm.elements.namedItem("alternate").value = String(config.fuel.alternateDefaultNm);
            normalizeZfwThousandsSeparator(fuelForm);
            renderReferenceChecks(config);
            setupForm("takeoffForm", "takeoffStatus", "takeoffResults", config, (form, data) =>
                calculator.calculateTakeoff(takeoffInput(form, data), data), renderTakeoff);
            setupForm("landingForm", "landingStatus", "landingResults", config, (form, data) =>
                calculator.calculateLanding(landingInput(form, data), data),
            (result, form, container, data) => renderLanding(result, container, data));
            setupForm("fuelForm", "fuelStatus", "fuelResults", config, (form, data) =>
                calculator.calculateFuel(fuelInput(form, data), data), renderFuel);
        } catch (error) {
            console.error("Performance-Konfiguration konnte nicht geladen werden.", error);
            formIds.forEach((id) => {
                const form = document.getElementById(id);
                form.querySelectorAll("button[type=submit]").forEach((button) => { button.disabled = true; });
                const status = document.getElementById(id.replace("Form", "Status"));
                status.textContent = "Performance-Konfiguration konnte nicht geladen werden. Rechner nicht verfügbar.";
            });
        }
    }

    initialize();
})();
