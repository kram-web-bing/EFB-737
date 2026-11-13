(function (root, factory) {
    const calculator = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = calculator;
    if (root) root.PerformanceCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    class ValidationError extends Error {
        constructor(errors) {
            super(errors.join(" "));
            this.name = "ValidationError";
            this.errors = errors;
        }
    }

    const inputLabels = {
        elevationMeters: "Flughafenhöhe (m)",
        qnhHpa: "QNH (hPa)",
        oatC: "OAT (°C)",
        toraMeters: "TORA (m)",
        todaMeters: "TODA (m)",
        asdaMeters: "ASDA (m)",
        ldaMeters: "LDA (m)",
        slopePercent: "Bahnneigung (%)",
        windDirection: "Windrichtung (°)",
        windSpeedKt: "Windstärke (kt)",
        gustKt: "Böenzuschlag (kt)",
        runwayHeading: "Bahnausrichtung (°)",
        weightKg: "Gewicht (kg)",
        measuredBrakingDistanceMeters: "Gemessener Bremsweg (m)",
        measuredVrefKt: "Gemessene VREF (kt)",
        cgPercentMac: "Schwerpunkt (% MAC)",
        obstacleHeightFt: "Hindernishöhe (ft)",
        obstacleDistanceFt: "Hindernisabstand (ft)",
        taxiMinutes: "Taxi-Zeit (min)",
        distanceNm: "Strecke (nm)",
        cruiseAltitudeFt: "Reiseflughöhe (ft)",
        windComponentKt: "Windkomponente (kt)",
        isaDeviationC: "ISA-Abweichung (°C)",
        costIndex: "Cost Index",
        zfwKg: "ZFW (kg)",
        zfwCgPercentMac: "ZFW-Schwerpunkt (% MAC)",
        alternateNm: "Ausweichstrecke (nm)",
        contingencyPercent: "Contingency (%)",
        extraFuelKg: "Extra Fuel (kg)"
    };

    function numberInRange(input, name, min, max) {
        const value = Number(input[name]);
        if (!Number.isFinite(value) || value < min || value > max) {
            throw new ValidationError([
                (inputLabels[name] || name) + " muss zwischen " + min + " und " + max + " liegen."
            ]);
        }
        return value;
    }

    function numberAtLeast(input, name, min) {
        const value = Number(input[name]);
        if (!Number.isFinite(value) || value < min) {
            throw new ValidationError([
                (inputLabels[name] || name) + " muss mindestens " + min + " betragen."
            ]);
        }
        return value;
    }

    function optionalNumberInRange(input, name, min, max) {
        if (input[name] === undefined || input[name] === null || input[name] === "") return null;
        return numberInRange(input, name, min, max);
    }

    function interpolateTrim(cg, flap, config) {
        const points = config.takeoff.trimByCgPercentMac;
        const lower = points.find((point, index) => point.cg <= cg && (!points[index + 1] || points[index + 1].cg >= cg));
        if (!lower) return cg < points[0].cg ? points[0].units : points[points.length - 1].units;
        const upper = points[points.indexOf(lower) + 1];
        const base = !upper
            ? lower.units
            : lower.units + (upper.units - lower.units) * (cg - lower.cg) / (upper.cg - lower.cg);
        return base + config.takeoff.trimFlapOffsetUnits[String(flap)];
    }

    function interpolateTakeoffReference(weightKg, flap, config) {
        const references = config.takeoff.vSpeedReferencePoints
            .filter((point) => point.flaps === flap);
        if (!references.length) return null;
        const points = references
            .sort((first, second) => first.weightKg - second.weightKg);
        if (points.length < 2) return null;
        const upperIndex = points.findIndex((point) => point.weightKg >= weightKg);
        let lowerIndex = upperIndex < 0 ? points.length - 2 : upperIndex - 1;
        lowerIndex = Math.max(0, Math.min(points.length - 2, lowerIndex));
        const lower = points[lowerIndex];
        const upper = points[Math.min(lowerIndex + 1, points.length - 1)];
        const fraction = (weightKg - lower.weightKg) / (upper.weightKg - lower.weightKg);
        const result = {};
        ["v1Kt", "vrKt", "v2Kt", "trimUnits"].forEach((key) => {
            result[key] = lower[key] + (upper[key] - lower[key]) * fraction;
        });
        return result;
    }

    function pressureAltitudeFeet(elevationMeters, qnhHpa, config) {
        return elevationMeters / config.units.metersPerFoot
            + (config.atmosphere.seaLevelPressureHpa - qnhHpa)
            * config.atmosphere.pressureAltitudeCorrectionFtPerHpa;
    }

    function airDensity(elevationMeters, qnhHpa, temperatureC, config) {
        const pressureAltitudeM = pressureAltitudeFeet(elevationMeters, qnhHpa, config)
            * config.units.metersPerFoot;
        const atmosphere = config.atmosphere;
        const pressureRatio = Math.pow(
            Math.max(
                atmosphere.minimumPressureRatio,
                1 - atmosphere.isaPressureBase * pressureAltitudeM
            ),
            atmosphere.isaPressureExponent
        );
        const pressurePa = atmosphere.seaLevelPressureHpa * config.units.pascalsPerHpa * pressureRatio;
        const temperatureK = temperatureC + atmosphere.kelvinOffsetC;
        return pressurePa / (atmosphere.gasConstantAir * temperatureK);
    }

    function windComponents(windDirection, windSpeed, runwayHeading) {
        const angle = (windDirection - runwayHeading) * Math.PI / 180;
        return {
            headwindKt: windSpeed * Math.cos(angle),
            crosswindKt: windSpeed * Math.sin(angle)
        };
    }

    function stallSpeedMetersPerSecond(massKg, density, wingAreaM2, clMax, config) {
        return Math.sqrt(
            2 * massKg * config.atmosphere.gravityMPerS2 / (density * wingAreaM2 * clMax)
        );
    }

    function getTakeoffThrustN(input, config, density, flexFactor) {
        const aircraft = config.aircraft;
        const model = config.takeoff;
        const derateLbf = aircraft.derateThrustLbf[input.derate];
        const isaTemperatureC = config.atmosphere.seaLevelTemperatureC
            - config.atmosphere.temperatureLapseCPerMeter * input.elevationMeters;
        const temperatureRatio = Math.max(
            model.minimumThrustTemperatureRatio,
            1 - Math.max(0, input.oatC - isaTemperatureC) * model.thrustTemperatureLapsePerC
        );
        const densityRatio = Math.pow(density / config.atmosphere.seaLevelDensityKgM3, model.densityThrustExponent);
        const systemsFactor = (input.antiIce ? 1 - model.antiIceThrustReduction : 1)
            * (input.bleed ? 1 - model.bleedThrustReduction : 1);
        return derateLbf * config.units.newtonsPerPoundForce
            * temperatureRatio * densityRatio * systemsFactor * flexFactor;
    }

    function accelerationAtSpeed(airSpeed, input, density, thrustN, engines, config) {
        const model = config.takeoff;
        const gravity = config.atmosphere.gravityMPerS2;
        const airSpeedKt = airSpeed * config.units.knotsPerMeterPerSecond;
        const speedThrustFactor = 1 - model.thrustSpeedLossAt140Kt
            * Math.min(1, airSpeedKt / model.thrustSpeedLossReferenceKt);
        const q = 0.5 * density * airSpeed * airSpeed;
        const weight = input.weightKg * gravity;
        const lift = Math.min(
            weight * model.maxLiftWeightFraction,
            q * config.aircraft.wingAreaM2 * model.clMaxByFlaps[String(input.flaps)]
                * model.takeoffLiftFractionAtAcceleration
        );
        const qArea = Math.max(model.minimumDynamicPressureAreaM2, q * config.aircraft.wingAreaM2);
        const drag = qArea * model.dragCoefficientZeroLift
            + model.inducedDragFactor * lift * lift / qArea;
        const rolling = model.rollingFrictionBySurface[input.surface] * Math.max(0, weight - lift);
        const slopeForce = weight * input.slopePercent / 100;
        return (thrustN * speedThrustFactor * engines - drag - rolling - slopeForce) / input.weightKg;
    }

    function thrustSpeedFactor(airSpeedKt, model) {
        return 1 - model.thrustSpeedLossAt140Kt
            * Math.min(1, Math.max(0, airSpeedKt) / model.thrustSpeedLossReferenceKt);
    }

    function accelerateDistance(startAirSpeed, endAirSpeed, input, density, thrustN, engines, config) {
        const headwind = input.windComponents.headwindKt * config.units.metersPerSecondPerKnot;
        const startGroundSpeed = startAirSpeed === 0
            ? 0
            : Math.max(0, startAirSpeed - headwind);
        const endGroundSpeed = Math.max(0, endAirSpeed - headwind);
        if (endGroundSpeed <= startGroundSpeed) return { distance: 0, time: 0 };
        const step = config.takeoff.integrationStepMPerS;
        let distance = 0;
        let time = 0;
        for (let speed = startGroundSpeed; speed < endGroundSpeed;) {
            const nextSpeed = Math.min(endGroundSpeed, speed + step);
            const airSpeed = Math.max(0, (speed + nextSpeed) / 2 + headwind);
            const acceleration = accelerationAtSpeed(airSpeed, input, density, thrustN, engines, config);
            if (acceleration <= config.takeoff.minimumAccelerationMPerS2) {
                return { distance: Infinity, time: Infinity };
            }
            distance += (nextSpeed * nextSpeed - speed * speed) / (2 * acceleration);
            time += (nextSpeed - speed) / acceleration;
            speed = nextSpeed;
        }
        return { distance, time };
    }

    function takeoffDistances(input, density, thrustN, v1, vr, config) {
        const model = config.takeoff;
        const gravity = config.atmosphere.gravityMPerS2;
        const bothEngines = accelerateDistance(0, v1, input, density, thrustN, 2, config);
        const oneEngine = accelerateDistance(v1, vr, input, density, thrustN, 1, config);
        const vrGround = Math.max(
            0,
            vr - input.windComponents.headwindKt * config.units.metersPerSecondPerKnot
        );
        const goDistance = bothEngines.distance
            + vrGround * model.engineFailureDelaySeconds
            + oneEngine.distance
            + vrGround * model.rotationTimeSeconds
            + config.landing.airDistanceHeightMeters
                / Math.tan(config.landing.glideAngleDegrees * Math.PI / 180);

        const v1Ground = Math.max(
            0,
            v1 - input.windComponents.headwindKt * config.units.metersPerSecondPerKnot
        );
        const brakingCoefficient = model.brakingFrictionBySurface[input.surface];
        const deceleration = Math.max(
            model.minimumAccelerationMPerS2,
            brakingCoefficient * gravity + gravity * input.slopePercent / 100
        );
        const stopDistance = bothEngines.distance
            + v1Ground * (model.reactionTimeSeconds + model.engineFailureDelaySeconds)
            + v1Ground * v1Ground / (2 * deceleration);
        return {
            goDistance,
            stopDistance,
            accelerateToV1Distance: bothEngines.distance,
            deceleration,
            v1Ground
        };
    }

    function evaluateTakeoff(input, config, flexFactor) {
        const model = config.takeoff;
        const density = airDensity(input.elevationMeters, input.qnhHpa, input.oatC, config);
        const clMax = model.clMaxByFlaps[String(input.flaps)];
        const stallSpeed = stallSpeedMetersPerSecond(
            input.weightKg, density, config.aircraft.wingAreaM2, clMax, config
        );
        const knotsPerMeterPerSecond = config.units.knotsPerMeterPerSecond;
        let v2 = Math.max(
            model.v2Multiplier * stallSpeed,
            model.minimumV2StallRatio * stallSpeed
        );
        let vr = Math.max(
            0,
            v2 - model.vrBelowV2Kt / knotsPerMeterPerSecond
        );
        let v1;
        let trimUnits = interpolateTrim(input.cgPercentMac, input.flaps, config);
        const reference = interpolateTakeoffReference(input.weightKg, input.flaps, config);
        const baseThrustN = getTakeoffThrustN(input, config, density, flexFactor);
        if (reference) {
            v1 = reference.v1Kt / knotsPerMeterPerSecond;
            vr = reference.vrKt / knotsPerMeterPerSecond;
            v2 = reference.v2Kt / knotsPerMeterPerSecond;
            trimUnits = reference.trimUnits;
        } else {
            const maxV1 = Math.min(vr - 1 / knotsPerMeterPerSecond, v2);
            let low = Math.max(stallSpeed * model.v1MinimumSearchStallRatio, 1);
            let high = maxV1;
            for (let i = 0; i < model.v1SearchIterations; i += 1) {
                const candidate = (low + high) / 2;
                const distances = takeoffDistances(input, density, baseThrustN, candidate, vr, config);
                if (!Number.isFinite(distances.goDistance)) {
                    low = candidate;
                } else if (distances.stopDistance > distances.goDistance) {
                    high = candidate;
                } else {
                    low = candidate;
                }
            }
            const balancedV1 = (low + high) / 2;
            const surfaceReduction = model.v1ReductionKtBySurface[input.surface];
            v1 = Math.max(stallSpeed, balancedV1 - surfaceReduction / knotsPerMeterPerSecond);
        }
        const distances = takeoffDistances(input, density, baseThrustN, v1, vr, config);
        const runwayGoDistance = distances.goDistance;
        const runwayStopDistance = distances.stopDistance;
        const crosswindLimit = model.crosswindLimitKtBySurface[input.surface];
        const v2Kt = v2 * knotsPerMeterPerSecond;
        const speedFactorAtV2 = thrustSpeedFactor(v2Kt, model);
        const thrustAtV2N = baseThrustN * speedFactorAtV2;
        const oneEngineClimbGradient = thrustAtV2N * model.oeiThrustEffectiveness
            / (input.weightKg * config.atmosphere.gravityMPerS2) - model.climbDragFraction;
        const brakeEnergyJ = 0.5 * input.weightKg * distances.v1Ground * distances.v1Ground;
        const obstacleProvided = input.obstacleHeightFt !== null && input.obstacleDistanceFt !== null;
        const obstacleRequiredGradientPercent = obstacleProvided
            ? input.obstacleHeightFt * config.units.metersPerFoot
                / Math.max(1, input.toraMeters + input.obstacleDistanceFt * config.units.metersPerFoot) * 100
            : null;
        const limits = [
            {
                key: "field",
                label: "Bahnlänge",
                passed: runwayGoDistance <= Math.min(input.toraMeters, input.todaMeters)
                    && runwayStopDistance <= input.asdaMeters
            },
            {
                key: "climb",
                label: "Steiggradient (ein Triebwerk)",
                passed: oneEngineClimbGradient >= model.minimumOeiClimbGradient
            },
            {
                key: "brakes",
                label: "Bremsenergie",
                passed: brakeEnergyJ <= model.brakeEnergyLimitJ
            },
            {
                key: "crosswind",
                label: "Seitenwind",
                passed: Math.abs(input.windComponents.crosswindKt) <= crosswindLimit
            }
        ];
        if (obstacleProvided) {
            limits.push({
                key: "obstacle",
                label: "Hindernis",
                passed: oneEngineClimbGradient * 100 >= obstacleRequiredGradientPercent
            });
        }
        const margins = [
            Math.min(
                input.toraMeters - runwayGoDistance,
                input.todaMeters - runwayGoDistance,
                input.asdaMeters - runwayStopDistance
            ) / Math.max(1, Math.min(input.toraMeters, input.todaMeters, input.asdaMeters)),
            (oneEngineClimbGradient - model.minimumOeiClimbGradient) / model.minimumOeiClimbGradient,
            (model.brakeEnergyLimitJ - brakeEnergyJ) / model.brakeEnergyLimitJ,
            (crosswindLimit - Math.abs(input.windComponents.crosswindKt)) / crosswindLimit
        ];
        const marginLabels = limits.map((limit) => limit.label);
        if (obstacleProvided) {
            margins.push(
                (oneEngineClimbGradient * 100 - obstacleRequiredGradientPercent)
                    / Math.max(0.1, obstacleRequiredGradientPercent)
            );
            marginLabels.push("Hindernis");
        }
        const firstFailedLimit = limits.find((limit) => !limit.passed);
        const minimumMarginIndex = margins.indexOf(Math.min(...margins));
        const limitingFactor = firstFailedLimit
            ? firstFailedLimit.label
            : margins[minimumMarginIndex] < 0.1
                ? marginLabels[minimumMarginIndex]
                : "Keine Limits überschritten";
        return {
            pressureAltitudeFt: pressureAltitudeFeet(input.elevationMeters, input.qnhHpa, config),
            densityKgM3: density,
            densityRatio: density / config.atmosphere.seaLevelDensityKgM3,
            stallSpeedKt: stallSpeed * knotsPerMeterPerSecond,
            v1Kt: v1 * knotsPerMeterPerSecond,
            vrKt: vr * knotsPerMeterPerSecond,
            v2Kt,
            takeoffDistanceMeters: runwayGoDistance,
            accelerateStopDistanceMeters: runwayStopDistance,
            runwayReserveMeters: Math.min(
                input.toraMeters - runwayGoDistance,
                input.todaMeters - runwayGoDistance,
                input.asdaMeters - runwayStopDistance
            ),
            availableRunwayMeters: Math.min(input.toraMeters, input.todaMeters, input.asdaMeters),
            climbGradientPercent: oneEngineClimbGradient * 100,
            brakeEnergyMj: brakeEnergyJ / 1000000,
            obstacleRequiredGradientPercent,
            calibrationApplied: Boolean(reference),
            crosswindKt: input.windComponents.crosswindKt,
            headwindKt: input.windComponents.headwindKt,
            thrustN: thrustAtV2N,
            thrustSpeedFactor: speedFactorAtV2,
            limits,
            limitingFactor,
            trimUnits
        };
    }

    function calculateTakeoff(rawInput, config) {
        const plausibility = config.takeoff.plausibility;
        const elevationMeters = numberInRange(rawInput, "elevationMeters", -500, plausibility.inputMaximumElevationFt * config.units.metersPerFoot);
        const input = {
            elevationMeters,
            qnhHpa: numberInRange(
                rawInput,
                "qnhHpa",
                plausibility.inputMinimumQnhHpa,
                plausibility.inputMaximumQnhHpa
            ),
            oatC: numberInRange(rawInput, "oatC", -60, 60),
            toraMeters: numberInRange(
                rawInput, "toraMeters",
                plausibility.inputMinimumRunwayMeters, plausibility.inputMaximumRunwayMeters
            ),
            todaMeters: numberInRange(
                rawInput, "todaMeters",
                plausibility.inputMinimumRunwayMeters, plausibility.inputMaximumRunwayMeters
            ),
            asdaMeters: numberInRange(
                rawInput, "asdaMeters",
                plausibility.inputMinimumRunwayMeters, plausibility.inputMaximumRunwayMeters
            ),
            slopePercent: numberInRange(
                rawInput, "slopePercent",
                -plausibility.inputMaximumSlopePercent, plausibility.inputMaximumSlopePercent
            ),
            windDirection: numberInRange(rawInput, "windDirection", 0, 360),
            windSpeedKt: numberInRange(rawInput, "windSpeedKt", 0, 100),
            runwayHeading: numberInRange(rawInput, "runwayHeading", 0, 360),
            surface: rawInput.surface,
            weightKg: numberInRange(
                rawInput, "weightKg",
                plausibility.inputMinimumWeightKg, plausibility.inputMaximumWeightKg
            ),
            cgPercentMac: numberInRange(
                rawInput, "cgPercentMac",
                config.takeoff.cgRangePercentMac.minimum,
                config.takeoff.cgRangePercentMac.maximum
            ),
            obstacleHeightFt: rawInput.obstacleHeightFt === null || rawInput.obstacleHeightFt === undefined
                || rawInput.obstacleHeightFt === ""
                ? null : numberInRange(rawInput, "obstacleHeightFt", 0, 20000),
            obstacleDistanceFt: rawInput.obstacleDistanceFt === null || rawInput.obstacleDistanceFt === undefined
                || rawInput.obstacleDistanceFt === ""
                ? null : numberInRange(rawInput, "obstacleDistanceFt", 0, 100000),
            flaps: String(rawInput.flaps),
            derate: rawInput.derate,
            antiIce: Boolean(rawInput.antiIce),
            bleed: Boolean(rawInput.bleed)
        };
        if (!Object.hasOwn(config.takeoff.clMaxByFlaps, input.flaps)) {
            throw new ValidationError(["Startklappen müssen 1, 5 oder 15 sein."]);
        }
        if (!Object.hasOwn(config.aircraft.derateThrustLbf, input.derate)) {
            throw new ValidationError(["Bitte einen gültigen Schubmodus auswählen."]);
        }
        if (!Object.hasOwn(config.takeoff.rollingFrictionBySurface, input.surface)) {
            throw new ValidationError(["Bitte einen gültigen Bahnzustand auswählen."]);
        }
        if ((input.obstacleHeightFt === null) !== (input.obstacleDistanceFt === null)) {
            throw new ValidationError(["Hindernishöhe und Hindernisabstand müssen gemeinsam angegeben werden."]);
        }
        input.windComponents = windComponents(input.windDirection, input.windSpeedKt, input.runwayHeading);

        const baseFlexFactor = 1;
        const result = evaluateTakeoff(input, config, baseFlexFactor);
        const minimumFlexFactor = Math.max(
            1 - config.takeoff.maxFlexThrustReduction,
            config.aircraft.derateThrustLbf["TO-2"] / config.aircraft.derateThrustLbf[input.derate]
        );
        let flexTemperatureC = input.oatC;
        let flexFactor = 1;
        if (input.derate !== "TO" && result.limits.every((limit) => limit.passed)) {
            const maxDelta = Math.ceil((1 - minimumFlexFactor) / config.takeoff.flexThrustReductionPerDegreeC);
            for (let delta = 1; delta <= maxDelta; delta += 1) {
                const candidateFactor = Math.max(
                    minimumFlexFactor,
                    1 - delta * config.takeoff.flexThrustReductionPerDegreeC
                );
                const candidate = evaluateTakeoff(input, config, candidateFactor);
                if (!candidate.limits.every((limit) => limit.passed)) break;
                flexTemperatureC = input.oatC + delta;
                flexFactor = candidateFactor;
            }
        }
        const finalResult = flexFactor < 1 ? evaluateTakeoff(input, config, flexFactor) : result;
        const warnings = finalResult.limits.filter((limit) => !limit.passed).map((limit) => limit.label + " limit überschritten.");
        if (pressureAltitudeFeet(elevationMeters, input.qnhHpa, config) > config.aircraft.maxOperatingElevationFt) {
            warnings.push("Platzhöhe über dem konfigurierten Start-Betriebslimit.");
        }
        if (elevationMeters / config.units.metersPerFoot > plausibility.maximumElevationFt) {
            warnings.push("Flughafenhöhe über 10.000 ft.");
        }
        if ([input.toraMeters, input.todaMeters, input.asdaMeters].some((length) =>
            length < plausibility.minimumRunwayMeters || length > plausibility.maximumRunwayMeters
        )) warnings.push("Bahnlänge außerhalb 800 bis 6.000 m.");
        if (Math.abs(input.slopePercent) > plausibility.maximumSlopePercent) {
            warnings.push("Bahnneigung größer als ±2 %.");
        }
        if (input.todaMeters < input.toraMeters || input.asdaMeters < input.toraMeters) {
            warnings.push("TODA oder ASDA kürzer als TORA; deklarierte Bahndistanzen prüfen.");
        }
        if (input.qnhHpa < plausibility.minimumQnhHpa || input.qnhHpa > plausibility.maximumQnhHpa) {
            warnings.push("QNH außerhalb 940 bis 1.060 hPa.");
        }
        if (input.weightKg < plausibility.minimumWeightKg) warnings.push("Startgewicht unter 40.000 kg.");
        if (input.weightKg > config.aircraft.mtowKg) warnings.push("MTOW überschritten.");
        return {
            ...finalResult,
            flexTemperatureC,
            derate: input.derate,
            warnings
        };
    }

    function calculateLanding(rawInput, config) {
        const elevationMeters = numberInRange(rawInput, "elevationMeters", -500, config.aircraft.maxOperatingElevationFt * config.units.metersPerFoot);
        const input = {
            elevationMeters,
            qnhHpa: numberInRange(rawInput, "qnhHpa", 870, 1085),
            oatC: numberInRange(rawInput, "oatC", -60, 60),
            ldaMeters: numberAtLeast(rawInput, "ldaMeters", 100),
            slopePercent: numberInRange(rawInput, "slopePercent", -3, 3),
            windDirection: numberInRange(rawInput, "windDirection", 0, 360),
            windSpeedKt: numberInRange(rawInput, "windSpeedKt", 0, 100),
            gustKt: numberInRange(rawInput, "gustKt", 0, 60),
            runwayHeading: numberInRange(rawInput, "runwayHeading", 0, 360),
            surface: rawInput.surface,
            weightKg: numberInRange(rawInput, "weightKg", config.aircraft.oewKg, config.aircraft.mtowKg),
            measuredBrakingDistanceMeters: optionalNumberInRange(
                rawInput, "measuredBrakingDistanceMeters", 0, 100000
            ),
            measuredVrefKt: optionalNumberInRange(rawInput, "measuredVrefKt", 0, 250),
            flaps: String(rawInput.flaps),
            autobrake: String(rawInput.autobrake),
            reverseThrust: Boolean(rawInput.reverseThrust)
        };
        if (!Object.hasOwn(config.landing.clMaxByFlaps, input.flaps)) {
            throw new ValidationError(["Landeklappen müssen 30 oder 40 sein."]);
        }
        const allAutobrakes = input.autobrake === "all";
        const autobrakeSettings = Object.keys(config.landing.autobrakeDecelerationMPerS2);
        if (!allAutobrakes && !Object.hasOwn(config.landing.autobrakeDecelerationMPerS2, input.autobrake)) {
            throw new ValidationError(["Bitte eine gültige Autobrake-Stufe auswählen."]);
        }
        if (!Object.hasOwn(config.landing.decelerationFactorBySurface, input.surface)) {
            throw new ValidationError(["Bitte einen gültigen Bahnzustand auswählen."]);
        }
        const winds = windComponents(input.windDirection, input.windSpeedKt, input.runwayHeading);
        const density = airDensity(input.elevationMeters, input.qnhHpa, input.oatC, config);
        const stallSpeed = stallSpeedMetersPerSecond(
            input.weightKg, density, config.aircraft.wingAreaM2,
            config.landing.clMaxByFlaps[input.flaps], config
        );
        const vref = config.landing.vrefStallRatio * stallSpeed;
        const windCorrection = Math.min(
            config.landing.maximumWindCorrectionKt,
            Math.max(
                config.landing.minimumWindCorrectionKt,
                Math.max(0, winds.headwindKt) * 0.5 + input.gustKt
            )
        );
        const vapp = vref * config.units.knotsPerMeterPerSecond + windCorrection;
        const vGround = Math.max(
            0,
            (vapp - winds.headwindKt) * config.units.metersPerSecondPerKnot
        );
        const airDistance = config.landing.airDistanceHeightMeters
            / Math.tan(config.landing.glideAngleDegrees * Math.PI / 180)
            + vapp * config.units.metersPerSecondPerKnot * config.landing.flareTimeSeconds;
        let safetyFactor = config.landing.dispatchFactorDry;
        if (input.surface === "wet") safetyFactor *= config.landing.additionalFactorWet;
        if (input.surface === "contaminated") safetyFactor *= config.landing.additionalFactorContaminated;
        const scenarios = autobrakeSettings.map((setting) => {
            const requestedDeceleration = config.landing.autobrakeDecelerationMPerS2[setting]
                * config.landing.decelerationFactorBySurface[input.surface]
                + config.atmosphere.gravityMPerS2 * input.slopePercent / 100;
            const deceleration = Math.max(
                config.landing.minimumDecelerationMPerS2,
                requestedDeceleration
            );
            let brakingDistance = vGround * vGround / (2 * deceleration);
            if (input.reverseThrust) {
                brakingDistance *= 1 - config.landing.reverseThrustDistanceReductionBySurface[input.surface];
            }
            const rawDistance = airDistance + brakingDistance;
            const factoredDistance = rawDistance * safetyFactor;
            return {
                autobrake: setting,
                decelerationMPerS2: deceleration,
                brakingDistanceMeters: brakingDistance,
                measuredBrakingDistanceDifferenceMeters: input.measuredBrakingDistanceMeters === null
                    ? null
                    : brakingDistance - input.measuredBrakingDistanceMeters,
                rawDistanceMeters: rawDistance,
                factoredDistanceMeters: factoredDistance,
                runwayReserveMeters: input.ldaMeters - factoredDistance,
                runwayPassed: factoredDistance <= input.ldaMeters
            };
        });
        const selectedScenarios = allAutobrakes
            ? scenarios
            : scenarios.filter((scenario) => scenario.autobrake === input.autobrake);
        const selectedScenario = selectedScenarios[0];
        const recommendedAutobrake = scenarios.find((scenario) => scenario.runwayPassed)?.autobrake || null;
        const runwayPassed = allAutobrakes
            ? scenarios.some((scenario) => scenario.runwayPassed)
            : selectedScenario.runwayPassed;
        const limits = [
            { key: "weight", label: "Landegewicht (MLW)", passed: input.weightKg <= config.aircraft.mlwKg },
            { key: "runway", label: "Landestrecke mit Sicherheitsfaktor", passed: runwayPassed },
            {
                key: "goAround",
                label: "Durchstart-Steiggradient",
                passed: config.landing.goAroundClimbGradient >= config.landing.minimumGoAroundClimbGradient
            }
        ];
        const warnings = limits.filter((limit) => !limit.passed).map((limit) => limit.label + " Limit überschritten.");
        const plausibility = config.landing.plausibility;
        if (input.ldaMeters < plausibility.minimumLdaMeters
            || input.ldaMeters > plausibility.maximumLdaMeters) {
            warnings.push("LDA außerhalb 800 bis 5.000 m.");
        }
        if (Math.abs(input.slopePercent) > plausibility.maximumSlopePercent) {
            warnings.push("Bahnneigung größer als ±2 %.");
        }
        const crosswindLimitKt = config.landing.crosswindLimitKtBySurface[input.surface];
        if (Math.abs(winds.crosswindKt) > crosswindLimitKt) {
            warnings.push("Seitenwindlimit von " + crosswindLimitKt + " kt für "
                + (input.surface === "dry" ? "trockene" : input.surface === "wet" ? "nasse" : "kontaminierte")
                + " Bahn überschritten.");
        }
        const runwayMarginScenario = allAutobrakes
            ? scenarios.find((scenario) => scenario.autobrake === recommendedAutobrake)
            : selectedScenario;
        const margins = [
            {
                limit: limits[1],
                margin: runwayMarginScenario
                    ? runwayMarginScenario.runwayReserveMeters / input.ldaMeters
                    : -1
            },
            {
                limit: limits[2],
                margin: (config.landing.goAroundClimbGradient - config.landing.minimumGoAroundClimbGradient)
                    / config.landing.minimumGoAroundClimbGradient
            }
        ];
        const tightestMargin = margins.reduce((tightest, current) =>
            current.margin < tightest.margin ? current : tightest
        );
        const firstFailedLimit = limits.find((limit) => !limit.passed);
        const limitingFactor = firstFailedLimit
            ? firstFailedLimit.label
            : tightestMargin.margin < 0.1
                ? tightestMargin.limit.label
                : "Keine Limits überschritten";
        return {
            pressureAltitudeFt: pressureAltitudeFeet(input.elevationMeters, input.qnhHpa, config),
            densityKgM3: density,
            vrefKt: vref * config.units.knotsPerMeterPerSecond,
            vrefDifferenceKt: input.measuredVrefKt === null
                ? null
                : vref * config.units.knotsPerMeterPerSecond - input.measuredVrefKt,
            vappKt: vapp,
            windCorrectionKt: windCorrection,
            airDistanceMeters: airDistance,
            brakingDistanceMeters: selectedScenario.brakingDistanceMeters,
            rawDistanceMeters: selectedScenario.rawDistanceMeters,
            factoredDistanceMeters: selectedScenario.factoredDistanceMeters,
            runwayReserveMeters: selectedScenario.runwayReserveMeters,
            safetyFactor,
            autobrake: input.autobrake,
            recommendedAutobrake,
            reverseThrust: input.reverseThrust,
            ldaMeters: input.ldaMeters,
            allAutobrakes,
            scenarios: selectedScenarios,
            limits,
            limitingFactor,
            warnings
        };
    }

    function interpolateFuelProfile(altitudeFt, profiles) {
        const upperIndex = profiles.findIndex((profile) => profile.altitudeFt >= altitudeFt);
        if (upperIndex <= 0) return profiles[Math.max(0, upperIndex)];
        const lower = profiles[upperIndex - 1];
        const upper = profiles[upperIndex];
        const fraction = (altitudeFt - lower.altitudeFt) / (upper.altitudeFt - lower.altitudeFt);
        const result = { altitudeFt };
        Object.keys(lower).forEach((key) => {
            if (key !== "altitudeFt") {
                result[key] = lower[key] + (upper[key] - lower[key]) * fraction;
            }
        });
        return result;
    }

    function alternateCruiseAltitude(distanceNm, model) {
        const points = model.alternateAltitudeByDistanceNm;
        const upperIndex = points.findIndex((point) => point.distanceNm >= distanceNm);
        if (upperIndex <= 0) return points[Math.max(0, upperIndex)].altitudeFt;
        const lower = points[upperIndex - 1];
        const upper = points[upperIndex];
        const fraction = (distanceNm - lower.distanceNm) / (upper.distanceNm - lower.distanceNm);
        return lower.altitudeFt + (upper.altitudeFt - lower.altitudeFt) * fraction;
    }

    function calculateFuelRoute(distanceNm, requestedAltitudeFt, weightKg, input, model) {
        const profiles = model.phaseProfiles;
        const maximumAltitudeFt = model.maxCruiseAltitudeFt;
        const targetAltitudeFt = Math.min(requestedAltitudeFt, maximumAltitudeFt);
        let profile = interpolateFuelProfile(targetAltitudeFt, profiles);
        let altitudeReduced = targetAltitudeFt < requestedAltitudeFt;

        if (profile.climbDistanceNm + profile.descentDistanceNm > distanceNm) {
            let low = 0;
            let high = targetAltitudeFt;
            for (let iteration = 0; iteration < model.altitudeSearchIterations; iteration += 1) {
                const middle = (low + high) / 2;
                const candidate = interpolateFuelProfile(middle, profiles);
                if (candidate.climbDistanceNm + candidate.descentDistanceNm <= distanceNm) low = middle;
                else high = middle;
            }
            profile = interpolateFuelProfile(low, profiles);
            altitudeReduced = true;
        }

        const climbDistanceNm = profile.climbDistanceNm;
        const descentDistanceNm = profile.descentDistanceNm;
        const cruiseDistanceNm = Math.max(0, distanceNm - climbDistanceNm - descentDistanceNm);
        const weightFactor = Math.max(
            model.minimumFuelFactor,
            1 + (weightKg - model.cruiseReferenceWeightKg) / 1000 * model.weightChangePer1000Kg
        );
        const isaFactor = Math.max(
            model.minimumFuelFactor,
            1 + input.isaDeviationC * model.cruiseBurnChangePerIsaC
        );
        const costIndexFactor = Math.max(
            model.minimumFuelFactor,
            1 + (input.costIndex - model.referenceCostIndex) * model.cruiseBurnChangePerCostIndex
        );
        const cruiseTasKt = Math.max(
            0,
            profile.cruiseTasKt
                + (input.costIndex - model.referenceCostIndex) * model.cruiseTasChangeKtPerCostIndex
                + input.isaDeviationC * model.cruiseTasChangeKtPerIsaC
        );
        const cruiseGroundspeedKt = cruiseDistanceNm > 0
            ? Math.max(model.minimumGroundspeedKt, cruiseTasKt + input.windComponentKt)
            : 0;
        const cruiseTimeMinutes = cruiseGroundspeedKt > 0
            ? cruiseDistanceNm / cruiseGroundspeedKt * 60
            : 0;
        const cruiseBurnKgPerHour = profile.cruiseBurnKgPerHour
            * weightFactor * isaFactor * costIndexFactor;
        const fuelAdjustment = (input.antiIce ? model.antiIceFuelFactor : 1)
            * (input.weatherFuel ? model.weatherFuelFactor : 1);
        const climbFuelKg = profile.climbFuelKg * weightFactor * fuelAdjustment;
        const cruiseFuelKg = cruiseTimeMinutes / 60 * cruiseBurnKgPerHour * fuelAdjustment;
        const descentFuelKg = profile.descentFuelKg * weightFactor * fuelAdjustment;

        return {
            requestedAltitudeFt,
            cruiseAltitudeFt: profile.altitudeFt,
            altitudeReduced,
            climb: {
                fuelKg: climbFuelKg,
                timeMinutes: profile.climbTimeMinutes,
                distanceNm: climbDistanceNm
            },
            cruise: {
                fuelKg: cruiseFuelKg,
                timeMinutes: cruiseTimeMinutes,
                distanceNm: cruiseDistanceNm,
                tasKt: cruiseTasKt,
                groundspeedKt: cruiseGroundspeedKt
            },
            descent: {
                fuelKg: descentFuelKg,
                timeMinutes: profile.descentTimeMinutes,
                distanceNm: descentDistanceNm
            },
            fuelKg: climbFuelKg + cruiseFuelKg + descentFuelKg,
            timeMinutes: profile.climbTimeMinutes + cruiseTimeMinutes + profile.descentTimeMinutes
        };
    }

    function calculateFuel(rawInput, config) {
        const model = config.fuel;
        const input = {
            distanceNm: numberInRange(rawInput, "distanceNm", 1, 10000),
            cruiseAltitudeFt: numberInRange(rawInput, "cruiseAltitudeFt", 0, model.maxCruiseAltitudeFt),
            windComponentKt: numberInRange(rawInput, "windComponentKt", -200, 200),
            isaDeviationC: numberInRange(rawInput, "isaDeviationC", -30, 30),
            costIndex: numberInRange(rawInput, "costIndex", 0, 200),
            zfwKg: numberInRange(rawInput, "zfwKg", config.aircraft.oewKg, model.maxZfwInputKg),
            zfwCgPercentMac: numberInRange(rawInput, "zfwCgPercentMac", 20, 40),
            apuEnabled: Boolean(rawInput.apuEnabled),
            apuMinutes: numberInRange(rawInput, "apuMinutes", 0, 240),
            antiIce: Boolean(rawInput.antiIce),
            weatherFuel: Boolean(rawInput.weatherFuel),
            alternateNm: numberInRange(rawInput, "alternateNm", 0, 5000),
            taxiMinutes: numberInRange(rawInput, "taxiMinutes", 0, 120),
            contingencyPercent: numberInRange(rawInput, "contingencyPercent", 0, 25),
            extraFuelKg: numberInRange(rawInput, "extraFuelKg", 0, config.aircraft.fuelCapacityKg)
        };
        const taxiFuelKg = input.taxiMinutes * model.taxiBurnKgPerMinute;
        const apuFuelKg = input.apuEnabled ? input.apuMinutes * model.apuBurnKgPerMinute : 0;
        const finalReserveFuelKg = model.finalReserveMinutes / 60 * model.holdingBurnKgPerHour;
        let assumedTakeoffWeightKg = input.zfwKg + finalReserveFuelKg
            + input.extraFuelKg + model.initialFuelEstimateKg;
        let calculation;
        let iterations = 0;

        for (let index = 0; index < model.fuelIterationCount; index += 1) {
            const trip = calculateFuelRoute(
                input.distanceNm,
                input.cruiseAltitudeFt,
                assumedTakeoffWeightKg,
                input,
                model
            );
            const alternate = calculateFuelRoute(
                input.alternateNm,
                alternateCruiseAltitude(input.alternateNm, model),
                assumedTakeoffWeightKg,
                input,
                model
            );
            const contingencyFuelKg = Math.max(
                trip.fuelKg * input.contingencyPercent / 100,
                model.minimumContingencyHoldingMinutes / 60 * model.holdingBurnKgPerHour
            );
            const blockFuelKg = taxiFuelKg + apuFuelKg + trip.fuelKg + contingencyFuelKg
                + alternate.fuelKg + finalReserveFuelKg + input.extraFuelKg;
            const takeoffWeightKg = input.zfwKg + blockFuelKg - taxiFuelKg - apuFuelKg;
            const landingWeightKg = takeoffWeightKg - trip.fuelKg;
            calculation = {
                trip,
                alternate,
                contingencyFuelKg,
                blockFuelKg,
                takeoffWeightKg,
                landingWeightKg
            };
            iterations = index + 1;
            if (Math.abs(takeoffWeightKg - assumedTakeoffWeightKg) <= model.fuelIterationToleranceKg) break;
            assumedTakeoffWeightKg = takeoffWeightKg;
        }

        const warnings = [];
        if (calculation.trip.altitudeReduced) {
            warnings.push("Reiseflughöhe für die kurze Strecke automatisch auf "
                + Math.round(calculation.trip.cruiseAltitudeFt) + " ft reduziert.");
        }
        if (calculation.alternate.altitudeReduced) {
            warnings.push("Reiseflughöhe für den Alternate automatisch auf "
                + Math.round(calculation.alternate.cruiseAltitudeFt) + " ft reduziert.");
        }
        if (calculation.blockFuelKg > config.aircraft.fuelCapacityKg) warnings.push("Tankkapazität überschritten.");
        if (calculation.takeoffWeightKg > model.weightLimitsKg.mtow) warnings.push("MTOW beim Start überschritten.");
        if (calculation.landingWeightKg > config.aircraft.mlwKg) warnings.push("MLW bei der Landung überschritten.");
        if (input.zfwKg > model.weightLimitsKg.mzfw) warnings.push("MZFW überschritten.");
        const fuelCgPercentMac = model.effectiveFuelCgPercentMac;
        const takeoffFuelKg = calculation.takeoffWeightKg - input.zfwKg;
        const landingFuelKg = calculation.landingWeightKg - input.zfwKg;
        const takeoffCgPercentMac = (
            input.zfwKg * input.zfwCgPercentMac + takeoffFuelKg * fuelCgPercentMac
        ) / calculation.takeoffWeightKg;
        const landingCgPercentMac = (
            input.zfwKg * input.zfwCgPercentMac + landingFuelKg * fuelCgPercentMac
        ) / calculation.landingWeightKg;

        return {
            zfwKg: input.zfwKg,
            alternateRequestedAltitudeFt: alternateCruiseAltitude(input.alternateNm, model),
            zfwCgPercentMac: input.zfwCgPercentMac,
            fuelCgPercentMac,
            takeoffCgPercentMac,
            landingCgPercentMac,
            iterations,
            taxiFuelKg,
            apuFuelKg,
            tripFuelKg: calculation.trip.fuelKg,
            climbFuelKg: calculation.trip.climb.fuelKg,
            cruiseFuelKg: calculation.trip.cruise.fuelKg,
            descentFuelKg: calculation.trip.descent.fuelKg,
            phases: calculation.trip,
            alternateFuelKg: calculation.alternate.fuelKg,
            alternatePhases: calculation.alternate,
            contingencyFuelKg: calculation.contingencyFuelKg,
            contingencyMinimumKg: model.minimumContingencyHoldingMinutes / 60 * model.holdingBurnKgPerHour,
            finalReserveFuelKg,
            finalReserveHoldingAltitudeFt: model.finalReserveHoldingAltitudeFt,
            extraFuelKg: input.extraFuelKg,
            blockFuelKg: calculation.blockFuelKg,
            takeoffWeightKg: calculation.takeoffWeightKg,
            landingWeightKg: calculation.landingWeightKg,
            cruiseGroundspeedKt: calculation.trip.cruise.groundspeedKt,
            flightTimeMinutes: calculation.trip.timeMinutes,
            alternateTimeMinutes: calculation.alternate.timeMinutes,
            iterations,
            warnings
        };
    }

    function convertUnit(value, unit, direction, config) {
        if (direction === "toMetric") {
            if (unit === "lb") return value * config.units.kgPerLb;
            if (unit === "ft") return value * config.units.metersPerFoot;
            if (unit === "inHg") return value * config.units.hPaPerInHg;
        } else {
            if (unit === "lb") return value / config.units.kgPerLb;
            if (unit === "ft") return value / config.units.metersPerFoot;
            if (unit === "inHg") return value / config.units.hPaPerInHg;
        }
        return value;
    }

    return {
        ValidationError,
        airDensity,
        pressureAltitudeFeet,
        windComponents,
        stallSpeedMetersPerSecond,
        interpolateTrim,
        calculateTakeoff,
        calculateLanding,
        calculateFuel,
        convertUnit
    };
});
