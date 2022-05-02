/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as typings from "../../typings";
import * as ddcsControllers from "../";
import {getCenterOfPoly} from "../";

const warbondStrategicTypes = [
    "REFINERY",
    "OILFIELD",
    "OFFSHOREPLATFORM",
    "MUNITIONSFACTORY"
];

export async function buildStrategicBase(buildUnit: typings.IUnit, curPlayer: typings.ISrvPlayers): Promise<boolean> {
    let curConstructionType = "CV_59_NS60";
    const unitInternal = await ddcsControllers.unitActionRead({unitId: buildUnit.unitId});

    const deltaAGL = Math.abs(buildUnit.agl - unitInternal[0].agl);
    const lonLatStart = buildUnit.lonLatLoc;
    const lonLatEnd = unitInternal[0].lonLatLoc;
    const distanceMovedXZ = ddcsControllers.calcDirectDistanceInKm(lonLatStart[1], lonLatStart[0], lonLatEnd[1], lonLatEnd[0]) * 1000;

    const curEnteredPoly = await getPlayerInStrategicPoly(buildUnit, curPlayer);
    const strategicConstructionUnits = await ddcsControllers.unitActionRead({
        _id: new RegExp(curEnteredPoly._id + "_CONSTRUCTION"),
        dead: false
    });

    if (strategicConstructionUnits.length > 0 &&
        (unitInternal[0].speed > 0.3 || distanceMovedXZ > 1 || deltaAGL > 1 || unitInternal[0].dead)) {
        await ddcsControllers.sendMesgToGroup(
            curPlayer,
            unitInternal[0].groupId,
            "G: You were unable to unload your internal cargo, please remain still until it has unloaded.",
            5
        );
        return false;
    } else if (!unitInternal[0].intCargoType) {
        console.log("You no longer have crate onboard ", curPlayer.name);
        await ddcsControllers.sendMesgToGroup(
            curPlayer,
            unitInternal[0].groupId,
            "G: You no longer have an internal crate loaded",
            5
        );
        return false;
    } else {
        if (Object.keys(curEnteredPoly).length === 0) {
            console.log("User is not in a StrategicPoly: ", curPlayer.name);
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                buildUnit.groupId,
                "G: You are not in a Strategic Building Area.",
                5
            );
            return false;
        } else {
            if (await ddcsControllers.isTroopOnboard(unitInternal[0])) {
                await ddcsControllers.setInternalCargoMass(unitInternal[0].name, 1000);
            } else {
                await ddcsControllers.setInternalCargoMass(unitInternal[0].name, 0);
            }

            const strategicUnits = await ddcsControllers.unitActionRead({_id: new RegExp(curEnteredPoly._id + "_MAIN"), dead: false});
            // strategy point still exists - dismantle and rebuild construction unit if your side owns it,
            if (strategicUnits.length > 0) {
                // if it doesn't own it stop construction
                if (buildUnit.coalition !== strategicUnits[0].coalition) {
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        buildUnit.groupId,
                        "G: Strategic Point is owned by " + ddcsControllers.side[strategicUnits[0].coalition] + ", you must kill all the units at the point and rebuilt the point to capture it!",
                        10
                    );
                    return false;
                } else {
                    const constructionBuildings =
                        ddcsControllers.getRndFromSpawnCat(
                            curEnteredPoly.strategicType + "_CONSTRUCTION",
                            buildUnit.coalition,
                            true,
                            true
                        );

                    if (constructionBuildings && constructionBuildings.length > 0) {
                        const sampleBuildings = _.sample(constructionBuildings);
                        if (sampleBuildings) {
                            curConstructionType = sampleBuildings.type;
                        }
                    }

                    for (const strategicUnit of strategicUnits) {
                        await ddcsControllers.destroyUnit(strategicUnit._id, "static");
                    }

                    await ddcsControllers.spawnStaticBuilding({
                        _id: "|" + curEnteredPoly._id + "_CONSTRUCTION|" + curEnteredPoly.polyId + "|",
                        lonLatLoc: ddcsControllers.getRandomLatLonFromStrategicPoly(curEnteredPoly.polygonPoints[curEnteredPoly.polyId]),
                        strategicBuildProgress: 1
                    } as typings.IStaticSpawnMin, buildUnit.coalition, curConstructionType, true);

                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        buildUnit.groupId,
                        "G: Restarting Construction of Strategic Point, Old Buildings have been Demolished.",
                        10
                    );
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        buildUnit.groupId,
                        "G: Construction started at the " + curEnteredPoly._id + ", Construction will require " +
                        curEnteredPoly.details.crateCost + " internal Crates to Build",
                        10
                    );
                    return true;
                }
            } else {
                // strategy point doesn't exist, check for construction unit
                if (strategicConstructionUnits.length > 0) {
                    if ((strategicConstructionUnits[0].strategicBuildProgress + 1) >=  curEnteredPoly.details.crateCost) {
                        // delete construction and build real buildings
                        await ddcsControllers.unitActionUpdate({
                            _id: strategicConstructionUnits[0]._id,
                            strategicBuildProgress: 1
                        });
                        // console.log("remove construction: ", strategicConstructionUnits);
                        // remove after delay, don't delete ship you helicopter is sitting on
                        setTimeout(async () => {
                            await ddcsControllers.destroyUnit(strategicConstructionUnits[0]._id, "static");
                        }, (5 * 60 * 1000)); // despawn construction ship in 5 minutes

                        // spawn strategic pattern types
                        switch (curEnteredPoly.strategicType) {
                            case "REFINERY":
                                await buildGridStrategic(curEnteredPoly, buildUnit, strategicConstructionUnits[0].lonLatLoc, 10, 0.08);
                                break;
                            case "MUNITIONSFACTORY":
                                await buildGridStrategic(curEnteredPoly, buildUnit, strategicConstructionUnits[0].lonLatLoc, 10, 0.16);
                                break;
                            case "OILFIELD":
                                await buildOilFieldStrategic(curEnteredPoly, buildUnit, 0.05, 3);
                                break;
                            default:
                                await buildFullSpreadStrategic(curEnteredPoly, buildUnit, 10);
                        }

                        setTimeout(() => ddcsControllers.setStrategicPointPolyOwnership(curEnteredPoly), 5000);
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            buildUnit.groupId,
                            "G: Strategic Point Has been built with " + curEnteredPoly.details.spawnBuildingAmount + " Buildings",
                            10
                        );
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            buildUnit.groupId,
                            "G: De-spawning construction equipment in 5 minutes",
                            10
                        );
                        return true;
                    } else {
                        await ddcsControllers.unitActionUpdate({
                            _id: strategicConstructionUnits[0]._id,
                            strategicBuildProgress: strategicConstructionUnits[0].strategicBuildProgress + 1}
                        );
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            buildUnit.groupId,
                            curEnteredPoly._id + " now has " +
                            (strategicConstructionUnits[0].strategicBuildProgress + 1) + "/" +
                            curEnteredPoly.details.crateCost + " supplies.",
                            10
                        );
                        return true;
                    }
                } else {
                    const constructionBuildings =
                        ddcsControllers.getRndFromSpawnCat(
                            curEnteredPoly.strategicType + "_CONSTRUCTION",
                            buildUnit.coalition,
                            true,
                            true
                        );

                    if (constructionBuildings && constructionBuildings.length > 0) {
                        const sampleBuildings = _.sample(constructionBuildings);
                        if (sampleBuildings) {
                            curConstructionType = sampleBuildings.type;
                        }
                    }

                    // construction unit doesn't exist, build new construction building
                    await ddcsControllers.spawnStaticBuilding({
                        _id: "|" + curEnteredPoly._id + "_CONSTRUCTION|" + curEnteredPoly.polyId + "|",
                        lonLatLoc: ddcsControllers.getRandomLatLonFromStrategicPoly(curEnteredPoly.polygonPoints[curEnteredPoly.polyId]),
                        strategicBuildProgress: 1
                    } as typings.IStaticSpawnMin, buildUnit.coalition, curConstructionType, true);
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        buildUnit.groupId,
                        "G: Construction started at the " + curEnteredPoly._id + ", Construction will require " +
                        curEnteredPoly.details.crateCost + " internal Crates to Build",
                        10
                    );
                    return true;
                }
            }
        }
    }
}

