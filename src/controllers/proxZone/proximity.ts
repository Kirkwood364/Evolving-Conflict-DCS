/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as typing from "../../typings";
import * as ddcsControllers from "../";
import {setResetFullCampaign} from "../";

export async function checkUnitsToBaseForCapture(): Promise<void> {
    // console.log("CHECK BASE CAPTURE");
    let sideArray = {};
    const engineCache = ddcsControllers.getEngineCache();
    const bases = await ddcsControllers.campaignAirfieldActionRead({baseType: "MOB"});
    for (const base of bases) {
        const unitsInRange = await getGroundUnitsInProximity(base.centerLoc, engineCache.campaign.baseCaptureProximity, true);
        sideArray = _.transform(unitsInRange, (result: any[], value) => {
            (result[value.coalition] || (result[value.coalition] = [])).push(value);
        });
        if (base.side === 1 && _.get(sideArray, [2], []).length > 0) {
            // console.log("enemy in range: ", base.name + ": enemy Blue");
            if (_.get(sideArray, [1], []).length === 0) {
                if (!_.includes(base._id, "#")) {
                    console.log("BASE HAS BEEN CAPTURED: ", base._id, " is now ", 2);
                    await ddcsControllers.sendMesgToAll(
                        "HASBEENCAPTUREDBY",
                        [base._id, "#" + 2],
                        60
                    );
                }

                await ddcsControllers.spawnSupportBaseGrp(base._id, 2, false);
                await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: 2});
                // await ddcsControllers.setbaseSides();
                const aliveLogistics = await ddcsControllers.unitActionRead({_id: base._id + " Shelter", dead: false});
                if (aliveLogistics.length > 0) {
                    await ddcsControllers.spawnStaticBaseBuilding({} as typing.IStaticSpawnMin, true, base, 2, "Shelter", true);
                }
                const aliveComms = await ddcsControllers.unitActionRead({_id: base._id + " Comms tower M", dead: false});
                if (aliveComms.length > 0) {
                    await ddcsControllers.spawnStaticBaseBuilding({} as typing.IStaticSpawnMin, true, base, 2, "Comms tower M", true);
                }
                await ddcsControllers.setBaseCircleMark(base._id, 2);
            }
        }
        if (base.side === 2 && _.get(sideArray, [1], []).length > 0) {
            // console.log("enemy in range: ", base.name + ": enemy Red");
            if (_.get(sideArray, [2], []).length === 0) {
                if (!_.includes(base._id, "#")) {
                    console.log("BASE HAS BEEN CAPTURED: ", base._id, " is now ", 1);
                    await ddcsControllers.sendMesgToAll(
                        "HASBEENCAPTUREDBY",
                        [base._id, "#" + 1],
                        60
                    );
                }

                await ddcsControllers.spawnSupportBaseGrp(base._id, 1, false);
                await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: 1});
                // await ddcsControllers.setbaseSides();
                const aliveLogistics = await ddcsControllers.unitActionRead({_id: base._id + " Shelter", dead: false});
                if (aliveLogistics.length > 0) {
                    await ddcsControllers.spawnStaticBaseBuilding({} as typing.IStaticSpawnMin, true, base, 1, "Shelter", true);
                }
                const aliveComms = await ddcsControllers.unitActionRead({_id: base._id + " Comms tower M", dead: false});
                if (aliveComms.length > 0) {
                    await ddcsControllers.spawnStaticBaseBuilding({} as typing.IStaticSpawnMin, true, base, 1, "Comms tower M", true );
                }
                await ddcsControllers.setBaseCircleMark(base._id, 1);
            }
        }
        if (base.side === 0 && (_.get(sideArray, [1], []).length > 0 || _.get(sideArray, [2], []).length > 0)) {
            let unitSide = 0;
            if (_.get(sideArray, [1], []).length > 0) {
                unitSide = 1;
            }
            if (_.get(sideArray, [2], []).length > 0) {
                unitSide = 2;
            }
            if (_.get(sideArray, [1], []).length > 0 && _.get(sideArray, [2], []).length > 0) {
                unitSide = 0;
            }
            if (unitSide !== 0) {
                if (!_.includes(base._id, "#")) {
                    console.log("BASE HAS BEEN CAPTURED: ", base._id, " is now ", unitSide);
                    await ddcsControllers.sendMesgToAll(
                        "HASBEENCAPTUREDBY",
                        [base._id],
                        60
                    );
                }

                // console.log('Spawning Support Units', base, unitSide);
                await ddcsControllers.spawnSupportBaseGrp(base._id, unitSide, false);
                await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: unitSide});
                // await ddcsControllers.setbaseSides();
                const aliveLogistics = await ddcsControllers.unitActionRead({_id: base._id + " Shelter", dead: false});
                if (aliveLogistics.length > 0) {
                    await ddcsControllers.spawnStaticBaseBuilding(
                        {} as typing.IStaticSpawnMin,
                        true,
                        base,
                        unitSide,
                        "Shelter",
                        true
                    );
                }
                const aliveComms = await ddcsControllers.unitActionRead({_id: base._id + " Comms tower M", dead: false});
                if (aliveComms.length > 0) {
                    await ddcsControllers.spawnStaticBaseBuilding(
                        {} as typing.IStaticSpawnMin,
                        true,
                        base,
                        unitSide,
                        "Comms tower M",
                        true
                    );
                }
            }
        }
    }

    const baseWinCondition = engineCache.campaign.bubbleMap[engineCache.campaign.currentCampaignBubble].mainCampaignBases;
    const warWon = await ddcsControllers.campaignAirfieldActionRead({_id: {$in: baseWinCondition}});

    if (!_.isEmpty(warWon)) {
        const campaignStateGroup = _.groupBy(warWon, "side");

        if (campaignStateGroup[1] || campaignStateGroup[2]) {
            if (campaignStateGroup[1] && campaignStateGroup[1].length < 2) {
                console.log("WarWonCheck red bases left: ", campaignStateGroup[1].length);
            }
            if (campaignStateGroup[2] && campaignStateGroup[2].length < 2) {
                console.log("WarWonCheck blue bases left: ", campaignStateGroup[2].length);
            }
        }

        if (!campaignStateGroup[1]) {
            ddcsControllers.setMissionState("HOLD-BLUECAMPAIGNWONSERVERRESTART");
            console.log("BLUE WON BLUE WON BLUE WON BLUE WON BLUE WON BLUE WON BLUE WON BLUE WON ");
            if (ddcsControllers.getTimeToRestart() === 0) {
                console.log("Setting TTR");
                await ddcsControllers.setTimeToRestart(ddcsControllers.getCurSeconds() + ddcsControllers.time.tenMinutes);
                await ddcsControllers.loadNextBubbleOrNextCampaign("blue");
            }
        }

        if (!campaignStateGroup[2]) {
            ddcsControllers.setMissionState("HOLD-REDCAMPAIGNWONSERVERRESTART");
            console.log("RED WON RED WON RED WON RED WON RED WON RED WON RED WON RED WON RED WON ");
            if (ddcsControllers.getTimeToRestart() === 0) {
                console.log("Setting TTR");
                await ddcsControllers.setTimeToRestart(ddcsControllers.getCurSeconds() + ddcsControllers.time.tenMinutes);
                await ddcsControllers.loadNextBubbleOrNextCampaign("red");
            }
        }
    }
}

