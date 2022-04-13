/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as typing from "../../typings";
import * as ddcsControllers from "../";
import {I18nResolver} from "i18n-ts";

export async function internalCargo(curUnit: any, curPlayer: any, intCargoType: string) {
    const engineCache = ddcsControllers.getEngineCache();
    let crateObj: any;
    let crateCount: number = 0;
    let curBaseName: string;
    let curBaseObj: any;
    const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;
    if (intCargoType === "loaded") {
        if (curUnit.intCargoType) {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: " + i18n.INTERNALCRATEONBOARD.replace("#1", curUnit.intCargoType),
                5
            );
        } else {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: " + i18n.NOINTERNALCRATEONBOARD,
                5
            );
        }
    }
    if (intCargoType === "unpack") {
        console.log("UNPACKKED");
        const intCargo = _.split(curUnit.intCargoType, "|");
        const curIntCrateType = intCargo[1];
        const curIntCrateBaseOrigin = intCargo[2];
        // let crateType = (curUnit.coalition === 1) ? "Tigr_233036" : "Hummer";
        let crateType = (curUnit.coalition === 1) ? "BTR-80" : "M1126 Stryker ICV";

        // handle strategic unpacking differently
        if (curIntCrateType === "StrategicBaseBuild") {
            await ddcsControllers.correctPlayerAircraftDuplicates();
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: Building Strategic Base, please remain still until it is complete",
                5
            );
            setTimeout(async () => {
                console.log("unpack Int Cargo: StrategicBaseBuild: ", curPlayer.name);
                const isStrategicBaseBuilt = await ddcsControllers.buildStrategicBase(curUnit, curPlayer);
                if (isStrategicBaseBuilt) {
                    await ddcsControllers.unitActionUpdateByUnitId({unitId: curUnit.unitId, intCargoType: ""});
                }
                // unpackInternalCargo(curUnit, curPlayer, curIntCrateType, curBaseObj, i18n, crateType);
            }, _.random(10, 20) * 1000);
        } else {
            if (curUnit.speed > 0.3) {
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: " + i18n.LANDBEFORECARGOCOMMAND,
                    5
                );
            } else {
                if (curIntCrateType) {
                    const playerProx: any [] = [];
                    const bases = await ddcsControllers.campaignAirfieldActionRead({});
                    for (const base of bases) {
                        let cargoDistance = engineCache.campaign.intCargoLoadDistanceAirfield;
                        if (base.baseType === "FOB" && /FOB$/.test(base._id)) {
                            cargoDistance = engineCache.campaign.intCargoLoadDistanceFarp;
                        }
                        const curCheckAllBase =
                            await ddcsControllers.isPlayerInProximity(
                                base.centerLoc,
                                cargoDistance,
                                curUnit.playername
                            );
                        playerProx.push(curCheckAllBase);
                        if (curCheckAllBase) {
                            curBaseObj = base;
                            curBaseObj = base;
                        }
                    }
                    if (curBaseObj &&
                        curIntCrateBaseOrigin === _.split(curBaseObj._id, " #")[0]) {
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.CANTUNPACKSAMEBASECRATE,
                            5
                        );
                    } else {
                        if (curIntCrateType === "JTAC") {
                            await ddcsControllers.correctPlayerAircraftDuplicates();
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: Unloading JTAC, please remain still until it is unloaded",
                                5
                            );
                            setTimeout(() => {unpackInternalCargo(curUnit, curPlayer, curIntCrateType, curBaseObj, i18n, crateType); },
                                _.random(10, 20) * 1000);
                        }
                        if (curIntCrateType === "LightAAA") {
                            await ddcsControllers.correctPlayerAircraftDuplicates();
                            crateType = (curUnit.coalition === 1) ? "ZU-23 Emplacement" : "bofors40";
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: Unloading Internal Cargo, please remain stationary until it is unloaded",
                                5
                            );
                            setTimeout(() => {
                                    unpackInternalCargo(curUnit, curPlayer, curIntCrateType, curBaseObj, i18n, crateType); },
                                _.random(10, 20) * 1000
                            );
                        }
                        if (curIntCrateType === "BaseRepair") {
                            await ddcsControllers.correctPlayerAircraftDuplicates();
                            if (_.some(playerProx)) {
                                await ddcsControllers.sendMesgToGroup(
                                    curPlayer,
                                    curUnit.groupId,
                                    "G: Unloading base repair, please remain still until it is complete",
                                    5
                                );
                                setTimeout(() => {
                                        unpackInternalCargo(curUnit, curPlayer, curIntCrateType, curBaseObj, i18n, crateType); },
                                    _.random(10, 20) * 1000
                                );

                            } else {
                                await ddcsControllers.sendMesgToGroup(
                                    curPlayer,
                                    curUnit.groupId,
                                    "G: " + i18n.YOUARENOTNEARANYFRIENDLYBASES,
                                    5
                                );
                            }
                        }
                        if (curIntCrateType === "CCBuild") {  // serverName, curUnit, curPlayer, intCargoType
                            const delCrates = await ddcsControllers.staticCrateActionRead({playerOwnerId: curPlayer.ucid});
                            for (const crate of delCrates) {
                                if (crateCount > engineCache.campaign.maxCrates - 2) {
                                    await ddcsControllers.staticCrateActionDelete({
                                        _id: crate._id
                                    });
                                    await ddcsControllers.destroyUnit(crate._id, "static");
                                }
                                crateCount++;
                            }
                            crateObj = {
                                name: curUnit.intCargoType + "|#" + _.random(1000000, 9999999),
                                unitLonLatLoc: curUnit.lonLatLoc,
                                shape_name: "bw_container_cargo",
                                category: "Cargo",
                                type: "container_cargo",
                                heading: curUnit.hdg,
                                canCargo: true,
                                mass: 500,
                                playerOwnerId: curPlayer.ucid,
                                templateName: "CCBuild",
                                special: curUnit.intCargoType,
                                crateAmt: 1,
                                isCombo: false,
                                playerCanDrive: false,
                                country: ddcsControllers.defCountrys[curUnit.coalition],
                                side: curUnit.coalition,
                                coalition: curUnit.coalition
                            };
                            await ddcsControllers.spawnLogiCrate(crateObj, true);
                            await ddcsControllers.unitActionUpdateByUnitId({unitId: curUnit.unitId, intCargoType: ""});
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: " + i18n.COMMANDCENTERBUILDCRATESPAWNED,
                                5
                            );
                            if (await isTroopOnboard(curUnit)) {
                                await setInternalCargoMass(curUnit.name, 500);
                            } else {
                                await setInternalCargoMass(curUnit.name, 0);
                            }
                        }
                    }
                } else {
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        curUnit.groupId,
                        "G: " + i18n.NOINTERNALCRATEONBOARD,
                        5
                    );
                }
            }
        }
    }
    if (intCargoType === "loadJTAC" || intCargoType === "loadBaseRepair" ||
        intCargoType === "loadCCBuild" || intCargoType === "loadLightAAA" || intCargoType === "loadStrategicBuild") {
        if (curUnit.inAir) {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: " + i18n.LANDBEFORECARGOCOMMAND,
                5
            );
        } else {
            const bases = await ddcsControllers.campaignAirfieldActionRead({});
            const playerProx: any [] = [];
            for (const base of bases) {
                let cargoDistance = engineCache.campaign.intCargoLoadDistanceAirfield;
                if (base.baseType === "FOB" && /FOB$/.test(base._id)) {
                    cargoDistance = engineCache.campaign.intCargoLoadDistanceFarp;
                }
                const curCheckAllBase =
                    await ddcsControllers.isPlayerInProximity(
                        base.centerLoc,
                        cargoDistance,
                        curUnit.playername
                    );
                playerProx.push(curCheckAllBase);
                if (curCheckAllBase) {
                    console.log("Player Load Crate: ", curUnit.playername, " near base: ", base._id);
                    curBaseObj = base;
                }
            }
            if (_.some(playerProx)) {
                curBaseName = _.split(curBaseObj._id, " #")[0];
                console.log("intCurBaseAt: ", curBaseName);
                const aliveLogistics = await ddcsControllers.unitActionRead({name: curBaseName + " Shelter", dead: false});
                if (aliveLogistics.length >= 0 || _.includes(curBaseName, "Carrier" || curBaseObj.baseType === "MOB")) {
                    if (intCargoType === "loadJTAC") {
                        await ddcsControllers.unitActionUpdateByUnitId({
                            unitId: curUnit.unitId,
                            intCargoType: "|JTAC|" + curBaseName + "|"
                        });
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.PICKEDUPJTACINTERNALCRATE.replace("#1", curBaseName),
                            5
                        );
                        if (await isTroopOnboard(curUnit)) {
                            await setInternalCargoMass(curUnit.name, 1000);
                        } else {
                            await setInternalCargoMass(curUnit.name, 500);
                        }
                    }
                    if (intCargoType === "loadLightAAA") {
                        await ddcsControllers.unitActionUpdateByUnitId({
                            unitId: curUnit.unitId,
                            intCargoType: "|LightAAA|" + curBaseName + "|"
                        });
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G:Picked up light AAA internal crate",
                            5
                        );
                        if (await isTroopOnboard(curUnit)) {
                            await setInternalCargoMass(curUnit.name, 1000);
                        } else {
                            await setInternalCargoMass(curUnit.name, 500);
                        }
                    }
                    if (intCargoType === "loadBaseRepair") {
                        const intCargo = _.split(curUnit.intCargoType, "|");
                        const curIntCrateBaseOrigin = intCargo[2];
                        curBaseName = _.split(curBaseObj._id, " #")[0];
                        console.log("intCurUnpackBaseAt: ", intCargo, curBaseName);
                        if (curIntCrateBaseOrigin && curBaseName && curIntCrateBaseOrigin !== curBaseName) {
                            await ddcsControllers.repairBase(curBaseObj, curUnit);
                        }
                        await ddcsControllers.unitActionUpdateByUnitId({
                            unitId: curUnit.unitId,
                            intCargoType: "|BaseRepair|" + curBaseName + "|"
                        });
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.PICKEDUPBASEREPAIRINTERNALCRATES.replace("#1", curBaseName),
                            5
                        );
                        if (await isTroopOnboard(curUnit)) {
                            await setInternalCargoMass(curUnit.name, 1000);
                        } else {
                            await setInternalCargoMass(curUnit.name, 500);
                        }
                    }
                    if (intCargoType === "loadStrategicBuild") {
                        if (curBaseObj.baseType === "MOB") {
                            curBaseName = _.split(curBaseObj._id, " #")[0];
                            await ddcsControllers.unitActionUpdateByUnitId({
                                unitId: curUnit.unitId,
                                intCargoType: "|StrategicBaseBuild|" + curBaseName + "|"
                            });
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: Strategic Base Building Crate Has Been Loaded",
                                5
                            );
                            if (await isTroopOnboard(curUnit)) {
                                await setInternalCargoMass(curUnit.name, 1000);
                            } else {
                                await setInternalCargoMass(curUnit.name, 500);
                            }
                        } else {
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: Strategic Base Building Crate Can Only Be Picked Up At MOB Type Bases",
                                5
                            );
                        }

                    }
                    if (intCargoType === "loadCCBuild") {
                        await ddcsControllers.unitActionUpdateByUnitId({
                            unitId: curUnit.unitId,
                            intCargoType: "|CCBuild|" + curBaseName + "|"
                        });
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.PICKEDUPBASEREPAIRBUILDCRATE.replace("#1", curBaseName),
                            5
                        );
                        if (await isTroopOnboard(curUnit)) {
                            await setInternalCargoMass(curUnit.name, 1000);
                        } else {
                            await setInternalCargoMass(curUnit.name, 500);
                        }
                    }
                } else {
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        curUnit.groupId,
                        "G: " + i18n.LOGISTICALSUPPLYHASBEENCUT.replace("#1", curBaseName),
                        5
                    );
                }
            } else {
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: " + i18n.YOUARENOTWITHINDISTANCEFRIENDLYBASE.replace("#1", "2km"),
                    5
                );
            }
        }
    }
}