export async function buildOilFieldStrategic(
    curEnteredPoly: any,
    buildUnit: any,
    pumpDistance: number,
    pumpsPerDerrick: number
) {
    const oitDerrickType = "Oil derrick";
    const oilPumpStationType = "Pump station";
    let unitNum = 1;

    for (let x = 0; x < curEnteredPoly.details.spawnBuildingAmount; x++) {
        const centerDerrick = ddcsControllers.getRandomLatLonFromStrategicPoly(curEnteredPoly.polygonPoints[curEnteredPoly.polyId]);
        await ddcsControllers.spawnStaticBuilding({
                _id: "|" + curEnteredPoly._id + "_MAIN|" + curEnteredPoly.polyId + "|" + unitNum + "|",
                lonLatLoc: centerDerrick,
                strategicDetails: curEnteredPoly.details
            } as typings.IStaticSpawnMin,
            buildUnit.coalition,
            oitDerrickType,
            true
        );
        unitNum++;

        if (pumpsPerDerrick > 0) {
            // don't run if 0 pumps spawned
            let curAngle = 0;
            const startRandAngle = _.random(0, 359);
            for (let y = 0; y < pumpsPerDerrick; y++) {
                await ddcsControllers.spawnStaticBuilding({
                        _id: "|" + curEnteredPoly._id + "_MAIN|" + curEnteredPoly.polyId + "|" + unitNum + "|",
                        lonLatLoc: ddcsControllers.getLonLatFromDistanceDirection(
                            centerDerrick,
                            ((startRandAngle + curAngle) % 360),
                            pumpDistance
                        ),
                        strategicDetails: curEnteredPoly.details
                    } as typings.IStaticSpawnMin,
                    buildUnit.coalition,
                    oilPumpStationType,
                    true
                );
                curAngle += Math.round((359 / pumpsPerDerrick));
                unitNum++;
            }
        }
    }
}

