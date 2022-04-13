/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../";
import * as typings from "../../typings";

let markId: number = 1000;

export function setMarkId(id: number) {
    markId = id;
}

export async function incrementMarkId() {
    const currentCampaign = ddcsControllers.getEngineCache();
    const curCampaign = await ddcsControllers.campaignConfigActionsRead({_id: currentCampaign.config.currentCampaignId});
    if (curCampaign && curCampaign.length > 0) {
        // @ts-ignore
        const curMarkId = curCampaign[0].bubbleMap[_.toNumber(curCampaign[0].currentCampaignBubble)].currentServerMarkerId;
        const nextMarkId = (_.isInteger(curMarkId)) ? curMarkId + 1 : 1000;
        // console.log("CN: ", curMarkId, nextMarkId, _.toNumber(curCampaign[0].currentCampaignBubble));
        setMarkId(nextMarkId);
        await ddcsControllers.campaignConfigActionsUpdate({
            _id: currentCampaign.config.currentCampaignId,
            ["bubbleMap." + _.toNumber(curCampaign[0].currentCampaignBubble) + ".currentServerMarkerId"]: nextMarkId
        });
        return nextMarkId;
    } else {
        console.log("Cannot set increment mark id from campaignConfig server");
        return (markId + 1);
    }
}

export async function addMark(id: number, centerLoc: number[], name: string, coalition?: number) {
    if (coalition) {
        await ddcsControllers.sendUDPPacket("frontEnd", {
            actionObj: {
                action: "CMD",
                cmd: [
                    "trigger.action.markToCoalition(" + id + ", [[" + name + "]], " +
                    "coord.LLtoLO(" + centerLoc[1] + ", " +
                    centerLoc[0] + "), " + " " + coalition + "," +
                    " true)"
                ],
                reqID: 0
            },
            queName: "clientArray"
        });
    } else {
        await ddcsControllers.sendUDPPacket("frontEnd", {
            actionObj: {
                action: "CMD",
                cmd: [
                    "trigger.action.markToAll(" + id + ", [[" + name + "]], " +
                    "coord.LLtoLO(" + centerLoc[1] + ", " + centerLoc[0] + ")" +
                    ", true)"
                ],
                reqID: 0
            }
        });
    }
}

export async function addCircleMark(
    id: number,
    centerLoc: number[],
    radius: number,
    outlineColor: string,
    fillColor: string,
    name: string,
    coalition?: number
) {
    await ddcsControllers.sendUDPPacket("frontEnd", {
        actionObj: {
            action: "CMD",
            cmd: [
                "trigger.action.circleToAll(-1," + id + ", " +
                "coord.LLtoLO(" + centerLoc[1] + ", " +
                centerLoc[0] + "), " + radius + ", " +
                outlineColor + ", " +
                fillColor + ", " +
                "1, " +
                "true" + ")"
            ],
            reqID: 0
        },
        queName: "clientArray"
    });
}

export async function addRectangleMark(
    id: number,
    point1: number[],
    point2: number[],
    outlineColor: string,
    fillColor: string,
    name: string,
    coalition?: number
) {
    let curCoalition = -1;
    if (coalition) {
        curCoalition = coalition;
    }
    await ddcsControllers.sendUDPPacket("frontEnd", {
        actionObj: {
            action: "CMD",
            cmd: [
                "trigger.action.rectToAll(" + curCoalition + ", " + id + ", " +
                "coord.LLtoLO(" + point1[1] + ", " + point1[0] + "), " +
                "coord.LLtoLO(" + point2[1] + ", " + point2[0] + "), " +
                outlineColor + ", " +
                fillColor + ", " +
                "1, " +
                "true" + ")"
            ],
            reqID: 0
        },
        queName: "clientArray"
    });
}

export async function removeMark(id: number) {
    await ddcsControllers.sendUDPPacket("frontEnd", {
        actionObj: {
            action: "CMD",
            cmd: ["trigger.action.removeMark(" + id + ")"],
            reqID: 0
        }
    });
}