export async function isCrateOnboard(unit: any, verbose: boolean) {
    const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: unit.playername});
    const curPly = curPlayerArray[0];
    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
    if (unit.intCargoType) {
        if (verbose) {
            await ddcsControllers.sendMesgToGroup(
                curPly,
                unit.groupId,
                "G: A " + unit.intCargoType.type + " is currently packed onboard",
                5
            );
        }
        return true;
    }
    if (unit.virtCrateType) {
        if (verbose) {
            await ddcsControllers.sendMesgToGroup(
                curPly,
                unit.groupId,
                "G: " + i18n.CRATEISONBOARD.replace("#1", _.split(unit.virtCrateType, "|")[2]),
                5
            );
        }
        return true;
    }
    if (verbose) {
        await ddcsControllers.sendMesgToGroup(
            curPly,
            unit.groupId,
            "G: " + i18n.NOCRATESONBOARD,
            5
        );
    }
    return false;
}

export async function isTroopOnboard(unit: any, verbose?: boolean) {
    const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: unit.playername});
    const curPly = curPlayerArray[0];
    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
    if (unit.troopType) {
        if (verbose) {
            await ddcsControllers.sendMesgToGroup(
                curPly,
                unit.groupId,
                "G: " + i18n.CRATEISONBOARD.replace("#1", unit.troopType),
                5
            );
        }
        return true;
    }
    if (verbose) {
        await ddcsControllers.sendMesgToGroup(
            curPly,
            unit.groupId,
            "G: " + i18n.NOTROOPSONBOARD,
            5
        );
    }
    return false;
}

export async function loadTroops(unitId: string, troopType: string) {
    const units = await ddcsControllers.unitActionRead({unitId, dead: false});
    const curUnit = _.get(units, 0);
    const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: curUnit.playername});
    const curPly = curPlayerArray[0];
    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
    if (curUnit.inAir) {
        await ddcsControllers.sendMesgToGroup(
            curPly,
            curUnit.groupId,
            "G: " + i18n.LANDBEFORECARGOCOMMAND,
            5
        );
    } else {
        const playerProx: any [] = [];
        const bases = await ddcsControllers.campaignAirfieldActionRead({baseType: "MOB", side: curUnit.coalition});
        for (const base of bases) {
            const curCheckAllBase =
                await ddcsControllers.isPlayerInProximity(base.centerLoc, engineCache.campaign.troopLoadDistance, curUnit.playername);
            playerProx.push(curCheckAllBase);
        }
        if (_.some(playerProx)) {
            await ddcsControllers.unitActionUpdateByUnitId({unitId, troopType});
            await ddcsControllers.sendMesgToGroup(
                curPly,
                curUnit.groupId,
                "G: " + i18n.HASBEENLOADED.replace("#1", troopType),
                5
            );
            let currentMass = 0;
            if (curUnit.intCargoType) {
                currentMass = 500 ;
            }
            await setInternalCargoMass(curUnit.name, currentMass + 500);
        } else {
            // secondary check for second base distance
            const secondBases = await ddcsControllers.campaignAirfieldActionRead({});
            const checkAllSecondBase: any[] = [];
            let curLogistic: any;
            const aliveBases = await ddcsControllers.unitActionRead({
                _id:  /Shelter/,
                dead: false,
                coalition: curUnit.coalition
            });
            for (const base of secondBases) {
                curLogistic = _.find(aliveBases, {name: base._id + " Shelter"});
                if (!!curLogistic) {
                    checkAllSecondBase.push( await ddcsControllers.isPlayerInProximity(
                        curLogistic.lonLatLoc,
                        0.2,
                        curUnit.playername
                    ));
                }
            }
            if (_.some(checkAllSecondBase)) {
                await ddcsControllers.unitActionUpdateByUnitId({unitId, troopType})
                    .then(async () => {
                        await ddcsControllers.sendMesgToGroup(
                            curPly,
                            curUnit.groupId,
                            "G: " + i18n.HASBEENLOADED.replace("#1", troopType),
                            5
                        );
                        let currentMass = 0;
                        if (curUnit.intCargoType) {
                            currentMass = 500 ;
                        }
                        await setInternalCargoMass(curUnit.name, currentMass + 500);
                    })
                    .catch((err) => {
                        console.log("line 13: ", err);
                    })
                ;
            } else {
                await ddcsControllers.sendMesgToGroup(
                    curPly,
                    curUnit.groupId,
                    "G: " + i18n.TOOFARFROMFRIENDLYBASE.replace("#1", "troops"),
                    5
                );
            }
        }
    }
}

export async function getActiveJTACTargets(unit: any, player: any, target: number) {
    // console.log("UPT: ", unit, player, target);
    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, player.lang).translation as any;
    const closestJTAC = await ddcsControllers.getFirst5CoalitionJTACInProximity(unit.lonLatLoc, 10000, unit.coalition);
    let message = "";
    if (target) {
        if (closestJTAC[(target - 1)]) {
            const curJtacEnemy = closestJTAC[(target - 1)].jtacEnemyLocation;
            if (_.isNumber(curJtacEnemy.lonLat.lon) && _.isNumber(curJtacEnemy.lonLat.lat)) {
                const closestBase = await ddcsControllers.getAnyBasesInProximity([curJtacEnemy.lonLat.lon, curJtacEnemy.lonLat.lat], 100);
                // console.log("target: ", target, closestJTAC[target - 1]);
                message += i18n.TARGET + ": " + target + " " + i18n.TYPE + ": " + curJtacEnemy.type;
                if (closestBase[0] && closestBase[0]._id) {
                    message += " " + i18n.NEAR + " " + closestBase[0]._id + "\n";
                }
                message += "Lat: " + curJtacEnemy.lonLat.lat + " Lon: " + curJtacEnemy.lonLat.lon + "\n";
                message += "DMS: " + ddcsControllers.convertDMS(curJtacEnemy.lonLat.lat, curJtacEnemy.lonLat.lon) + "\n";
                message += "MGRS: " + curJtacEnemy.mgrs.UTMZone + curJtacEnemy.mgrs.MGRSDigraph +
                    curJtacEnemy.mgrs.Easting + curJtacEnemy.mgrs.Northing + "\n";
                message +=  i18n.SHOTLASERCODE.replace("#1", curJtacEnemy.laserCode);

                await ddcsControllers.sendMesgToGroup(
                    player,
                    unit.groupId,
                    message,
                    60
                );
            } else {
                console.log("Lat or Lon is blank1: ", curJtacEnemy);
            }
        } else {
            await ddcsControllers.sendMesgToGroup(
                player,
                unit.groupId,
                i18n.NOJTACTARGET.replace("#1", target),
                10
            );
        }
    } else {
        if (closestJTAC.length > 0) {
            for (let x = 0; x < closestJTAC.length; x++) {
                if (x !== 0) {
                    message += "\n";
                }

                const curJtacEnemy = closestJTAC[x].jtacEnemyLocation;
                if (_.isNumber(curJtacEnemy.lonLat.lon) && _.isNumber(curJtacEnemy.lonLat.lat)) {
                    const enemyBRA = ddcsControllers.findBearing(unit.lonLatLoc[1], unit.lonLatLoc[0],
                        curJtacEnemy.lonLat.lat, curJtacEnemy.lonLat.lon).toFixed(0);
                    const enemyDist = ddcsControllers.calcDirectDistanceInKm(unit.lonLatLoc[1], unit.lonLatLoc[0],
                        curJtacEnemy.lonLat.lat, curJtacEnemy.lonLat.lon).toFixed(2);
                    const closestBase = await ddcsControllers.getAnyBasesInProximity([
                        curJtacEnemy.lonLat.lon,
                        curJtacEnemy.lonLat.lat], 100);
                    // console.log("BRA", enemyBRA, enemyDist, curJtacEnemy);
                    message += i18n.JTACTARGET.replace("#1", (x + 1))
                        .replace("#2", curJtacEnemy.type).replace("#3", enemyBRA).replace("#4", enemyDist);
                    if (closestBase[0] && closestBase[0]._id) {
                        message += " " + i18n.NEAR + " " + closestBase[0]._id;
                    }
                } else {
                    console.log("Lat or Lon is blank2: ", curJtacEnemy);
                }
            }
            await ddcsControllers.sendMesgToGroup(
                player,
                unit.groupId,
                message,
                20
            );
        } else {
            await ddcsControllers.sendMesgToGroup(
                player,
                unit.groupId,
                i18n.NOJTACTARGETS,
                10
            );
        }
    }
}

/*
export async function processReceiveRoadPath(incomingObj: any): Promise<void> {
    // console.log("return road path object: ", incomingObj, incomingObj.returnObj[0]);
    const baseConvoyGroupName = "AI|convoyLarge|Sochi-Adler_Sukhumi-Babushara|";

    await ddcsControllers.spawnConvoy(
        baseConvoyGroupName,
        2,
        incomingObj.returnObj,
        {
            name: "convoyLarge",
            AIType: "groundConvoy",
            functionCall: "fullCampaignStackStats",
            stackTrigger: "1.25",
            makeup: [
                {
                    template: "tank",
                    count: 2
                },
                {
                    template: "mobileAntiAir",
                    count: 2
                },
                {
                    template: "samIR",
                    count: 2
                }
            ]
        },
        "Test Spawn Convoy"
    );

}
*/