export async function buildGridStrategic(
    curEnteredPoly: any,
    buildUnit: any,
    initSpawnLonLat: number[],
    supportBuildingEvery: number,
    spreadDistance: number
) {
    let curColumn = 1;

    const findGridNumber = Math.floor(Math.sqrt(curEnteredPoly.details.spawnBuildingAmount));
    let curStartSpawnLoc = ddcsControllers.getRandomLatLonFromStrategicPoly(curEnteredPoly.polygonPoints[curEnteredPoly.polyId]);
    const centerOfPoly = getCenterOfPoly(curEnteredPoly.polygonPoints[curEnteredPoly.polyId]);
    const angleTowardCenter =  ddcsControllers.findBearing(curStartSpawnLoc[1], curStartSpawnLoc[0], centerOfPoly[1], centerOfPoly[0]);
    let spawnLonLatLoc: number[];

    for (let x = 0; x < curEnteredPoly.details.spawnBuildingAmount; x++) {
        if (x % findGridNumber === 0) {
            spawnLonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(
                curStartSpawnLoc,
                angleTowardCenter,
                spreadDistance
            );
            curStartSpawnLoc = spawnLonLatLoc;
            curColumn = 1;
        } else {
            spawnLonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(
                curStartSpawnLoc,
                ((angleTowardCenter + 90) % 360),
                spreadDistance * curColumn
            );
            curColumn += 1;
        }

        await ddcsControllers.spawnStaticBuilding({
            _id: "|" + curEnteredPoly._id + "_MAIN|" + curEnteredPoly.polyId + "|" + x + "|",
            lonLatLoc: spawnLonLatLoc,
            strategicDetails: curEnteredPoly.details
        } as typings.IStaticSpawnMin,
            buildUnit.coalition,
            pickSupportBuildingEvery(x, supportBuildingEvery, curEnteredPoly, buildUnit, ""),
            true
        );
    }
}

export async function buildFullSpreadStrategic(
    curEnteredPoly: any,
    buildUnit: any,
    supportBuildingEvery: number
) {
    for (let x = 0; x < curEnteredPoly.details.spawnBuildingAmount; x++) {
        await ddcsControllers.spawnStaticBuilding({
            _id: "|" + curEnteredPoly._id + "_MAIN|" + curEnteredPoly.polyId + "|" + x + "|",
            lonLatLoc: ddcsControllers.getRandomLatLonFromStrategicPoly(curEnteredPoly.polygonPoints[curEnteredPoly.polyId]),
            strategicDetails: curEnteredPoly.details
        } as typings.IStaticSpawnMin,
            buildUnit.coalition,
            pickSupportBuildingEvery(x, supportBuildingEvery, curEnteredPoly, buildUnit, ""),
            true
        );
    }
}

export function pickSupportBuildingEvery(
    curIncrement: number,
    supportIncrement: number,
    curEnteredPoly: any,
    buildUnit: any,
    defaultMainBuilding: string
): string {
    let curMainBuilding = defaultMainBuilding;
    if (curIncrement % supportIncrement === 0) {
        let mainBuilding =
            ddcsControllers.getRndFromSpawnCat(
                curEnteredPoly.strategicType + "_SUPPORT",
                buildUnit.coalition,
                true,
                true
            );
        if (mainBuilding.length === 0) {
            mainBuilding =
                ddcsControllers.getRndFromSpawnCat(
                    curEnteredPoly.strategicType + "_MAIN",
                    buildUnit.coalition,
                    true,
                    true
                );
        }
        const sampleBuildings = _.sample(mainBuilding);
        if (sampleBuildings) {
            curMainBuilding = sampleBuildings.type;
        }
    } else {
        const mainBuilding =
            ddcsControllers.getRndFromSpawnCat(
                curEnteredPoly.strategicType + "_MAIN",
                buildUnit.coalition,
                true,
                true
            );
        const sampleBuildings = _.sample(mainBuilding);
        if (sampleBuildings) {
            curMainBuilding = sampleBuildings.type;
        }
    }
    return curMainBuilding;
}