export async function setFarpMarks() {
    const bases = await ddcsControllers.campaignAirfieldActionRead({enabled: true, $and: [{_id: {$not: /#/}}, {_id: {$not: /^~/}}]});
    for (const base of bases) {
        if (base.baseMarkId) {
            await removeMark(base.baseMarkId);
        }
        const getNewId = await incrementMarkId();
        await addMark(getNewId, base.centerLoc, base._id);
        await ddcsControllers.campaignAirfieldActionUpdate({_id: base._id, baseMarkId: getNewId})
            .catch((err) => {
                console.log("82", err);
            });
    }
}

export async function setUnitMark(unit: any) {
    // console.log("Map Mark unit:", unit);
    if (!_.includes(ddcsControllers.crateTypes, unit.type)) {
        const cUnit = await ddcsControllers.unitActionRead({_id: unit.name});
        const curUnit = cUnit[0];
        if (curUnit.markId) {
            await removeMark(curUnit.markId);
        }
        const getNewId = await incrementMarkId();
        await addMark(getNewId, curUnit.lonLatLoc, curUnit.name);
        await ddcsControllers.unitActionUpdate({_id: curUnit._id, markId: getNewId})
            .catch((err) => {
                console.log("82", err);
            });
    }
}

export async function setCircleMark(unit: any) {
    if (!_.includes(ddcsControllers.crateTypes, unit.type)) {
        const cUnit = await ddcsControllers.unitActionRead({_id: unit.name});
        const curUnit = cUnit[0];
        const baseInfo = await ddcsControllers.campaignAirfieldActionRead({_id : curUnit.name.replace(" Shelter", "")});
        if (curUnit.markId) {
            await removeMark(curUnit.markId);
        }
        const getNewId = await incrementMarkId();
        const circleRadius = 2000;
        let circleOutlineColour = "{128,128,128,0.8}";
        let circleShadeColour = "{128,128,128,0.5}";
        if (curUnit.coalition === 1) {
            circleOutlineColour = "{255,0,0,5}";
            circleShadeColour = "{255,0,0,0.2}";
        }   else if (curUnit.coalition === 2) {
            circleOutlineColour = "{0,0,180,0.5}";
            circleShadeColour = "{0,0,120,0.2}";
        }
        await addCircleMark(getNewId, baseInfo[0].centerLoc, circleRadius, circleOutlineColour, circleShadeColour, curUnit.name);

        await ddcsControllers.unitActionUpdate({_id: curUnit._id, markId: getNewId})
            .catch((err) => {
                console.log("82", err);
            });
    }
}

export async function setNeutralCircleMark(unit: any) {
    if (!_.includes(ddcsControllers.crateTypes, unit.type)) {
        const cUnit = await ddcsControllers.unitActionRead({_id: unit.name});
        const curUnit = cUnit[0];
        const baseInfo = await ddcsControllers.campaignAirfieldActionRead({_id : curUnit.name.replace(" Shelter", "")});
        if (baseInfo[0].baseType === "FOB") {
            if (curUnit.markId) {
                await removeMark(curUnit.markId);
            }

            const getNewId = await incrementMarkId();
            const circleRadius = 2000;
            const circleOutlineColour = "{128,128,128,0.8}";
            const circleShadeColour = "{128,128,128,0.5}";

            await addCircleMark(getNewId, baseInfo[0].centerLoc, circleRadius, circleOutlineColour, circleShadeColour, curUnit.name);

            await ddcsControllers.unitActionUpdate({_id: curUnit._id, markId: getNewId})
                .catch((err) => {
                    console.log("82", err);
                })
                ;
        }
    }
}

export async function setShelterCircleMarkers() {
    const shelters = await ddcsControllers.unitActionRead({type: "Shelter"});
    for (const shelter of shelters) {
        if (!_.includes(ddcsControllers.crateTypes, shelter.type)) {
            const cUnit = await ddcsControllers.unitActionRead({_id: shelter.name});
            const curUnit = cUnit[0];
            if (curUnit.markId) {
                await removeMark(curUnit.markId);
            }

            const circleRadius = 2000;
            let circleOutlineColour = "{128,128,128,0.8}";
            let circleShadeColour = "{128,128,128,0.5}";

            const baseInfo = await ddcsControllers.campaignAirfieldActionRead(
                {_id : curUnit.name.replace(" Shelter", "")});
            if ((curUnit.coalition === 1 && !curUnit.dead) || (curUnit.coalition === 1 && baseInfo[0].baseType === "MOB")) {
                circleOutlineColour = "{255,0,0,5}";
                circleShadeColour = "{255,0,0,0.2}";
            }
            if ((curUnit.coalition === 2 && !curUnit.dead) || (curUnit.coalition === 2 && baseInfo[0].baseType === "MOB")) {
                circleOutlineColour = "{0,0,180,0.5}";
                circleShadeColour = "{0,0,120,0.2}";
            }

            const getNewId = await incrementMarkId();
            await addCircleMark(getNewId, baseInfo[0].centerLoc, circleRadius, circleOutlineColour, circleShadeColour, curUnit.name);

            await ddcsControllers.unitActionUpdate({_id: curUnit._id, markId: getNewId})
                .catch((err) => {
                    console.log("82", err);
                });
        }
    }
}

export async function setBaseCircleMark(baseName: any, baseSide: any) {
    const cUnit = await ddcsControllers.unitActionRead({_id: baseName + " Shelter"});
    if (cUnit.length > 0) {
        const curUnit = cUnit[0];
        const baseInfo = await ddcsControllers.campaignAirfieldActionRead({_id : curUnit.name.replace(" Shelter", "")});
        if (curUnit.markId) {
            await removeMark(curUnit.markId);
        }

        const circleRadius = 2000;
        let circleOutlineColour = "{128,128,128,0.8}";
        let circleShadeColour = "{128,128,128,0.5}";
        if (baseSide === 1) {
            circleOutlineColour = "{255,0,0,5}";
            circleShadeColour = "{255,0,0,0.2}";
        }   else if (baseSide === 2) {
            circleOutlineColour = "{0,0,180,0.5}";
            circleShadeColour = "{0,0,120,0.2}";
        }

        const getNewId = await incrementMarkId();
        await addCircleMark(getNewId, baseInfo[0].centerLoc, circleRadius, circleOutlineColour, circleShadeColour, curUnit.name);

        await ddcsControllers.unitActionUpdate({_id: curUnit._id, markId: getNewId})
            .catch((err) => {
                console.log("82", err);
            });
    } else {
        console.log("Cannot find baseName: " + baseName +  " Shelter");
    }
}

export async function setStrategicPointPolyOwnership(curStrategicPoint?: typings.IStrategicPoint) {
    let searchObj: {};
    if (curStrategicPoint) {
        searchObj = {
            _id: curStrategicPoint._id,
            enabled: true
        };
    } else {
        searchObj = {enabled: true};
    }
    const strategicPoints = await ddcsControllers.strategicPointRead(searchObj);
    for (const strategicPoint of strategicPoints) {
        const markIdArray: number[] = [];
        if (strategicPoint.markId.length > 0) {
            for (const mark of strategicPoint.markId) {
                await removeMark(mark);
            }
        }

        const strategicUnits = await ddcsControllers.unitActionRead({_id: new RegExp(strategicPoint._id + "_MAIN"), dead: false});
        // console.log("GETSTRATEGICUNITS: ", strategicPoint._id + "_MAIN");

        // console.log("length: ", strategicPoint.polygonPoints.length);
        for (const [index, value] of strategicPoint.polygonPoints.entries()) {
            let getNewId = await incrementMarkId();
            markIdArray.push(getNewId);
            let centerOfPoly: number[];
            // if 1 poly = circle
            if (value.length === 1) {
                // console.log("Circle: ", value);
                centerOfPoly = value[0];
            } else {
                // onsole.log("free: ", value);
                centerOfPoly = ddcsControllers.getCenterOfPoly(value);
            }
            if (strategicUnits.length > 0) {
                // console.log("GETSTRATEGICUNITS: ", strategicPoint._id + "_MAIN");
                let circleOutlineColour: string = "{128,128,128,0.8}";
                let circleShadeColour: string = "{128,128,128,0.5}";
                if (strategicUnits[0].coalition === 1) {
                    circleOutlineColour = "{255,0,0,5}";
                    circleShadeColour = "{255,0,0,0.2}";
                } else if (strategicUnits[0].coalition === 2) {
                    circleOutlineColour = "{0,0,180,0.5}";
                    circleShadeColour = "{0,0,120,0.2}";
                }
                const point1 = ddcsControllers.getLonLatFromDistanceDirection(centerOfPoly, 315, 0.5);
                const point2 = ddcsControllers.getLonLatFromDistanceDirection(centerOfPoly, 135, 0.5);
                // console.log("4: ", getNewId, point1, point2);
                await addRectangleMark(
                    getNewId,
                    point1,
                    point2,
                    circleOutlineColour,
                    circleShadeColour,
                    "|" + strategicPoint._id + "|" + index + "|"
                );
            }
            getNewId = await incrementMarkId();
            await addMark(getNewId, centerOfPoly, strategicPoint._id);
        }
        if (markIdArray.length > 0) {
            await ddcsControllers.strategicPointUpdate({_id: strategicPoint._id, markId: markIdArray});
        }
    }
}

export async function removeAllMarkersOnEngineRestart() {
    console.log("clearing all markers to redraw, new startup");
    const unitsWithMarkId = await ddcsControllers.unitActionRead({markId: {$ne: null}});
    for (const unit of unitsWithMarkId) {
        await removeMark(unit.markId);
    }

    const strategicPointsWithMarkId = await ddcsControllers.strategicPointRead({markId: {$ne: null}});
    for (const strategicPoint of strategicPointsWithMarkId) {
        for (const curPoint of strategicPoint.markId) {
            await removeMark(curPoint);
        }
    }

    const basesWithMarkId = await ddcsControllers.campaignAirfieldActionRead({baseMarkId: {$ne: null}});
    for (const baseWithMarkId of basesWithMarkId) {
        await removeMark(baseWithMarkId.baseMarkId);
    }
}