export async function menuCmdProcess(pObj: any) {
    // console.log("MENU COMMAND: ", pObj);
    const engineCache = ddcsControllers.getEngineCache();
    const defCrate = "container_cargo";
    let logiProx;
    const units = await ddcsControllers.unitActionRead({unitId: pObj.unitId});
    if (units.length > 0) {
        const curUnit = units[0];
        const player = await ddcsControllers.srvPlayerActionsRead({name: curUnit.playername});
        if (player.length > 0) {
            const curPlayer = player[0];
            const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;
            // action menu
            switch (pObj.cmd) {
                case "serverTimeLeft":
                    await ddcsControllers.timeLeft(curUnit, curPlayer);
                    break;
                case "lookupAircraftCosts":
                    await ddcsControllers.lookupAircraftCosts(curPlayer.ucid);
                    break;
                case "lookupLifeResource":
                    await ddcsControllers.lookupLifeResource(curPlayer.ucid);
                    break;
                case "getTargetCoords":
                    await getActiveJTACTargets(curUnit, curPlayer, pObj.target);
                    break;
                case "checkTempWarbonds":
                    await ddcsControllers.checkTempWarbonds(curPlayer);
                    break;
                case "checkWarbonds":
                    await ddcsControllers.checkWarBonds(curPlayer);
                    break;
                case "packStaticUnit":
                    if (curUnit.inAir) {
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: Please land before trying to pack the unit",
                            5
                        );
                    } else {
                        const unit = await ddcsControllers.getPackableUnitsInProximity(curUnit.lonLatLoc, 0.2, curUnit.coalition);
                        const curTroop = unit[0];
                        if (curTroop) {
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: The nearby " + curTroop.type + " is now being packed, wait for it to finish packing before moving",
                                5
                            );
                            setTimeout(() => {packNearbyUnitIntoIntCargo(curUnit, curPlayer, curTroop); }, _.random(10, 20) * 1000);

                        } else {
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G:No packable units are nearby",
                                5
                            );
                        }

                    }
                    break;
                case "unloadExtractTroops":
                    if (curUnit.inAir) {
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.LANDBEFORECARGOCOMMAND,
                            5
                        );
                    } else {
                        if (await isTroopOnboard(curUnit)) {
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: Troops are disembarking, wait for them to finish",
                                5
                            );
                            setTimeout(() => {unloadExtractTroops(curUnit, curPlayer, i18n, pObj, engineCache); }, _.random(10, 20) * 1000);
                        } else {
                            const troopUnits = await ddcsControllers.getTroopsInProximity(curUnit.lonLatLoc, 0.2, curUnit.coalition);
                            const curTroop = troopUnits[0];
                            if (curTroop) {
                                await ddcsControllers.sendMesgToGroup(
                                    curPlayer,
                                    curUnit.groupId,
                                    "G: Troops are boarding, wait for them to finish",
                                    5
                                );
                                setTimeout(() => {
                                    unloadExtractTroops(curUnit, curPlayer, i18n, pObj, engineCache); },
                                    _.random(10, 20) * 1000
                                );

                            } else {
                                await ddcsControllers.sendMesgToGroup(
                                    curPlayer,
                                    curUnit.groupId,
                                    "G:" + i18n.NOTROOPSTOEXTRACTORUNLOAD,
                                    5
                                );
                            }
                        }
                    }
                    break;
                case "fastRopeTroops":
                    if (!curUnit.inAir) {
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G:You must be in the air to deploy troops via fast rope",
                            5
                        );
                    } else {
                        if (curUnit.agl < 300) {
                            if (curUnit.speed < 5) {
                                if (await isTroopOnboard(curUnit)) {
                                    const playerProx: any[] = [];
                                    const bases = await ddcsControllers.campaignAirfieldActionRead({
                                        baseType: "MOB",
                                        side: curUnit.coalition
                                    });
                                    for (const base of bases) {
                                        playerProx.push(await ddcsControllers.isPlayerInProximity(
                                            base.centerLoc,
                                            engineCache.campaign.troopUnloadDistance,
                                            curUnit.playername
                                        ));
                                    }
                                    const timeTaken = _.random(10, 20);
                                    if (_.some(playerProx)) {
                                        await ddcsControllers.sendMesgToGroup(
                                            curPlayer,
                                            curUnit.groupId,
                                            "G:Troops are deploying! Hold it steady, at this height this will take around " +
                                                Math.round(curUnit.agl) + " seconds",
                                            Math.round(curUnit.agl)
                                        );
                                        await ddcsControllers.unitActionUpdateByUnitId({
                                            unitId: pObj.unitId,
                                            troopType: null
                                        });
                                        let currentMass = 500;
                                        if (curUnit.intCargoType) {
                                            currentMass = 1000 ;
                                        }
                                        setTimeout(() => {
                                            setInternalCargoMass(curUnit.name, currentMass - 500); },
                                            curUnit.agl * 500
                                        );
                                        setTimeout(() => {
                                            setInternalCargoMass(curUnit.name, currentMass - 1000);
                                            deployTroops(
                                                pObj.unitId,
                                                curPlayer, i18n,
                                                _.some(playerProx),
                                                engineCache,
                                                curUnit.troopType,
                                                curUnit.lonLatLoc,
                                                curUnit.agl,
                                                timeTaken
                                            );
                                        }, curUnit.agl * 1000);
                                        } else {
                                            await ddcsControllers.sendMesgToGroup(
                                                curPlayer,
                                                curUnit.groupId,
                                                "G:Troops are deploying! Hold it steady, at this height this will take around " +
                                                timeTaken + " seconds",
                                                Math.round(curUnit.agl)
                                            );
                                            await ddcsControllers.unitActionUpdateByUnitId({
                                                unitId: pObj.unitId,
                                                troopType: null
                                            });
                                            let currentMass = 500;
                                            if (curUnit.intCargoType) {
                                                currentMass = 1000 ;
                                            }

                                            setTimeout(() => {setInternalCargoMass(curUnit.name, currentMass - 250); }, timeTaken * 500);
                                            setTimeout(() => {
                                                setInternalCargoMass(curUnit.name, currentMass - 500);
                                                deployTroops(
                                                    pObj.unitId,
                                                    curPlayer,
                                                    i18n,
                                                    _.some(playerProx),
                                                    engineCache,
                                                    curUnit.troopType,
                                                    curUnit.lonLatLoc,
                                                    curUnit.agl,
                                                    timeTaken
                                                );
                                            }, timeTaken * 1000);
                                            }
                                } else {
                                    // no troops
                                    await ddcsControllers.sendMesgToGroup(
                                        curPlayer,
                                        curUnit.groupId,
                                        "G:No troops are onboard to deploy",
                                        5
                                    );
                                }
                            } else {
                                await ddcsControllers.sendMesgToGroup(
                                    curPlayer,
                                    curUnit.groupId,
                                    "G:Reduce airspeed, you must be in a hover the troops to deploy",
                                    5
                                );
                            }
                        } else {
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G:You are too high, you must decent to 60 feet/18 meters for troops to be able to fast rope",
                                5
                            );
                        }
                    }
                    break;
                case "isTroopOnboard":
                    await isTroopOnboard(curUnit, true);
                    break;
                case "isCrateOnboard":
                    await isCrateOnboard(curUnit, true);
                    break;
                case "unpackCrate":
                    logiProx = await ddcsControllers.getLogiTowersProximity(
                        curUnit.lonLatLoc,
                        engineCache.campaign.crateUnpackDistance,
                        curUnit.coalition
                    );
                    if (logiProx.length) {
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.YOUNEEDTOMOVEFARTHERAWAY.replace("#1", "Command Towers (" +
                                engineCache.campaign.crateUnpackDistance * 1000 + "m)"),
                            5
                        );
                    } else {
                        if (curUnit.inAir) {
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: " + i18n.LANDBEFORECARGOCOMMAND,
                                5
                            );
                        } else {
                            const chkPlayer = await ddcsControllers.srvPlayerActionsRead({name: curUnit.playername});
                            const curChkPlayer = chkPlayer[0];
                            if (curChkPlayer) {
                                await ddcsControllers.unpackStaticCrate(curUnit, true);
                            }
                        }
                    }
                    break;
                case "unpackCrate2":
                    logiProx = await ddcsControllers.getLogiTowersProximity(
                        curUnit.lonLatLoc,
                        engineCache.campaign.crateUnpackDistance,
                        curUnit.coalition
                    );
                    if (logiProx.length) {
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.YOUNEEDTOMOVEFARTHERAWAY.replace(
                                "#1",
                                "Command Towers (" + engineCache.campaign.crateUnpackDistance * 1000 + "m)"
                            ),
                            5
                        );
                    } else {
                        if (curUnit.inAir) {
                            await ddcsControllers.sendMesgToGroup(
                                curPlayer,
                                curUnit.groupId,
                                "G: " + i18n.LANDBEFORECARGOCOMMAND,
                                5
                            );
                        } else {
                            const chkPlayer = await ddcsControllers.srvPlayerActionsRead({name: curUnit.playername});
                            const curChkPlayer = chkPlayer[0];
                            if (curChkPlayer) {
                                await ddcsControllers.unpackStaticCrate(curUnit, true);
                            }
                        }
                    }
                    break;
                case "Soldier":
                    await loadTroops(pObj.unitId, "Soldier");
                    break;
                case "MG Soldier":
                    await loadTroops(pObj.unitId, "MG Soldier");
                    break;
                case "MANPAD":
                    await loadTroops(pObj.unitId, "MANPAD");
                    break;
                case "RPG":
                    await loadTroops(pObj.unitId, "RPG");
                    break;
                case "Mortar Team":
                    await loadTroops(pObj.unitId, "Mortar Team");
                    break;
                case "acquisitionCnt":
                    const unitsOwned = await ddcsControllers.unitActionRead({
                        playerOwnerId: curPlayer.ucid,
                        isCrate: false,
                        isTroop: false,
                        dead: false
                    });
                    const grpGroups = _.transform(unitsOwned, (result: any, value: any) => {
                        (result[value.groupName] || (result[value.groupName] = [])).push(value);
                    }, {});

                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        curUnit.groupId,
                        "G: " + i18n.YOUHAVEUNITAQUISITIONSINPLAY
                            .replace("#1", _.size(grpGroups)).replace("#2", engineCache.campaign.maxUnitsMoving),
                        10
                    );
                    break;
                case "testSpawnConvoy":
                    // console.log("Test Spawn Convoy");
                    const curNextUniqueId = ddcsControllers.getNextUniqueId();
                    ddcsControllers.setRequestJobArray({
                        reqId: curNextUniqueId,
                        callBack: "processReceiveRoadPath",
                        reqArgs: {}
                    }, curNextUniqueId);
                    await ddcsControllers.sendUDPPacket("frontEnd", {
                        actionObj: {
                            action: "getGroundRoute",
                            type: "roads",
                            lat1: 43.439378434051,
                            lon1: 39.924231880466,
                            lat2: 42.852741071635,
                            lon2: 41.142447588488,
                            reqID: curNextUniqueId,
                            time: new Date()
                        }
                    });

                    break;
                case "EWR":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "JTAC":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "jtac", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "reloadGroup":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "reloadGroup", pObj.mobile, pObj.mass, "container_cargo");
                    break;
                case "repairBase":
                    await spawnCrateFromLogi(
                        curUnit,
                        pObj.type,
                        pObj.crates,
                        "repairBase",
                        pObj.mobile,
                        pObj.mass,
                        "container_cargo"
                    );
                    break;
                case "unarmedFuel":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "unarmedAmmo":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "armoredCar":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "APC":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "tank":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "artillary":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "mlrs":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "stationaryAntiAir":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "mobileAntiAir":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "samIR":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "mobileSAM":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "MRSAM":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "LRSAM":
                    await spawnCrateFromLogi(curUnit, pObj.type, pObj.crates, "", pObj.mobile, pObj.mass, defCrate);
                    break;
                case "spawnBomber":
                    await spawnBomber(curUnit, curPlayer, pObj.type, pObj.rsCost);
                    break;
                case "spawnAtkHeli":
                    await spawnAtkHeli(curUnit, curPlayer, pObj.type, pObj.rsCost);
                    break;
                case "spawnDefHeli":
                    await spawnDefHeli(curUnit, curPlayer, pObj.type, pObj.rsCost);
                    break;
                case "spawnAWACS":
                    await spawnAWACS(curUnit, curPlayer, pObj.type, pObj.rsCost);
                    break;
                case "spawnTanker":
                    await spawnTanker(curUnit, curPlayer, pObj.type, pObj.rsCost);
                    break;
                case "spawnReinforcements":
                    await spawnReinforcements(curUnit, curPlayer, pObj.type, pObj.cost, pObj.costType);
                    break;
                case "InternalCargo":
                    console.log("IntCargo Cmd:", "Player: " + curPlayer.name, "Aircraft: " + curUnit.type, " CargoType: " + pObj.type);
                    await internalCargo(curUnit, curPlayer, pObj.type);
                    break;
                case "reclaimInactiveAcquisitions":
                    console.log("reclaimAcquisitions: ", curUnit._id, curPlayer.name);
                    await ddcsControllers.reclaimInactiveAcquisitions(curUnit, curPlayer);
                    break;
            }
        }
    }
}

export async function spawnAtkHeli(curUnit: typing.IUnit, curPlayer: typing.ISrvPlayers, heliType: string, rsCost: number) {
    console.log("HeliType: ", heliType, rsCost);

    let heliObj: any;
    if (heliType === "RussianAtkHeli") {
        heliObj = {
            name: "RussianAtkHeli",
            type: "Mi-28N",
            country: "RUSSIA",
            alt: "1000",
            speed: "55",
            hidden: false
        };
    }
    if (heliType === "USAAtkHeli") {
        heliObj = {
            name: "USAAtkHeli",
            type: "AH-64D",
            country: "USA",
            alt: "1000",
            speed: "55",
            hidden: false
        };
    }

    const spentPoints = await ddcsControllers.spendResourcePoints(curPlayer, rsCost, "AtkHeli", heliObj);
    if (spentPoints) {
        await ddcsControllers.spawnAtkChopper(curUnit, heliObj);
    }
}

export async function baseAWACSUpkeep() {
    const engineCache = ddcsControllers.getEngineCache();
    const getBaseAwacs = engineCache.campaign.bubbleMap[engineCache.campaign.currentCampaignBubble].baseAwacs;

    if (Object.entries(getBaseAwacs).length > 0) {
        for (const [baseName, baseConfig] of Object.entries(getBaseAwacs)) {
            // @ts-ignore
            if (baseConfig.side !== 0) {
                // console.log("Awacs Check For Spawn: ", baseName);
                await spawnBaseAWACS(baseName, baseConfig);
            } else {
                console.log("AWACS Check, Base Is Neutral: ", baseName);
            }
        }
    }
}