export async function getPlayerInStrategicPoly(buildUnit: typings.IUnit, curPlayer: typings.ISrvPlayers): Promise<any> {
    const strategicPoints = await ddcsControllers.strategicPointRead({});
    let currentStrategicZone = {};
    for (const strategicPoint of strategicPoints) {
        for (let x = 0; x < strategicPoint.polygonPoints.length; x++) {
            // console.log("Polypoints: ", strategicPoint.polygonPoints[x].length);
            if (strategicPoint.polygonPoints[x].length === 1) {
                // circle type polygon
                if (curPlayer.name) {
                    if (await ddcsControllers.isPlayerInProximity(
                        [
                            strategicPoint.polygonPoints[x][0][0],
                            strategicPoint.polygonPoints[x][0][1]
                        ],
                        strategicPoint.polygonPoints[x][0][2] / 1000, // change meters into km
                        curPlayer.name
                    )) {
                        currentStrategicZone = _.assign(strategicPoint, {polyId: x});
                    }
                } else {
                    console.log("Curplayer name is blank");
                }
            } else {
                // free type polygon
                if (ddcsControllers.isLatLonInZone(buildUnit.lonLatLoc, strategicPoint.polygonPoints[x])) {
                    currentStrategicZone = _.assign(strategicPoint, {polyId: x});
                }
            }
        }
    }
    return currentStrategicZone;
}

export function getRandomLatLonFromStrategicPoly(strategicPoly: any): number[] {
    if (strategicPoly.length === 1) {
        // circle polygon
        const randAngle = _.random(0, 359);
        const randDistance = _.random( 0, (strategicPoly[0][2] / 1000));
        return ddcsControllers.getLonLatFromDistanceDirection([strategicPoly[0][0], strategicPoly[0][1]], randAngle, randDistance);
    } else {
        // free polygon
        return ddcsControllers.getRandomLatLonFromPoly(strategicPoly);
    }
}

export async function checkForNeutralStrategicPoints() {
    const strategicPoints = await ddcsControllers.strategicPointRead({});
    for (const strategicPoint of strategicPoints) {
        const unitInternal = await ddcsControllers.unitActionRead({_id: new RegExp(strategicPoint._id + "_MAIN"), dead: false});
        if (unitInternal.length === 0 && strategicPoint.markId.length > 0) {
            // console.log("Clearing strategic marker for ", strategicPoint._id);
            for (const mark of strategicPoint.markId) {
                await ddcsControllers.removeMark(mark);
            }
            await ddcsControllers.strategicPointUpdate({_id: strategicPoint._id, markId: []});
        }
    }
}

export async function getStrategicIncome(): Promise<any> {
    const engineCache = ddcsControllers.getEngineCache();
    const strategicPoints = await ddcsControllers.strategicPointRead({strategicType: {$in: warbondStrategicTypes}, enabled: true});
    if (strategicPoints && strategicPoints.length > 0) {
        const strategicIncome = [
            {income: 0},
            {income: 0},
            {income: 0}
        ];
        for (const point of strategicPoints) {
            const strategicUnits = await ddcsControllers.unitActionRead({
                _id: new RegExp(point._id + "_MAIN"),
                dead: false,
                $or: [
                    {bubbleMapParents: _.toString(engineCache.campaign.currentCampaignBubble)},
                    {unitCategory: 0},
                    {unitCategory: 1},
                    {unitCategory: 3}
                ]
            });
            if (strategicUnits.length > 0) {
                if (point.details && point.details.strategicPointOptions && point.details.strategicPointOptions.split("-")[0]) {
                    // console.log("Strategic Point: " + point._id + " Adding Warbond: " +
                    //    point.details.strategicPointOptions.split("-")[0] + " * " + strategicUnits.length);
                     strategicIncome[strategicUnits[0].coalition].income +=
                        (strategicUnits.length * point.details.strategicPointOptions.split("-")[0]);
                }
            }
        }
        return strategicIncome;
    } else {
        console.log("No Strategic Points");
    }
}