export function rotateArray(origArray: any) {
    const temp = origArray.shift();
    origArray.push(temp);
    return origArray;
}

export async function loadNextBubbleOrNextCampaign(winningSide: string) {
    const engCache = ddcsControllers.getEngineCache();
    const currentCampaignBubble = _.toNumber(engCache.campaign.currentCampaignBubble);
    if (winningSide === "blue") {
        if (engCache.campaign.bubbleMap[_.toString(currentCampaignBubble - 1)] &&
            engCache.campaign.bubbleMap[_.toString(currentCampaignBubble - 1)].bubbleName) {
            // next bubble exists, load map
            await ddcsControllers.setNewMissionFile(engCache.config.currentCampaignId, currentCampaignBubble - 1);
            await ddcsControllers.sendMesgToAll(
                "Campaign Bubble " + engCache.campaign.currentCampaignBubble + " Has been won by " + winningSide +
                ", Server Will Restart In Next Bubble " + (currentCampaignBubble - 1) + " in 10 Minutes.",
                [],
                30
            );
        } else {
            // campaign has been won by blue, load next campaign
            await ddcsControllers.loadNewCampaign();
            await ddcsControllers.sendMesgToAll(
                "Campaign Has Been WON by " + winningSide + ". Next Campaign " + engCache.config.campaignRotation[0] +
                ", Will Start In 10 Minutes",
                [],
                30
            );
        }
    }
    if (winningSide === "red") {
        if (engCache.campaign.bubbleMap[_.toString(currentCampaignBubble + 1)] &&
            engCache.campaign.bubbleMap[_.toString(currentCampaignBubble + 1)].bubbleName) {
            // next bubble exists, load map
            await ddcsControllers.setNewMissionFile(engCache.config.currentCampaignId, currentCampaignBubble + 1);
            await ddcsControllers.sendMesgToAll(
                "Campaign Bubble " + engCache.campaign.currentCampaignBubble + " Has been won by " + winningSide +
                ", Server Will Restart In Next Bubble " + (currentCampaignBubble + 1) + " in 10 Minutes.",
                [],
                30
            );
        } else {
            // campaign has been won by red, load next campaign
            await ddcsControllers.loadNewCampaign();
            await ddcsControllers.sendMesgToAll(
                "Campaign Has Been WON by " + winningSide + ". Next Campaign " + engCache.config.campaignRotation[0] +
                ", Will Start In 10 Minutes",
                [],
                30
            );
        }
    }
}