export async function spawnBaseAWACS(baseName: string, baseConfig: any) {
    const awacsName = "AI|baseAWACS|" + baseName + "|";
    const isAwacsAlive = await ddcsControllers.unitActionRead({name: awacsName, dead: false});
    // console.log("IAA: ", isAwacsAlive);
    if (isAwacsAlive.length === 0) {
        const bases = await ddcsControllers.campaignAirfieldActionRead({_id: baseName});
        const curBase = bases[0];
        let replenEpoc = new Date(curBase.awacsReplenTime).getTime();
        if (_.isNaN(replenEpoc)) {
            replenEpoc = new Date().getTime() - 1000;
            console.log("For base:", baseName, "Replen Epoc isNAN so setting it to", replenEpoc);

        }

        // console.log("AWACS replenEpoc: ", replenEpoc, " < ", new Date().getTime());
        if (replenEpoc < new Date().getTime()) {
            // console.log("Update base AWACS timer1: ", baseName, new Date().getTime() + ddcsControllers.time.oneHour);
            await ddcsControllers.campaignAirfieldActionUpdateAwacsTimer({
                _id: baseName,
                awacsReplenTime: new Date().getTime() + ddcsControllers.time.oneHour
            });

            let awacsType: string = "";
            let country: number = 0;

            if (curBase.side === 1) {
                awacsType = "E-2C";
                country = 7;
            } else if (curBase.side === 2) {
                awacsType = "E-2C";
                country = 2;
            }
            // Quick dirty and unreliable band-aid awacs callsign fix - to be removed - Kirkwood
            const awacsCallsign = {
                one: _.random(1, 5),
                two: _.random(1, 9),
                name: ["Overlord", "Overlord", "Magic", "Wizard", "Focus", "Darkstar"]
            };
            const awacsTemplateObj = {
                country,
                side: curBase.side,
                groupName: awacsName,
                name: awacsName,
                airdromeId: curBase.baseId,
                // parking: Number(curBase.polygonLoc.AICapTemplate.units[0].parking),
                // parking_id: curBase.polygonLoc.AICapTemplate.units[0].parking_id,
                routeLocs: curBase.centerLoc,
                type: awacsType,
                skill: "Excellent",
                payload: {
                    fuel: 100000,
                    flare: 1000,
                    chaff: 1000,
                    gun: 1000
                },
                hdg: _.random(0, 359),
                // Quick dirty and unreliable band-aid awacs callsign fix - to be removed
                callsign: {
                    one: awacsCallsign.one,
                    two: awacsCallsign.two,
                    three: 1,
                    name: awacsCallsign.name[awacsCallsign.one] + awacsCallsign.two + 1
                },
                onboard_num: "010",
                frequency: baseConfig.frequency
            };

            const unitTemplate = await ddcsControllers.templateRead({_id: "awacsTemplateFull"});
            const compiled = _.template(unitTemplate[0].template);
            const curGroupSpawn = compiled({awacsTemplateObj});

            const curCMD = await ddcsControllers.spawnGrp(
                curGroupSpawn,
                awacsTemplateObj.country,
                ddcsControllers.UNIT_CATEGORY.indexOf("AIRPLANE")
            );
            // console.log("CMD: ", curCMD);
            await ddcsControllers.sendUDPPacket("frontEnd", {
                actionObj: {
                    action: "CMD",
                    cmd: [curCMD],
                    reqID: 0
                }
            });
        }
    } else {
        // console.log("Update base AWACS timer2: ", baseName, new Date().getTime() + ddcsControllers.time.oneHour);
        await ddcsControllers.campaignAirfieldActionUpdateAwacsTimer({
            _id: baseName,
            awacsReplenTime: new Date().getTime() + ddcsControllers.time.oneHour
        });
    }
}

export async function spawnAWACS(curUnit: typing.IUnit, curPlayer: typing.ISrvPlayers, awacsType: string, rsCost: number) {
    console.log("AWACSType: ", awacsType, rsCost);

    let awacsObj: any;
    if (awacsType === "RussianAWACSA50") {
        awacsObj = {
            name: "RussianAWACSA50",
            type: "A-50",
            country: "RUSSIA",
            alt: "7620",
            speed: "265",
            radioFreq: 138000000,
            spawnDistance: 50,
            callsign: 50,
            onboard_num: 250,
            details: "(CALLSIGN: Overlord, Freq: 138Mhz AM)",
            hidden: false,
            eplrs: false
        };
    }
    if (awacsType === "RussianAWACSE2C") {
        awacsObj = {
            name: "RussianAWACSE2C",
            type: "E-2C",
            country: "AGGRESSORS",
            alt: "7620",
            speed: "265",
            radioFreq: 137000000,
            spawnDistance: 50,
            callsign: 50,
            onboard_num: 251,
            details: "(CALLSIGN: Chacha, Freq: 137Mhz AM)",
            hidden: false,
            eplrs: true
        };
    }
    if (awacsType === "USAAWACS") {
        awacsObj = {
            name: "USAAWACS",
            type: "E-3A",
            country: "USA",
            alt: "7620",
            speed: "265",
            radioFreq: 139000000,
            spawnDistance: 50,
            callsign: {
                1: 1,
                2: 1,
                3: 1,
                name: "Overlord11"
            },
            onboard_num: 249,
            details: "(CALLSIGN: Overlord, Freq: 139Mhz AM)",
            hidden: false,
            eplrs: true
        };
    }

    const spentPoints = await ddcsControllers.spendResourcePoints(curPlayer, rsCost, "AWACS", awacsObj);
    if (spentPoints) {
        await ddcsControllers.spawnAWACSPlane(curUnit, awacsObj);
    }
}

export async function spawnBomber(curUnit: any, curPlayer: any, bomberType: string, rsCost: number) {
    console.log("BomberType: ", bomberType, rsCost);

    let bomberObj: any;
    if (bomberType === "RussianBomber") {
        bomberObj = {
            name: "RussianBomber",
            type: "Su-25M",
            country: "RUSSIA",
            alt: "2000",
            speed: "233",
            spawnDistance: 50,
            details: "(3 * Su-24M)",
            hidden: false
        };
    }
    if (bomberType === "USABomber") {
        bomberObj = {
            name: "USABomber",
            type: "B-1B",
            country: "USA",
            alt: "2000",
            speed: "233",
            spawnDistance: 50,
            details: "(1 * B-1B)",
            hidden: false
        };
    }

    const spentPoints = await ddcsControllers.spendResourcePoints(curPlayer, rsCost, "Bomber", bomberObj);
    if (spentPoints) {
        await ddcsControllers.spawnBomberPlane(curUnit, bomberObj);
    }
}

export async function spawnCrateFromLogi(
    unit: any,
    type: string,
    crates: string,
    special: string,
    mobile: boolean,
    mass: number,
    crateType: string
) {
    const engineCache = ddcsControllers.getEngineCache();
    const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: unit.playername});
    const curPly = curPlayerArray[0];
    const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
    const curUnitDict = _.find(engineCache.unitDictionary, (uD) => _.includes(uD.comboName, type) );
    const isCombo = !!curUnitDict;
    // console.log(unit, type, crates, isCombo, special, mobile, mass, crateType);
    let spc: string;
    let crateObj;
    let crateCount = 0;
    if (special) {
        spc = special;
    } else {
        spc = "";
    }

    if (unit.inAir) {
        await ddcsControllers.sendMesgToGroup(
            curPly,
            unit.groupId,
            "G: " + i18n.LANDBEFORECARGOCOMMAND,
            5
        );
    } else {
        const player = await ddcsControllers.srvPlayerActionsRead({name: unit.playername});
        const curPlayer = player[0];
        let closeLogi = "";
        const normalCrateBases = await ddcsControllers.campaignAirfieldActionRead({});
        // const checkAllBase: any[] = [];
        let curLogistic;
        const aliveBases = await ddcsControllers.unitActionRead({_id:  /Shelter/, dead: false, coalition: unit.coalition});
        // console.log("AB: ", aliveBases);
        for (const base of normalCrateBases) {
            curLogistic = _.find(aliveBases, {name: base._id + " Shelter"});
            if (!!curLogistic) {
                const isPlayerInProximity = await ddcsControllers.isPlayerInProximity(
                    curLogistic.lonLatLoc,
                    0.2,
                    unit.playername
                );

                if (isPlayerInProximity) {
                    closeLogi = base._id;
                }
            }
        }
        if (closeLogi !== "") {
            const delCrates = await ddcsControllers.unitActionRead({isCrate: true, dead: false, playerOwnerId: curPlayer.ucid});
            // console.log("CRATES: ", curPlayer, checkAllBase, delCrates, crateCount, engineCache.campaign.maxCrates, closeLogi);

            for (const crate of delCrates) {
                if (crateCount > (engineCache.campaign.maxCrates - 2)) {
                    await ddcsControllers.destroyUnit(crate._id, "static");
                }
                crateCount++;
            }

            let curShapeName: string;
            const curCrate = _.find(engineCache.unitDictionary, {_id: crateType});
            if (curCrate) {
                curShapeName = curCrate.shape_name;
            } else {
                curShapeName = "bw_container_cargo";
            }
            const curName = "CU|" + curPlayer.ucid + "|" + crates + "|" + isCombo + "|" +
                ((spc) ? spc : type) + "|" + mobile + "|" + closeLogi + "|#" + _.random(1000000, 9999999);

            crateObj = {
                _id: curName,
                name: curName,
                unitLonLatLoc: unit.lonLatLoc,
                shape_name: curShapeName,
                unitCategory: "Cargos",
                type: crateType,
                hdg: unit.hdg,
                heading: unit.hdg,
                canCargo: true,
                mass,
                playerOwnerId: curPlayer.ucid,
                templateName: type,
                special: spc,
                crateAmt: crates,
                isCombo,
                playerCanDrive: mobile || false,
                country: ddcsControllers.defCountrys[unit.coalition],
                side: unit.coalition,
                coalition: unit.coalition,
                lonLatLoc: ddcsControllers.getLonLatFromDistanceDirection(unit.lonLatLoc, unit.hdg, 0.05)
            };

            await ddcsControllers.spawnStaticBaseBuilding(crateObj, false);
            // await ddcsControllers.spawnLogiCrate(crateObj, true);

            await ddcsControllers.sendMesgToGroup(
                curPly,
                unit.groupId,
                "G: " + i18n.CRATEHASBEENSPAWNED.replace("#1",  _.toUpper(spc) + " " + type),
                5
            );
        } else {
            await ddcsControllers.sendMesgToGroup(
                curPly,
                unit.groupId,
                "G: " + i18n.YOUARENOTCLOSEENOUGHTOCOMMANDCENTER,
                5
            );
        }
    }
}

export async function spawnDefHeli(curUnit: any, curPlayer: any, heliType: string, rsCost: number) {
    console.log("HeliType: ", heliType, rsCost);

    let heliObj: any;
    if (heliType === "RussianDefHeli") {
        heliObj = {
            name: "RussianDefHeli",
            type: "Mi-24V",
            country: "RUSSIA",
            alt: "1000",
            speed: "55",
            hidden: false
        };
    }
    if (heliType === "USADefHeli") {
        heliObj = {
            name: "USADefHeli",
            type: "AH-1W",
            country: "USA",
            alt: "1000",
            speed: "55",
            hidden: false
        };
    }

    const spentPoints = await ddcsControllers.spendResourcePoints(curPlayer, rsCost, "DefHeli", heliObj);
    if (spentPoints) {
        await ddcsControllers.spawnDefenseChopper(curUnit, heliObj);
    }
}

export async function spawnReinforcements(curUnit: any, curPlayer: any, reinforcementType: string, cost: number, costType: string) {
    const engineCache = ddcsControllers.getEngineCache();
    const spawnDistance = engineCache.campaign.intCargoUnloadDistanceAirfield;
    const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;
    const closeMobsTwo = await ddcsControllers.getMOBsInProximity(
        curUnit.lonLatLoc,
        spawnDistance,
        ddcsControllers.enemyCountry[curUnit.coalition]
    );
    if (closeMobsTwo.length === 0) {
        await ddcsControllers.sendMesgToGroup(
            curPlayer,
            curUnit.groupId,
            "G: You are too far away from a base to spawn any reinforcement groups, you must be within " + spawnDistance + "km of the base",
            5
        );
    } else {
        const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: curUnit.playername});
        const curPlayerFromDb = curPlayerArray[0];
        if (costType === "LP") {
            if (curPlayerFromDb.warbonds >= cost) {
                if (curUnit.inAir) {
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        curUnit.groupId,
                        "G: " + i18n.LANDBEFORECARGOCOMMAND,
                        5
                    );
                } else {
                    spawnReinforcementGroup(curUnit, curUnit.country, reinforcementType, curPlayer);

                }
            } else {
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: You do not have the require lifepoints to spawn this.",
                    5
                );
            }
        } else if (costType === "RS") {
            let rsPoints;
            if (curUnit.side === 1) {
                rsPoints = curPlayer.redRSPoints;
            } else {
                rsPoints = curPlayer.blueRSPoints;
            }
            if (rsPoints >= cost) {
                if (curUnit.inAir) {
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        curUnit.groupId,
                        "G: " + i18n.LANDBEFORECARGOCOMMAND,
                        5
                    );
                } else {
                    await spawnReinforcementGroup(curUnit, curUnit.country, reinforcementType, curPlayer);

                }
            } else {
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: You do not have the require resource points to spawn this.",
                    5
                );
            }
        } else {
            if (curUnit.inAir) {
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: " + i18n.LANDBEFORECARGOCOMMAND,
                    5
                );
            } else {
                await spawnReinforcementGroup(curUnit, curUnit.country, reinforcementType, curPlayer);

            }
        }
    }
}

export async function spawnTanker(curUnit: any, curPlayer: any, tankerType: string, rsCost: number) {
    let tankerObj: any;
    const safeSpawnDistance: number = 100;
    let remoteLoc: number[];

    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;
    console.log("tankerType: ", tankerType, rsCost);

    if (tankerType === "BHABTKR") {
        tankerObj = {
            name: "BHABTKR",
            type: "KC-135",
            country: "USA",
            alt: "7620",
            speed: "244",
            tacan: {
                enabled: true,
                channel: 33,
                modeChannel: "Y",
                frequency: 1120000000
            },
            radioFreq: 125000000,
            spawnDistance: 50,
            callsign: {
                1: 2,
                2: 1,
                3: 1,
                name: "Arco11"
            },
            onboard_num: 135,
            details: "(TACAN: 33X, CALLSIGN: Arco, Freq: 125Mhz AM)",
            hidden: false
        };
    }
    if (tankerType === "BHADTKR") {
        tankerObj = {
            name: "BHADTKR",
            type: "IL-78M",
            country: "UKRAINE",
            alt: "7620",
            speed: "265",
            tacan: {
                enabled: false
            },
            radioFreq: 126000000,
            spawnDistance: 50,
            callsign: 78,
            onboard_num: 78,
            details: "(CALLSIGN: 78, Freq: 126Mhz AM)",
            hidden: false
        };
    }
    if (tankerType === "BLABTKR") {
        tankerObj = {
            name: "BLABTKR",
            type: "KC-135",
            country: "USA",
            alt: "4572",
            speed: "239",
            tacan: {
                enabled: true,
                channel: 35,
                modeChannel: "Y",
                frequency: 1122000000
            },
            radioFreq: 127500000,
            spawnDistance: 50,
            callsign: {
                1: 3,
                2: 1,
                3: 1,
                name: "Shell11"
            },
            onboard_num: 135,
            details: "(TACAN: 35X, CALLSIGN: Shell, Freq: 127.5Mhz AM)",
            hidden: false
        };
    }
    if (tankerType === "BLADTKR") {
        tankerObj = {
            name: "BLADTKR",
            type: "KC130",
            country: "USA",
            alt: "4572",
            speed: "239",
            tacan: {
                enabled: true,
                channel: 36,
                modeChannel: "Y",
                frequency: 1123000000
            },
            radioFreq: 128000000,
            spawnDistance: 50,
            callsign: {
                1: 1,
                2: 1,
                3: 1,
                name: "Texaco11"
            },
            onboard_num: 130,
            details: "(TACAN: 36X, CALLSIGN: Texaco, Freq: 128Mhz AM)",
            hidden: false
        };
    }
    if (tankerType === "RHADTKR") {
        tankerObj = {
            name: "RHADTKR",
            type: "IL-78M",
            country: "RUSSIA",
            alt: "7620",
            speed: "239",
            tacan: {
                enabled: false
            },
            radioFreq: 130000000,
            spawnDistance: 50,
            callsign: 78,
            onboard_num: 78,
            details: "(CALLSIGN: 78, Freq: 130Mhz AM)",
            hidden: false
        };
    }
    if (tankerType === "RLABTKR") {
        tankerObj = {
            name: "RLABTKR",
            type: "KC-135",
            country: "AGGRESSORS",
            alt: "4572",
            speed: "239.217",
            tacan: {
                enabled: true,
                channel: 43,
                modeChannel: "Y",
                frequency: 1130000000
            },
            radioFreq: 131000000,
            spawnDistance: 50,
            callsign: {
                1: 1,
                2: 1,
                3: 1,
                name: "Texaco11"
            },
            onboard_num: 135,
            details: "(TACAN: 43X, CALLSIGN: Texaco, Freq: 131Mhz AM)",
            hidden: false
        };
    }
    if (tankerType === "RLADTKR") {
        tankerObj = {
            name: "RLADTKR",
            type: "KC130",
            country: "RUSSIA",
            alt: "4572",
            speed: "239.217",
            tacan: {
                enabled: true,
                channel: 44,
                modeChannel: "Y",
                frequency: 1131000000
            },
            radioFreq: 132000000,
            spawnDistance: 50,
            callsign: 130,
            onboard_num: 130,
            details: "(TACAN: 44X, CALLSIGN: 130, Freq: 132Mhz AM)",
            hidden: false
        };
    }

    remoteLoc = ddcsControllers.getLonLatFromDistanceDirection(curUnit.lonLatLoc, curUnit.hdg, tankerObj.spawnDistance);

    const closeMOBs1 = await ddcsControllers.getMOBsInProximity(
        remoteLoc,
        safeSpawnDistance,
        ddcsControllers.enemyCountry[curUnit.coalition]
    );
    const closeMOBs2 = await ddcsControllers.getMOBsInProximity(
        curUnit.lonLatLoc,
        safeSpawnDistance,
        ddcsControllers.enemyCountry[curUnit.coalition]
    );

    if (closeMOBs1.length > 0 || closeMOBs2.length > 0) {
        await ddcsControllers.sendMesgToGroup(
            curPlayer,
            curUnit.groupId,
            "G: " + i18n.SPAWNTANKERFARTHERAWAYFROMENEMYBASE,
            5
        );
    } else {
        const spentPoints = await ddcsControllers.spendResourcePoints(curPlayer, rsCost, "Tanker", tankerObj);
        if (spentPoints) {
            await ddcsControllers.spawnTankerPlane(curUnit, tankerObj, curUnit.lonLatLoc, remoteLoc);
        }
    }
}

export async function unpackCrate(
    playerUnit: any,
    country: number,
    type: string,
    special: string,
    combo: boolean,
    mobile: boolean,
    facingPlayerHeading?: boolean
) {
    const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: playerUnit.playername});
    const curPlayer = curPlayerArray[0];
    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;
    const curTimePeriod = engineCache.campaign.timePeriod || "modern";
    let spawnHeading: number;
    let addSpawnHeading: number;
    let curUnit: number;
    let delUnits: typing.IUnit[];
    let grpGroups: any;
    if (playerUnit.inAir) {
        await ddcsControllers.sendMesgToGroup(
            curPlayer,
            playerUnit.groupId,
            "G: " + i18n.LANDBEFORECARGOCOMMAND,
            5
        );
        return false;
    } else {
        await ddcsControllers.srvPlayerActionsUpdateacquisitionsUnpacked(curPlayer);
        delUnits = await ddcsControllers.unitActionReadStd({
            playerOwnerId: curPlayer.ucid,
            isCrate: false,
            dead: false,
            isTroop: false
        });
        curUnit = 0;
        grpGroups = _.groupBy(delUnits, "groupName");
        addSpawnHeading = 119;
        if (facingPlayerHeading) {
            addSpawnHeading = 0;
        }
        let newSpawnArray: any[] = [];
        let unpackCost: number = 0;
        if (combo) {
            // console.log("Is Combo Unit");
            const addHdg = 30;
            spawnHeading = playerUnit.hdg;
            let curUnitHdg = playerUnit.hdg;
            let randInc = _.random(1000000, 9999999);
            const findUnits = _.filter(engineCache.unitDictionary, (curUnitDict) => {
                return _.includes(curUnitDict.comboName, type);
            });

            for (const cbUnit of findUnits) {
                randInc += 1;
                const genName = "DU|" + curPlayer.ucid + "|" + cbUnit.type + "|" + special + "|true|" + mobile + "|" +
                    curPlayer.name + "|";
                const spawnUnitCount = cbUnit.config[curTimePeriod].spawnCount;
                unpackCost = (spawnUnitCount * cbUnit.warbondCost) + unpackCost;
                for (let x = 0; x < spawnUnitCount; x++) {
                    if (curUnitHdg > 359) {
                        curUnitHdg = 30;
                    }
                    if (spawnHeading > 359) {
                        spawnHeading = spawnHeading - 359;
                    }
                    const curUnitStart = _.cloneDeep(cbUnit) as any;
                    curUnitStart.groupName = genName + randInc;
                    curUnitStart.name = genName + (randInc + x);
                    // console.log("curUnitStart.name:", curUnitStart.name);
                    curUnitStart.lonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(playerUnit.lonLatLoc, curUnitHdg, 0.08);
                    curUnitStart.hdg = spawnHeading;
                    // console.log("curUnitStart.hdg:", curUnitStart.hdg);
                    curUnitStart.country = country;
                    if (_.includes(cbUnit.type, "HQ-7_STR_SP")) {
                        curUnitStart.playerCanDrive = false;
                    } else {
                        curUnitStart.playerCanDrive = mobile || false;
                    }
                    curUnitStart.coalition = playerUnit.coalition;

                    newSpawnArray.push(curUnitStart);
                    curUnitHdg = curUnitHdg + addHdg;
                    spawnHeading = spawnHeading + addSpawnHeading;
                }
            }
            const tRem = (Object.keys(grpGroups).length) - engineCache.campaign.maxUnitsMoving;
            if ((unpackCost * engineCache.campaign.slingableDiscount) < curPlayer.warbonds) {
                await ddcsControllers.removeWarbonds(
                    curPlayer,
                    playerUnit,
                    "unpackedUnits",
                    true,
                    Math.round(unpackCost * engineCache.campaign.slingableDiscount)
                );
                // console.log(newSpawnArray.length);
                console.log("acquisition Total Standard: " + Object.keys(grpGroups).length + " Units Over MaX:" + tRem + " Units:");
                for (const gUnitKey of Object.keys(grpGroups)) {
                    if (curUnit <= tRem) {
                        // console.log("Count: " + curUnit + "Combo: " + gUnitKey);
                        for (const unit of grpGroups[gUnitKey]) {
                            await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                            await ddcsControllers.destroyUnit(unit.name, "unit");
                            console.log("Player has too many units, removing:", unit.name);
                        }
                        curUnit++;
                    }
                }
                await ddcsControllers.spawnUnitGroup(newSpawnArray, false);
                return true;
            } else {
            await ddcsControllers.sendMesgToGroup(curPlayer, playerUnit._id, "You do not have enough warbonds to unpack this unit", 5);
            return false;
            }
        } else {
            // console.log("Is not Combo Unit");
            const addHdg = 30;
            addSpawnHeading = 119;
            spawnHeading = playerUnit.hdg;
            let curUnitHdg = playerUnit.hdg;
            let pCountry = country;
            const virtualGroupID = "DU|" + curPlayer.ucid + "|" + type + "|" + special +
            "|true|" + mobile + "|" + curPlayer.name + "|";
            const findUnit = engineCache.unitDictionary.find((ud: { _id: string; }) => ud._id === type);
            // console.log("search: ", type, findUnit);
            if (findUnit) {
                const spawnUnitCount = findUnit.config[curTimePeriod].spawnCount;
                if ((type === "1L13 EWR" || type === "55G6 EWR" || type === "Dog Ear radar") && playerUnit.coalition === 2) {
                    // console.log("EWR: UKRAINE");
                    pCountry = 1;
                }
                unpackCost = spawnUnitCount * findUnit.warbondCost;
                if ((unpackCost * engineCache.campaign.slingableDiscount) < curPlayer.warbonds) {
                    await ddcsControllers.removeWarbonds(
                        curPlayer,
                        playerUnit,
                        "unpackedUnits",
                        true,
                        Math.round(unpackCost * engineCache.campaign.slingableDiscount)
                    );
                    for (let x = 0; x < spawnUnitCount; x++) {
                        const randInc = _.random(1000000, 9999999);
                        const genName = "DU|" + curPlayer.ucid + "|" + type + "|" + special +
                            "|true|" + mobile + "|" + curPlayer.name + "|";
                        const unitStart = _.cloneDeep(findUnit);
                        if (curUnitHdg > 359) {
                            curUnitHdg = 30;
                        }
                        if (spawnHeading > 359) {
                            spawnHeading = spawnHeading - 359;
                        }
                        unitStart.name = genName + (randInc + x);
                        unitStart.groupName = genName + randInc;
                        unitStart.lonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(playerUnit.lonLatLoc, curUnitHdg, 0.08);
                        unitStart.hdg = spawnHeading;
                        unitStart.country = pCountry;
                        unitStart.playerCanDrive = mobile || false;
                        unitStart.special = special;
                        unitStart.coalition = playerUnit.coalition;
                        unitStart.virtualGrpName = virtualGroupID;
                        newSpawnArray.push(unitStart);
                        curUnitHdg = curUnitHdg + addHdg;
                        spawnHeading = spawnHeading + addSpawnHeading;
                        await ddcsControllers.spawnUnitGroup(newSpawnArray, false);
                        newSpawnArray = [];
                        delUnits = await ddcsControllers.unitActionReadStd({
                            playerOwnerId: curPlayer.ucid,
                            isCrate: false,
                            isTroop: false,
                            dead: false
                        });
                        curUnit = 0;
                        grpGroups = _.groupBy(delUnits, "groupName");
                        const tRem = Object.keys(grpGroups).length - engineCache.campaign.maxUnitsMoving;

                        console.log("acquisition Total Standard: " + Object.keys(grpGroups).length +
                            " Units Over MaX:" + tRem + " Units:");

                        for (const gUnitKey of Object.keys(grpGroups)) {
                            // console.log("Count: " + curUnit + "Standard: " + gUnitKey);
                            if (curUnit <= tRem) {
                                for (const unit of grpGroups[gUnitKey]) {
                                    await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                                    await ddcsControllers.destroyUnit(unit.name, "unit");
                                    console.log("Player has too many units, removing:", unit.name);
                                }
                                curUnit++;
                            }
                        }
                    }


                    return true;
                } else {
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        playerUnit._id,
                        "You do not have enough warbonds to unpack this unit",
                        5
                    );
                    return false;
                }
            } else {
                console.log("Count not find unit: line 1172: ", type);
                return false;
            }
        }
    }
}