export async function loadNewCampaign() {
    const engCache = ddcsControllers.getEngineCache();
    if (engCache.config.campaignRotation && engCache.config.campaignRotation.length > 1) {
        const newCampaignArray = rotateArray(engCache.config.campaignRotation);
        await ddcsControllers.serverActionsUpdate({_id: engCache.config._id, campaignRotation: newCampaignArray});
        await ddcsControllers.setNewMissionFile(newCampaignArray[0], 0);
    } else {
        await ddcsControllers.setNewMissionFile(engCache.config.currentCampaignId, 0);
    }
    await setResetFullCampaign(true);
}

export async function getGroundKillInProximity(
    lonLat: number[],
    kmDistance: number,
    side: number
): Promise<typing.IUnit[]> {
    return await ddcsControllers.unitActionRead({
        dead: false,
        lonLatLoc: {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: lonLat
                },
                $maxDistance: kmDistance * 1000
            }
        },
        unitCategory: {
            $in: [
                ddcsControllers.UNIT_CATEGORY.indexOf("HELICOPTER"),
                ddcsControllers.UNIT_CATEGORY.indexOf("GROUND_UNIT")
            ]
        },
        coalition: side
    });
}

export async function getCoalitionGroundUnitsInProximity(
    lonLat: number[],
    kmDistance: number,
    side: number
): Promise<typing.IUnit[]> {
    const catNum = ddcsControllers.UNIT_CATEGORY.indexOf("GROUND_UNIT");
    return await ddcsControllers.unitActionRead({
            dead: false,
            lonLatLoc: {
                $geoWithin: {
                    $centerSphere: [
                        lonLat,
                        kmDistance / 6378.1
                    ]
                }
            },
            unitCategory: catNum,
            coalition: side
        });
}

export async function getMOBsInProximity(lonLat: number[], kmDistance: number, side: number): Promise<typing.ICampaignAirfield[]> {
    return await ddcsControllers.campaignAirfieldActionRead({
            centerLoc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: lonLat
                    },
                    $maxDistance: kmDistance * 1000
                }
            },
            side,
            enabled: true,
            baseType: "MOB"
        });
}

export async function getBasesInProximity(lonLat: number[], kmDistance: number, side: number): Promise<typing.ICampaignAirfield[]> {
    return await ddcsControllers.campaignAirfieldActionRead({
            centerLoc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: lonLat
                    },
                    $maxDistance: kmDistance * 1000
                }
            },
            side,
            enabled: true
        });
}

export async function getAnyBasesInProximity(lonLat: number[], kmDistance: number): Promise<typing.ICampaignAirfield[]> {
    return await ddcsControllers.campaignAirfieldActionRead({
        centerLoc: {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: lonLat
                },
                $maxDistance: kmDistance * 1000
            }
        },
        enabled: true
    });
}

export async function getGroundUnitsInProximity(lonLat: number[], kmDistance: number, isTroop: boolean): Promise<typing.IUnit[]> {
    const catNum = ddcsControllers.UNIT_CATEGORY.indexOf("GROUND_UNIT");
    return await ddcsControllers.unitActionReadStd({
        dead: false,
        isActive: true,
        lonLatLoc: {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: (lonLat) ? lonLat : [0, 0]
                },
                $maxDistance: kmDistance * 1000
            }
        },
        unitCategory: catNum,
        isCrate: false
    });
}