export async function spawnReinforcementGroup(
    playerUnit: any,
    country: number,
    reinforcementType: string,
    curPlayer: any
) {
    // console.log("sRG:Starting Function");
    let reinforcementArray: string[];
    reinforcementArray = [""];
    // console.log("sRG:curPlayer", curPlayer);
    const engineCache = await ddcsControllers.getEngineCache();
    // console.log("sRG:getEngineCache");
    const curTimePeriod = engineCache.campaign.timePeriod || "modern";
    // console.log("sRG:curTimePeriod", curTimePeriod);
    // console.log("sRG:playerUnit.inAir", playerUnit.inAir);
    if (reinforcementType === "SAM Brigade(12LP)") {
        if (curPlayer.sideLock === 2) {
            reinforcementArray = ["Patriot", "NASAMS-C", "Tor 9A331", "Gepard", "M6 Linebacker"];
        } else {
            reinforcementArray = ["SA-10", "Tor 9A331", "2S6 Tunguska", "Strela-10M3", "Strela-10M3"];
        }
    }
    if (reinforcementType === "Armoured Company(12LP)") {
        if (curPlayer.sideLock === 2) {
            reinforcementArray = ["M-1 Abrams", "Leopard-2", "Merkava_Mk4", "M-2 Bradley", "M-2 Bradley"];
        } else {
            reinforcementArray = ["Leclerc", "T-90", "T-72B", "BMP-3", "BMP-3"];
        }
    }
    if (reinforcementType === "Mixed Brigade(12LP)") {
        if (curPlayer.sideLock === 2) {
            reinforcementArray = ["Challenger2", "M1128 Stryker MGS", "M-2 Bradley", "Gepard", "M6 Linebacker"];
        } else {
            reinforcementArray = ["T-80UD", "BMP-3", "BMP-3", "Strela-10M3", "Strela-10M3"];
        }
    }
    // console.log("sRG:reinforcementType", reinforcementType);
    // console.log("sRG:reinforcementArray", reinforcementArray);
    let spawnDistance = 0.06;
    await ddcsControllers.srvPlayerSpendLifePoints(curPlayer._id, playerUnit.groupId, 12, "LP Removed for Spawning Rinforcement Group");
    for (const type of reinforcementArray) {
        // console.log("type:", type);
        await spawnRinGroups(playerUnit, curPlayer, country, type, "", true, engineCache, curTimePeriod, spawnDistance);
        spawnDistance = spawnDistance + 0.02;
    }
}

export async function spawnRinGroups(
    playerUnit: any,
    curPlayer: any,
    country: number,
    type: string,
    special: string,
    mobile: boolean,
    engineCache: any,
    curTimePeriod: any,
    spawnDistance: any
) {
    // console.log("sRG:type", type);
    let spawnHeading: number;
    let delUnits: typing.IUnit[];
    let grpGroups: any;
    const curUnitDict = _.find(engineCache.unitDictionary, (uD) => _.includes(uD.comboName, type) );
    const combo = !!curUnitDict;
    delUnits = await ddcsControllers.unitActionReadStd({
        playerOwnerId: curPlayer.ucid,
        playerCanDrive: mobile || false,
        isCrate: false,
        dead: false,
        isTroop: false
    });
    let curUnit = 0;
    grpGroups = _.groupBy(delUnits, "groupName");

    let newSpawnArray: any[] = [];
    if (combo) {
        // console.log("Is Combo Unit");
        const addHdg = 30;
        const addSpawnHeading = 119;
        spawnHeading = playerUnit.hdg;
        let curUnitHdg = playerUnit.hdg;
        let randInc = _.random(1000000, 9999999);
        const findUnits = _.filter(engineCache.unitDictionary, (curDictUnit) => {
            return _.includes(curDictUnit.comboName, type);
        });
        for (const cbUnit of findUnits) {
            randInc += 1;
            const genName = "DU|" + curPlayer.ucid + "|" + cbUnit.type + "|" + special + "|true|" + mobile + "|" +
                curPlayer.name + "|";
            const spawnUnitCount = cbUnit.config[curTimePeriod].spawnCount;
            for (let x = 0; x < spawnUnitCount; x++) {
                if (curUnitHdg > 359) {
                    curUnitHdg = 30;
                }
                if (spawnHeading > 359) {
                    spawnHeading = spawnHeading - 359;
                }
                const curUnitStart = _.cloneDeep(cbUnit) as any;
                curUnitStart.groupName = genName + randInc;
                curUnitStart.name = genName + (randInc + x);
                // console.log("curUnitStart.name:", curUnitStart.name);
                curUnitStart.lonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(playerUnit.lonLatLoc, curUnitHdg, spawnDistance);
                curUnitStart.hdg = spawnHeading;
                // console.log("curUnitStart.hdg:", curUnitStart.hdg);
                curUnitStart.country = country;
                if (_.includes(cbUnit.type, "HQ-7_STR_SP")) {
                    curUnitStart.playerCanDrive = false;
                } else {
                    curUnitStart.playerCanDrive = mobile || false;
                }
                curUnitStart.coalition = playerUnit.coalition;

                newSpawnArray.push(curUnitStart);
                curUnitHdg = curUnitHdg + addHdg;
                spawnHeading = spawnHeading + addSpawnHeading;
            }
        }
        const tRem = (Object.keys(grpGroups).length) - engineCache.campaign.maxUnitsMoving;
        // console.log(newSpawnArray.length);
        for (const gUnitKey of Object.keys(grpGroups)) {
                if (curUnit <= tRem) {
                    for (const unit of grpGroups[gUnitKey]) {
                        await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                        await ddcsControllers.destroyUnit(unit.name, "unit");
                        console.log("Player has too many units, removing:", unit.name);
                    }
                    curUnit++;
                }
            }
        await ddcsControllers.spawnUnitGroup(newSpawnArray, false);
        return true;
    } else {
        // console.log("Is not Combo Unit");
        const addHdg = 30;
        const addSpawnHeading = 119;
        spawnHeading = playerUnit.hdg;
        let curUnitHdg = playerUnit.hdg;
        let pCountry = country;
        const virtualGroupID = "DU|" + curPlayer.ucid + "|" + type + "|" + special +
        "|true|" + mobile + "|" + curPlayer.name + "|";
        const findUnit = _.find(engineCache.unitDictionary, {_id: type});
        if (findUnit) {
            const spawnUnitCount = findUnit.config[curTimePeriod].spawnCount;
            if ((type === "1L13 EWR" || type === "55G6 EWR" || type === "Dog Ear radar") && playerUnit.coalition === 2) {
                // console.log("EWR: UKRAINE");
                pCountry = 1;
            }
            for (let x = 0; x < spawnUnitCount; x++) {
                const randInc = _.random(1000000, 9999999);
                const genName = "DU|" + curPlayer.ucid + "|" + type + "|" + special +
                    "|true|" + mobile + "|" + curPlayer.name + "|";
                const unitStart = _.cloneDeep(findUnit);
                if (curUnitHdg > 359) {
                    curUnitHdg = 30;
                }
                if (spawnHeading > 359) {
                    spawnHeading = spawnHeading - 359;
                }
                unitStart.name = genName + (randInc + x);
                unitStart.groupName = genName + randInc;
                unitStart.lonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(playerUnit.lonLatLoc, curUnitHdg, spawnDistance);
                unitStart.hdg = spawnHeading;
                unitStart.country = pCountry;
                unitStart.playerCanDrive = mobile || false;
                unitStart.special = special;
                unitStart.coalition = playerUnit.coalition;
                unitStart.virtualGrpName = virtualGroupID;
                newSpawnArray.push(unitStart);
                curUnitHdg = curUnitHdg + addHdg;
                spawnHeading = spawnHeading + addSpawnHeading;
                await ddcsControllers.spawnUnitGroup(newSpawnArray, false);
                newSpawnArray = [];
                delUnits = await ddcsControllers.unitActionReadStd({
                    playerOwnerId: curPlayer.ucid,
                    playerCanDrive: mobile || false,
                    isCrate: false,
                    dead: false,
                    isTroop: false
                });
                curUnit = 0;

                grpGroups = _.groupBy(delUnits, "groupName");
                const tRem = (Object.keys(grpGroups).length + (spawnUnitCount - 1)) - engineCache.campaign.maxUnitsMoving;

                for (const gUnitKey of Object.keys(grpGroups)) {
                    if (curUnit <= tRem) {
                        for (const unit of grpGroups[gUnitKey]) {
                            await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                            await ddcsControllers.destroyUnit(unit.name, "unit");
                            console.log("Player has too many units, removing:", unit.name);
                        }
                        curUnit++;
                    }
                }
            }
            return true;
        } else {
            console.log("Count not find unit: line 1172: ", type);
            return false;
        }
    }
}

export async function setInternalCargoMass(
    playerUnit: any,
    massKG: number
) {
    console.log(playerUnit, massKG);
    await ddcsControllers.sendUDPPacket("frontEnd", {
        actionObj: {
            action: "CMD",
            cmd: ["trigger.action.setUnitInternalCargo( \"" + playerUnit + "\", " + massKG + ")"],
            reqID: 0
        }
    });
    // console.log("aircraft mass is", massKG);
}


export async function deployTroops(
    unitId: string,
    curPlayer: any,
    i18n: any,
    proxyPlayer: boolean,
    engineCache: any,
    troopType: any,
    lonLatStart: number[],
    aglStart: number,
    timeTaken: number
) {
    const units = await ddcsControllers.unitActionRead({unitId});
    const curUnit = units[0];
    const lonLatEnd = curUnit.lonLatLoc;
    const distanceMovedXZ = ddcsControllers.calcDirectDistanceInKm(lonLatStart[1], lonLatStart[0], lonLatEnd[1], lonLatEnd[0]) * 1000;
    const distanceMovedY = Math.abs(aglStart - curUnit.agl);
    const distanceXYZ = Math.sqrt((distanceMovedXZ * distanceMovedXZ) + (distanceMovedY * distanceMovedY));
    const avgVelocity = distanceXYZ / timeTaken;
    let grpGroups: any;
    if (proxyPlayer) {
        if (avgVelocity > 5) {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: You moved too much while the troops were disembarking, none survived",
                5
            );
        } else {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: " + i18n.HASBEENDROPPEDOFFATBASE.replace("#1", troopType),
                5
            );
            await ddcsControllers.unitActionUpdateByUnitId({
                unitId,
                troopType: null
            });
        }
    } else {
        if (avgVelocity > 5) {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: You moved too much while the troops were disembarking, none survived",
                5
            );
        } else {
            if (typeof troopType === "string") {
                // console.log("Troop Type Is String");
                const curTroops: any[] = [];
                const randInc = _.random(1000000, 9999999);
                const genName = "TU|" + curPlayer.ucid + "|" + troopType + "|" +
                    curUnit.playername + "|";
                const delUnits = await ddcsControllers.unitActionReadStd({
                    playerOwnerId: curPlayer.ucid,
                    isTroop: true,
                    dead: false
                });
                if (troopType === "MANPAD") {
                    for (const unit of delUnits) {
                        if (unit.type === "Stinger manpad") {
                            // console.log("unit.type is Stinger manpad");
                            await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                            await ddcsControllers.destroyUnit(unit.name, "unit");
                        }

                    }

                }
                let curUnits = 0;
                grpGroups = _.groupBy(delUnits, "groupName");
                const tRem = Object.keys(grpGroups).length - engineCache.campaign.maxTroops;

                for (const gUnitKey of Object.keys(grpGroups)) {
                    if (curUnits <= tRem) {
                        for (const unit of grpGroups[gUnitKey]) {
                            await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                            await ddcsControllers.destroyUnit(unit.name, "unit");
                        }
                        curUnits++;
                    }
                }
                const curSpawnUnit = _.cloneDeep(await ddcsControllers.getRndFromSpawnCat(
                    troopType,
                    curUnit.coalition,
                    false,
                    true
                )[0]);

                for (
                    let x = 0;
                    x < curSpawnUnit.config[engineCache.campaign.timePeriod].spawnCount;
                    x++
                ) {
                    const spawnArray = {
                        name: genName + (randInc + x),
                        groupName: genName + randInc,
                        type: curSpawnUnit.type,
                        lonLatLoc: ddcsControllers.getLonLatFromDistanceDirection(
                            curUnit.lonLatLoc,
                            curUnit.hdg + 30 + (x * 60),
                            0.003
                        ),
                        hdg: curUnit.hdg,
                        country: curUnit.country,
                        unitCategory: curSpawnUnit.unitCategory,
                        playerCanDrive: true,
                        coalition: curUnit.coalition
                    };
                    curTroops.push(spawnArray);
                }
                await ddcsControllers.unitActionUpdateByUnitId({
                    unitId,
                    troopType: null
                })
                    .catch((err) => {
                        console.log("erroring line73: ", err);
                    })
                ;
                await ddcsControllers.spawnUnitGroup(curTroops, false);
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: " + i18n.HASBEENDEPLOYED.replace("#1", curSpawnUnit.type),
                    5
                );
                let currentMass = 500;
                if (curUnit.intCargoType) {
                    currentMass = 1000 ;
                }
                await setInternalCargoMass(curUnit.name, currentMass - 500);
            } else {
                // console.log("troopType is a not string");
                const curTroops: any[] = [];
                const delUnits = await ddcsControllers.unitActionReadStd({
                    playerOwnerId: curPlayer.ucid,
                    isTroop: true,
                    dead: false
                });
                if (troopType[0].spawnCat === "MANPAD") {
                    for (const unit of delUnits) {
                        if (unit.spawnCat === "MANPAD") {
                            await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                            await ddcsControllers.destroyUnit(unit.name, "unit");
                        }

                    }

                }
                let curUnits = 0;
                grpGroups = _.groupBy(delUnits, "groupName");
                const tRem = Object.keys(grpGroups).length - engineCache.campaign.maxTroops;

                for (const gUnitKey of Object.keys(grpGroups)) {
                    if (curUnits <= tRem) {
                        for (const unit of grpGroups[gUnitKey]) {
                            await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                            await ddcsControllers.destroyUnit(unit.name, "unit");
                        }
                        curUnits++;
                    }
                }
                let x = 0;
                for (
                    const unit of troopType
                ) {
                    const spawnArray = {
                        name: unit.name,
                        groupName: unit.groupName,
                        type: unit.type,
                        lonLatLoc: ddcsControllers.getLonLatFromDistanceDirection(
                            curUnit.lonLatLoc,
                            curUnit.hdg + 30 + (x * 10),
                            0.003
                        ),
                        hdg: curUnit.hdg,
                        country: unit.country,
                        unitCategory: unit.unitCategory,
                        playerCanDrive: true,
                        coalition: curUnit.coalition
                    };
                    curTroops.push(spawnArray);
                    x = x + 1;
                }
                await ddcsControllers.unitActionUpdateByUnitId({
                    unitId,
                    troopType: null
                })
                    .catch((err) => {
                        console.log("erroring line73: ", err);
                    })
                ;
                // console.log("spawning Unit");
                await ddcsControllers.spawnUnitGroup(curTroops, false);
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: " + i18n.HASBEENDEPLOYED.replace("#1", troopType[0].type),
                    5
                );
                let currentMass = 500;
                if (curUnit.intCargoType) {
                    currentMass = 1000 ;
                }
                await setInternalCargoMass(curUnit.name, currentMass - 500);
            }
        }
    }
}

export async function unloadExtractTroops(curUnit: any, curPlayer: any, i18n: any, pObj: any, engineCache: any) {
    const units = await ddcsControllers.unitActionRead({playername: curPlayer.name, dead: false});
    let grpGroups: any;
    if (units[0].inAir || units[0].speed > 1 || units[0].dead) {
        await ddcsControllers.sendMesgToGroup(
            curPlayer,
            curUnit.groupId,
            "G: Troops were unable to embark/disembark because you were moving",
            5
        );
    } else {
        if (await isTroopOnboard(curUnit)) {
            // console.log("troop is on board");
            const playerProx: any[] = [];
            const bases = await ddcsControllers.campaignAirfieldActionRead({baseType: "MOB", side: curUnit.coalition});
            if (units[0].troopType !== "" && units[0].troopType !== null) {
                for (const base of bases) {
                    playerProx.push(await ddcsControllers.isPlayerInProximity(
                        base.centerLoc,
                        engineCache.campaign.troopUnloadDistance,
                        curUnit.playername
                    ));
                }
                if (_.some(playerProx)) {
                    await ddcsControllers.unitActionUpdateByUnitId({
                        unitId: pObj.unitId,
                        troopType: null
                    });
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        curUnit.groupId,
                        "G: " + i18n.HASBEENDROPPEDOFFATBASE.replace("#1", curUnit.troopType),
                        5
                    );
                    let currentMass = 500;
                    if (curUnit.intCargoType) {
                        currentMass = 1000 ;
                    }
                    await setInternalCargoMass(curUnit.name, currentMass - 500);
                } else {
                    await ddcsControllers.unitActionUpdateByUnitId({
                        unitId: pObj.unitId,
                        troopType: null
                    });
                    if (typeof curUnit.troopType === "string") {
                        // console.log("troopType is a string");
                        const curTroops: any[] = [];
                        const randInc = _.random(1000000, 9999999);
                        const genName = "TU|" + curPlayer.ucid + "|" + curUnit.troopType + "|" +
                            curUnit.playername + "|";
                        const delUnits = await ddcsControllers.unitActionReadStd({
                            playerOwnerId: curPlayer.ucid,
                            isTroop: true,
                            dead: false
                        });
                        if (curUnit.troopType === "MANPAD") {
                            for (const unit of delUnits) {
                                if (unit.type === "Stinger manpad") {
                                    await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                                    await ddcsControllers.destroyUnit(unit.name, "unit");
                                }

                            }

                        }
                        let curUnits = 0;
                        grpGroups = _.groupBy(delUnits, "groupName");
                        const tRem = Object.keys(grpGroups).length - engineCache.campaign.maxTroops;

                        for (const gUnitKey of Object.keys(grpGroups)) {
                            if (curUnits <= tRem) {
                                for (const unit of grpGroups[gUnitKey]) {
                                    await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                                    await ddcsControllers.destroyUnit(unit.name, "unit");
                                }
                                curUnits++;
                            }
                        }
                        const curSpawnUnit = _.cloneDeep(await ddcsControllers.getRndFromSpawnCat(
                            curUnit.troopType,
                            curUnit.coalition,
                            false,
                            true
                        )[0]);

                        for (
                            let x = 0;
                            x < curSpawnUnit.config[engineCache.campaign.timePeriod].spawnCount;
                            x++
                        ) {
                            const spawnArray = {
                                name: genName + (randInc + x),
                                groupName: genName + randInc,
                                type: curSpawnUnit.type,
                                lonLatLoc: ddcsControllers.getLonLatFromDistanceDirection(
                                    curUnit.lonLatLoc,
                                    curUnit.hdg + (x * 10),
                                    0.05
                                ),
                                hdg: curUnit.hdg,
                                country: curUnit.country,
                                unitCategory: curSpawnUnit.unitCategory,
                                playerCanDrive: true,
                                coalition: curUnit.coalition
                            };
                            curTroops.push(spawnArray);
                        }
                        await ddcsControllers.unitActionUpdateByUnitId({
                            unitId: pObj.unitId,
                            troopType: null
                        })
                            .catch((err) => {
                                console.log("erroring line73: ", err);
                            })
                        ;
                        // console.log("spawning Unit");
                        await ddcsControllers.spawnUnitGroup(curTroops, false);
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.HASBEENDEPLOYED.replace("#1", curSpawnUnit.type),
                            5
                        );
                        let currentMass = 500;
                        if (curUnit.intCargoType) {
                            currentMass = 1000 ;
                        }
                        await setInternalCargoMass(curUnit.name, currentMass - 500);
                    } else {
                        // console.log("troopType is a not string");
                        const curTroops: any[] = [];
                        const delUnits = await ddcsControllers.unitActionReadStd({
                            playerOwnerId: curPlayer.ucid,
                            isTroop: true,
                            dead: false
                        });
                        if (curUnit.troopType[0].spawnCat === "MANPAD") {
                            for (const unit of delUnits) {
                                if (unit.spawnCat === "MANPAD") {
                                    await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                                    await ddcsControllers.destroyUnit(unit.name, "unit");
                                }

                            }

                        }
                        let curUnits = 0;
                        grpGroups = _.groupBy(delUnits, "groupName");
                        const tRem = Object.keys(grpGroups).length - engineCache.campaign.maxTroops;

                        for (const gUnitKey of Object.keys(grpGroups)) {
                            if (curUnits <= tRem) {
                                for (const unit of grpGroups[gUnitKey]) {
                                    await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                                    await ddcsControllers.destroyUnit(unit.name, "unit");
                                }
                                curUnits++;
                            }
                        }
                        let x = 0;
                        for (
                            const unit of curUnit.troopType
                            ) {
                            const spawnArray = {
                                name: unit.name,
                                groupName: unit.groupName,
                                type: unit.type,
                                lonLatLoc: ddcsControllers.getLonLatFromDistanceDirection(
                                    curUnit.lonLatLoc,
                                    curUnit.hdg + (x * 10),
                                    0.05
                                ),
                                hdg: curUnit.hdg,
                                country: unit.country,
                                unitCategory: unit.unitCategory,
                                playerCanDrive: true,
                                coalition: curUnit.coalition
                            };
                            curTroops.push(spawnArray);
                            x = x + 1;
                        }
                        await ddcsControllers.unitActionUpdateByUnitId({
                            unitId: pObj.unitId,
                            troopType: null
                        })
                            .catch((err) => {
                                console.log("erroring line73: ", err);
                            })
                        ;
                        // console.log("spawning Unit");
                        await ddcsControllers.spawnUnitGroup(curTroops, false);
                        await ddcsControllers.sendMesgToGroup(
                            curPlayer,
                            curUnit.groupId,
                            "G: " + i18n.HASBEENDEPLOYED.replace("#1", curUnit.troopType[0].type),
                            5
                        );
                        let currentMass = 500;
                        if (curUnit.intCargoType) {
                            currentMass = 1000 ;
                        }
                        await setInternalCargoMass(curUnit.name, currentMass - 500);

                    }
                }
            }  else {
                console.log("There are no more troops onboard");
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G:" + i18n.NOTROOPSTOEXTRACTORUNLOAD,
                    5
                );
            }
        } else {
            const troopUnits = await ddcsControllers.getTroopsInProximity(curUnit.lonLatLoc, 0.2, curUnit.coalition);
            const curTroop = troopUnits[0];
            if (curTroop) {
                // pickup troop
                const grpUnits = await ddcsControllers.unitActionRead({
                    groupName: curTroop.groupName,
                    isCrate: false,
                    dead: false
                });
                for (const curTroopUnit of grpUnits) {
                    await ddcsControllers.destroyUnit(curTroopUnit.name, "unit");
                }
                await ddcsControllers.unitActionUpdateByUnitId({
                    unitId: pObj.unitId,
                    troopType: grpUnits
                })
                    .catch((err) => {
                        console.log("erroring line57: ", err);
                    });
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: " + i18n.PICKEDUP.replace("#1", curTroop.type),
                    5
                );
                let currentMass = 0;
                if (curUnit.intCargoType) {
                    currentMass = 500 ;
                }
                await setInternalCargoMass(curUnit.name, currentMass + 500);
            } else {
                // no troops
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G:" + i18n.NOTROOPSTOEXTRACTORUNLOAD,
                    5
                );
            }
        }
    }
}