export async function getLogiTowersProximity(lonLat: number[], kmDistance: number, coalition: number): Promise<typing.IUnit[]> {
    return await ddcsControllers.unitActionRead({
            dead: false,
            lonLatLoc: {
                $geoWithin: {
                    $centerSphere: [
                        lonLat,
                        kmDistance / 6378.1
                    ]
                }
            },
            _id: /Shelter/,
            coalition
        });
}

export async function getPlayersInProximity(
    lonLat: number[],
    kmDistance: number,
    inAir: boolean,
    coalition: number
): Promise<typing.IUnit[]> {
    return await ddcsControllers.unitActionRead({
            dead: false,
            lonLatLoc: {
                $geoWithin: {
                    $centerSphere: [
                        lonLat,
                        kmDistance / 6378.1
                    ]
                }
            },
            playername: {
                $ne: ""
            },
            unitCategory: {
                $in: ["AIRPLANE", "HELICOPTER"]
            },
            inAir,
            coalition
        });
}

export async function getStaticCratesInProximity(
    lonLat: number[],
    kmDistance: number,
    coalition: number
) {
    return await ddcsControllers.unitActionReadStd({
            lonLatLoc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: lonLat
                    },
                    $maxDistance: kmDistance * 1000
                }
            },
            objectCategory: 6,
            dead: false,
            coalition
        });
}

export async function getFirst5CoalitionJTACInProximity(
    lonLat: number[],
    kmDistance: number,
    side: number
): Promise<typing.IUnit[]> {
    return await ddcsControllers.unitActionReadFirst5({
        dead: false,
        lonLatLoc: {
            $geoWithin: {
                $centerSphere: [
                    lonLat,
                    kmDistance / 6378.1
                ]
            }
        },
        proxChkGrp: "jtac",
        coalition: side,
        jtacEnemyLocation: {$ne: null}
    });
}

export async function getTroopsInProximity(lonLat: number[], kmDistance: number, coalition: number): Promise<typing.IUnit[]> {
    return await ddcsControllers.unitActionReadStd({
            dead: false,
            lonLatLoc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: lonLat
                    },
                    $maxDistance: kmDistance * 1000
                }
            },
            playername: {
                $eq: ""
            },
            type: {
                $in: [
                    "Soldier M249",
                    "Infantry AK",
                    "Stinger manpad",
                    "Soldier M4",
                    "Paratrooper RPG-16",
                    "2B11 mortar",
                    "SA-18 Igla manpad"
                ]
            },
            coalition
        });
}

export async function getVirtualCratesInProximity(
    lonLat: number[],
    kmDistance: number,
    coalition: number
): Promise<typing.IUnit[]> {
    return await ddcsControllers.unitActionReadStd({
            dead: false,
            lonLatLoc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: lonLat
                    },
                    $maxDistance: kmDistance * 1000
                }
            },
            name : {
                $regex: /CU\|/
            },
            inAir: false,
            coalition
        });
}

export async function isPlayerInProximity(lonLat: number[], kmDistance: number, playerName: string): Promise<boolean> {
    // console.log(lonLat, " ", kmDistance, " ", playerName);
    const chkPlayers = await ddcsControllers.unitActionRead({
        dead: false,
        lonLatLoc: {
            $geoWithin: {
                $centerSphere: [
                    lonLat,
                    kmDistance / 6378.1
                ]
            }
        },
        playername: playerName
    });
    return chkPlayers.length > 0;
}

export async function getPackableUnitsInProximity(lonLat: number[], kmDistance: number, coalition: number): Promise<typing.IUnit[]> {
    const engineCache = ddcsControllers.getEngineCache();
    const packableUnitsDicts = _.filter(engineCache.unitDictionary, {packable: true});
    const packableTypes: any[] = [];
    for (const unit of packableUnitsDicts) {
        packableTypes.push(unit.type);
    }
    // console.log("packableTypes:", packableTypes);
    return await ddcsControllers.unitActionReadStd({
            dead: false,
            lonLatLoc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: lonLat
                    },
                    $maxDistance: kmDistance * 1000
                }
            },
            playername: {
                $eq: ""
            },
            type: {
                $in: packableTypes
            },
            coalition
        });
}