export async function unpackInternalCargo(curUnit: any, curPlayer: any, curInternalCargo: any, curBaseObj: any, i18n: any, crateType: any) {
    let shelterAlive: typing.IUnit[] = [];
    let commsTowerAlive: typing.IUnit[] = [];
    const units = await ddcsControllers.unitActionRead({playername: curPlayer.name, dead: false});
    if (units[0]) {
        const deltaAGL = Math.abs(curUnit.agl - units[0].agl);
        const lonLatStart = curUnit.lonLatLoc;
        const lonLatEnd = units[0].lonLatLoc;
        const distanceMovedXZ = ddcsControllers.calcDirectDistanceInKm(lonLatStart[1], lonLatStart[0], lonLatEnd[1], lonLatEnd[0]) * 1000;
        // recheck to see if internal crate still exists
        const unitInternal = await ddcsControllers.unitActionRead({unitId: curUnit.unitId});

        if (curBaseObj) {
            shelterAlive = await ddcsControllers.unitActionRead({
                _id:  curBaseObj._id + " Shelter",
                dead: false,
                coalition: curUnit.coalition
            });

            commsTowerAlive = await ddcsControllers.unitActionRead({
                _id:  curBaseObj._id + " Comms tower M",
                dead: false,
                coalition: curUnit.coalition
            });
        }

        // console.log("Test: ", !unitInternal[0].intCargoType, unitInternal[0], unitInternal);
        if (distanceMovedXZ > 1 || deltaAGL > 1 || units[0].dead) {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: You were unable to unload your internal cargo, please remain still until it has unloaded.",
                5
            );
        } else if (!unitInternal[0].intCargoType) {
            console.log("You no longer have crate onboard ", curPlayer.name);
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: You no longer have an internal crate loaded2",
                5
            );
        } else {
            if (await isTroopOnboard(curUnit)) {
                await setInternalCargoMass(curUnit.name, 1000);
            } else {
                await setInternalCargoMass(curUnit.name, 0);
            }
            if (curInternalCargo === "BaseRepair") {
                console.log("unpack Int Cargo: shelterAlive: ", shelterAlive.length, " Comms Tower Alive: ",
                    commsTowerAlive.length, " - ", shelterAlive.length > 0 && commsTowerAlive.length > 0);
                if (shelterAlive.length > 0 && commsTowerAlive.length > 0) {
                    console.log("Base doesnt need a repair! Comms tower and Shelter is healthy", curPlayer.name);
                    await ddcsControllers.sendMesgToGroup(
                        curPlayer,
                        curUnit.groupId,
                        "G: Base doesnt need a repair! Comms tower and Shelter is healthy",
                        5
                    );
                } else {
                    console.log("int cargo base is being repaired", curPlayer.name);
                    await ddcsControllers.repairBase(curBaseObj, curUnit);
                }
            } else if (curInternalCargo === "StrategicBaseBuild") {
                console.log("unpack Int Cargo: StrategicBaseBuild: ", curPlayer.name);
                const isStrategicBaseBuilt = await ddcsControllers.buildStrategicBase(curUnit, curPlayer);
                if (isStrategicBaseBuilt) {
                    await ddcsControllers.unitActionUpdateByUnitId({unitId: curUnit.unitId, intCargoType: ""});
                }
            } else if (curInternalCargo === "JTAC") {
                console.log("JTAC spawned from", curPlayer.name);
                await ddcsControllers.unitActionUpdateByUnitId({unitId: curUnit.unitId, intCargoType: ""});
                await unpackCrate(curUnit, curUnit.country, crateType, "jtac", false, true);
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: " + i18n.SPAWNJTACFROMINTERNALCARGO,
                    5
                );
            } else if (curInternalCargo === "LightAAA") {
                console.log("Light AAA spawned from", curPlayer.name);
                await ddcsControllers.unitActionUpdateByUnitId({unitId: curUnit.unitId, intCargoType: ""});
                await unpackIntCrate(curUnit, curUnit.country, crateType, "", false);
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G:Spawned " + crateType + " from internal cargo.",
                    5
                );
            }
        }
    } else {
        console.log("Cant find player unit for unpacking internal crate");
    }
}

export async function unpackIntCrate(
    playerUnit: any,
    country: number,
    type: string,
    special: string,
    mobile: boolean
) {
    const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: playerUnit.playername});
    const curPlayer = curPlayerArray[0];
    const engineCache = ddcsControllers.getEngineCache();
    await ddcsControllers.srvPlayerActionsUpdateacquisitionsUnpacked(curPlayer);
    let newSpawnArray: any[] = [];
    const addHdg = 30;
    const addSpawnHeading = 119;
    let grpGroups: any;
    let spawnHeading = playerUnit.hdg;
    let curUnitHdg = playerUnit.hdg + 180;
    let pCountry = country;
    const virtualGroupID = "DU|" + curPlayer.ucid + "|" + type + "|" + special +
    "|true|" + mobile + "|" + curPlayer.name + "|";
    const findUnit = _.find(engineCache.unitDictionary, {_id: type});
    if (findUnit) {
        const spawnUnitCount = 1;
        if ((type === "1L13 EWR" || type === "55G6 EWR" || type === "Dog Ear radar") && playerUnit.coalition === 2) {
            // console.log("EWR: UKRAINE");
            pCountry = 1;
        }
        for (let x = 0; x < spawnUnitCount; x++) {
            const randInc = _.random(1000000, 9999999);
            const genName = "DU|" + curPlayer.ucid + "|" + type + "|" + special +
                "|true|" + mobile + "|" + curPlayer.name + "|";
            const unitStart = _.cloneDeep(findUnit);
            if (curUnitHdg > 359) {
                curUnitHdg = curUnitHdg - 359;
            }
            if (spawnHeading > 359) {
                spawnHeading = spawnHeading - 359;
            }
            unitStart.name = genName + (randInc + x);
            unitStart.groupName = genName + randInc;
            unitStart.lonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(playerUnit.lonLatLoc, curUnitHdg, 0.007);
            unitStart.hdg = spawnHeading;
            unitStart.country = pCountry;
            unitStart.playerCanDrive = true;
            unitStart.special = special;
            unitStart.coalition = playerUnit.coalition;
            unitStart.virtualGrpName = virtualGroupID;
            newSpawnArray.push(unitStart);
            curUnitHdg = curUnitHdg + addHdg;
            spawnHeading = spawnHeading + addSpawnHeading;
            await ddcsControllers.spawnUnitGroup(newSpawnArray, false);
            newSpawnArray = [];
            const delUnits = await ddcsControllers.unitActionReadStd({
                playerOwnerId: curPlayer.ucid,
                playerCanDrive: mobile || false,
                isCrate: false,
                dead: false,
                isTroop: false
            });
            let curUnit = 0;
            grpGroups = _.groupBy(delUnits, "groupName");
            const tRem = Object.keys(grpGroups).length - engineCache.campaign.maxUnitsMoving;

            for (const gUnitKey of Object.keys(grpGroups)) {
                if (curUnit <= tRem) {
                    for (const unit of grpGroups[gUnitKey]) {
                        await ddcsControllers.unitActionUpdateByUnitId({unitId: unit.unitId, dead: true});
                        await ddcsControllers.destroyUnit(unit.name, "unit");
                        console.log("Player has too many units, removing:", unit.name);
                    }
                    curUnit++;
                }
            }
        }
        return true;
    } else {
        console.log("Count not find unit: line 1172: ", type);
        return false;
    }
}

export async function packNearbyUnitIntoIntCargo(curUnit: any, curPlayer: any, unitToPack: any) {
    const units = await ddcsControllers.unitActionRead({name: curUnit.name, dead: false});
    if (units.length > 0) {
        const deltaAGL = Math.abs(curUnit.agl - units[0].agl);
        const lonLatStart = curUnit.lonLatLoc;
        const lonLatEnd = units[0].lonLatLoc;
        const distanceMovedXZ = ddcsControllers.calcDirectDistanceInKm(lonLatStart[1], lonLatStart[0], lonLatEnd[1], lonLatEnd[0]) * 1000;

        if (distanceMovedXZ > 1 || deltaAGL > 1 || units[0].dead) {
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: You moved and were unable to pack the unit your internal cargo, please remain still until it has loaded.",
                5
            );
        } else {
            if (unitToPack.dead) {
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G: The " + unitToPack.type + " you attempted to pack was killed before it could be loaded.",
                    5
                );
            } else {
                await ddcsControllers.destroyUnit(unitToPack.name, "unit");
                await ddcsControllers.unitActionUpdateByUnitId({
                    unitId: curUnit.unitId,
                    intCargoType: unitToPack
                })
                    .catch((err) => {
                        console.log("erroring line57: ", err);
                    });
                await ddcsControllers.sendMesgToGroup(
                    curPlayer,
                    curUnit.groupId,
                    "G:" + unitToPack.type + "has been successfully packed onto your vehicle.",
                    5
                );
                let currentMass = 0;
                if (curUnit.intCargoType) {
                    currentMass = 1000 ;
                }
                await setInternalCargoMass(curUnit.name, currentMass + 1000);
            }
        }
    } else {
        console.log(curUnit.name, "was dead before it could finish loading");
    }
}

export async function unloadPackedUnit(curUnit: any, curPlayer: any) {
    const units = await ddcsControllers.unitActionRead({playername: curPlayer.name, dead: false});

    if (units[0].inAir || units[0].speed > 1 || units[0].dead) {
        await ddcsControllers.sendMesgToGroup(
            curPlayer,
            curUnit.groupId,
            "G: Troops were unable to embark/disembark because you were moving",
            5
        );
    } else {
        if (await isCrateOnboard(curUnit, true)) {
            // console.log("Cargo type is a not string");
            const x = 0;
            curUnit.intCargoType.lonLatLoc = ddcsControllers.getLonLatFromDistanceDirection(
            curUnit.lonLatLoc,
            curUnit.hdg + (x * 10),
            0.05
            );
            // await ddcsControllers.unitActionUpdateByUnitId({
            //     unitId: pObj.unitId,
            //     intCargoType: null
            // })
            //     .catch((err) => {
            //         console.log("erroring line73: ", err);
            //     })
            // ;

            const unitTemplate = await ddcsControllers.grndUnitTemplate(curUnit.intCargoType as typing.IGroundUnitTemp);

            const groupTemplate = await ddcsControllers.grndUnitGroup(curUnit.intCargoType);

            const curCMD = await ddcsControllers.spawnGrp(
                _.replace(groupTemplate, "#UNITS", unitTemplate),
                curUnit.intCargoType.country,
                curUnit.intCargoType.unitCategory);
            // console.log("spawnUnitGroup: ", curCMD);
            const sendClient = {actionObj: {action: "CMD", cmd: [curCMD], reqID: 0}};
            await ddcsControllers.sendUDPPacket("frontEnd", sendClient);
            await ddcsControllers.sendMesgToGroup(
                curPlayer,
                curUnit.groupId,
                "G: A " + curUnit.intCargoType.type + " has successfully been unpacked",
                5
            );
            let currentMass = 500;
            if (curUnit.troopType) {
                currentMass = 1000 ;
            }
            await setInternalCargoMass(curUnit.name, currentMass - 1000);
        } else {
            await ddcsControllers.sendMesgToGroup(
            curPlayer,
            curUnit.groupId,
            "G:There is currently nothing onboard to unpack.",
            5
            );
        }
    }
}
/*export async function spawnStaticObject(){
    let spawnObj = {
        _id: curName,
        name: curName,
        unitLonLatLoc: unit.lonLatLoc,
        shape_name: curShapeName,
        unitCategory: "Cargos",
        type: crateType,
        hdg: unit.hdg,
        heading: unit.hdg,
        canCargo: true,
        mass,
        playerOwnerId: curPlayer.ucid,
        templateName: type,
        special: spc,
        crateAmt: crates,
        isCombo,
        playerCanDrive: mobile || false,
        country: ddcsControllers.defCountrys[unit.coalition],
        side: unit.coalition,
        coalition: unit.coalition,
        lonLatLoc: ddcsControllers.getLonLatFromDistanceDirection(unit.lonLatLoc, unit.hdg, 0.05)
    };

    await ddcsControllers.spawnStaticBaseBuilding(crateObj, false);
}*/
