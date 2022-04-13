/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../";
import * as typings from "../../typings";

const requestJobObj: any = {};

let serverState = "STARTUP";
let missionStartupReSync = false;
let isServerSynced = false;
let isInitSyncMode = false; // Init Sync Units To Server Mode
let nextUniqueId = 1;
let resetFullCampaign = false;
const fiveMins = 5 * 60 * 1000;

export function getMissionState(): string {
    return serverState;
}

export function setMissionState(value: string): void {
    serverState = value;
}

export function getResetFullCampaign(): boolean {
    return resetFullCampaign;
}

export async function setResetFullCampaign(value: boolean): Promise<void> {
    await ddcsControllers.serverActionsUpdate({_id: process.env.SERVER_NAME, resetFullCampaign: value});
    resetFullCampaign = value;
}

export function getMissionStartupReSync(): boolean {
    return missionStartupReSync;
}

export function setMissionStartupReSync(value: boolean): void {
    missionStartupReSync = value;
}

export function getRequestJobSize(): any {
    return Object.keys(requestJobObj).length;
}

export function getRequestJob(reqId: number): any {
    return requestJobObj["REQ" + reqId];
}

export function setRequestJobArray(requestObj: any, reqId: number): any {
    requestObj.createTime = new Date().getTime();
    requestJobObj["REQ" + reqId] = requestObj;
}

export function cleanRequestJobArray(reqId: number): any {
    delete requestJobObj["REQ" + reqId];
}

export function jobArrayCleanup(): any {
    for (const property in requestJobObj) {
        if ( new Date().getTime() > requestJobObj[property].createTime + fiveMins ) {
            delete requestJobObj[property];
        }
    }
}

export function getNextUniqueId(): number {
    const curUniqueId = nextUniqueId;
    nextUniqueId += 1;
    return curUniqueId;
}

export function getServerSynced(): boolean {
    return isServerSynced;
}

export function setServerSynced(value: boolean): void {
    isServerSynced = value;
}

export function setSyncLockdownMode(flag: boolean): void {
    isInitSyncMode = flag;
}

export async function reSyncAllUnitsFromDbToServer( syncEmptyUnitIds: boolean, missingIds?: any[]): Promise<void> {
    // console.log("Respawn Current Units From Db ", missionStartupReSync);
    // sync up all units on server from database
    let unitObjs: typings.IUnit[] = [];
    const curCache = ddcsControllers.getEngineCache();
    if (missingIds && missingIds.length > 0) {
        const groupNames: string[] = [];
        const missingIdObjs = await ddcsControllers.unitActionReadStd({unitId: {$in: missingIds}});
        for (const missingObj of missingIdObjs) {
            if (missingObj.groupName === null) {
                unitObjs.push(missingObj);
            } else {
                groupNames.push(missingObj.groupName);
            }
        }
        const uniqGroupNames: string[] = _.uniq(groupNames);
        // respawn full groups
        for (const uniqGroupName of uniqGroupNames) {
            const curUniqGroups  = await ddcsControllers.unitActionReadStd({groupName: uniqGroupName});
            if (curUniqGroups.length > 0) {
                for (const curUniqGroup of curUniqGroups) {
                    unitObjs.push(curUniqGroup);
                }
            }
        }
    } else {
        if (syncEmptyUnitIds) {
            unitObjs = await ddcsControllers.unitActionReadStd({
                dead: false,
                _id: {$not: /^~/},
                unitId: null,
                $or: [
                    {bubbleMapParents: _.toString(curCache.campaign.currentCampaignBubble)},
                    {unitCategory: 0},
                    {unitCategory: 1},
                    {unitCategory: 3}
                ]
            });

        } else {
            unitObjs = await ddcsControllers.unitActionReadStd({
                dead: false,
                _id: {$not: /^~/},
                $or: [
                    {bubbleMapParents: _.toString(curCache.campaign.currentCampaignBubble)},
                    {unitCategory: 0},
                    {unitCategory: 1},
                    {unitCategory: 3}
                ]
            });
        }
    }
    // console.log("syncObjsLeft: ", unitObjs[0]);
    if (unitObjs.length > 0) {
        const remappedObjs: any = {};
        for (const unitObj of unitObjs) {
            if (ddcsControllers.UNIT_CATEGORY[unitObj.unitCategory] === "GROUND_UNIT") {
                // console.log("GROUNMD UNIT");
                unitObj.lateActivation = true;
                const curGroupName = unitObj.groupName;
                remappedObjs[curGroupName] = remappedObjs[curGroupName] || [];
                remappedObjs[curGroupName].push(unitObj);
            } else if (ddcsControllers.OBJECT_CATEGORY[unitObj.objectCategory] === "STATIC" && !unitObj.isTroop) {
                // switched from structure unit only to static, meaning boats and buildings
                // console.log("STATIC UNIT");
                await ddcsControllers.spawnStaticBaseBuilding(unitObj, false);
            } else {
                // console.log("marking dead");
                await ddcsControllers.unitActionUpdate({
                    _id: unitObj._id,
                    dead: true
                });
                // console.log("ResyncDb:" + dbCount + " toServer:" + serverCount);
                // await ddcsControllers.correctPlayerAircraftDuplicates();
                // await reSyncServerObjs(serverCount, dbCount);
            }
        }

        for (const [key, value] of Object.entries(remappedObjs)) {
            await ddcsControllers.spawnUnitGroup(value as any[], false);
        }
    }
}

export async function syncById(incomingObj: any, curReqJobIndex: number): Promise<void> {
    const curReqJob = requestJobObj["REQ" + curReqJobIndex];
    console.log("syncById server: ", curReqJob.reqArgs.serverCount, "db: ", curReqJob.reqArgs.dbCount);
    await ddcsControllers.updateUnitCampaignParents();
    const curCache = ddcsControllers.getEngineCache();
    const aliveObj =
        await ddcsControllers.actionAliveIds({
            dead: false,
            $or: [
                {bubbleMapParents: _.toString(curCache.campaign.currentCampaignBubble)},
                {unitCategory: 0},
                {unitCategory: 1},
                {unitCategory: 3}
            ]
        });
    const aliveIdArray = aliveObj.map((u: any) => u.unitId);

    if (curReqJob.reqArgs.serverCount > curReqJob.reqArgs.dbCount) {
        const missingIds = _.difference(incomingObj.returnObj, aliveIdArray);
        console.log("Db is missing " + missingIds.length + " unit(s)", missingIds);
        if (missingIds.length > 0) {
            // delete units that are out of bounds in bubble
            const curEngCache = ddcsControllers.getEngineCache();
            // update campaign parents first
            const getMissionIdRecords = await ddcsControllers.unitActionRead({
                unitId: {$in: missingIds},
                bubbleMapParents: {$ne: _.toString(curEngCache.campaign.currentCampaignBubble)},
                unitCategory: 2,
                isBubbleMapCategorized: true,
                _id: {$regex: /^(?!.*~PERM).*/}
            });
            for (const unitObj of getMissionIdRecords) {
                console.log(unitObj._id + " is out of polyBubble bounds, Current Poly Bubble: ",
                    curEngCache.campaign.currentCampaignBubble, " Units Poly Bubbles: ", unitObj.bubbleMapParents);
                console.log("Destroying Unit For Being Out Of Bounds: ", unitObj._id);
                await ddcsControllers.destroyUnit(unitObj._id, "unit");
            }

            await ddcsControllers.sendUDPPacket("frontEnd", {
                actionObj: {
                    action: "reSyncInfo",
                    objType: (ddcsControllers.UNIT_CATEGORY[incomingObj.unitCategory] === "STRUCTURE") ? "static" : "unit",
                    missingIds,
                    reqID: 0, // dont run anything with return data
                    time: new Date()
                }
            });
        }
    }

    // mark DB units dead, if dont exist on server or if preliminary sync, spawn units
    if (curReqJob.reqArgs.serverCount < curReqJob.reqArgs.dbCount) {
        console.log("server: ", curReqJob.reqArgs.serverCount, "db: ",
            curReqJob.reqArgs.dbCount, "startupSync: ", curReqJob.reqArgs.isStartupSync);
        const missingIds = _.difference(aliveIdArray, incomingObj.returnObj);
        console.log("Server is missing " + missingIds.length + " unit(s)", missingIds);
        if (missingIds.length > 0) {
            if (curReqJob.reqArgs.isStartupSync) {
                // set all ^~ as dead, these are baked in units, should not be resynced
                /*
                const unitObjs = await ddcsControllers.unitActionReadStd({unitId: {$in: missingIds}});
                const cleanUnitIds = [];
                for (const unitObj of unitObjs) {
                    if (/^~/.test(unitObj._id)) {
                        await ddcsControllers.unitActionUpdateByUnitId({unitId: unitObj.unitId, dead: true});
                    } else {
                        if (unitObj.unitId) {
                            cleanUnitIds.push(unitObj.unitId);
                        } else {
                            console.log("UnitId is null: ", unitObj);
                        }
                    }
                }
                 */
                // spawn db to server during sync
                await reSyncAllUnitsFromDbToServer(false, missingIds);
            } else {
                // mark db as dead, server is master
                if (missingIds.length > 100) {
                    console.log("Db has more than 100 more records, server is not a fresh SYNC," +
                        "haulting sync to protect DB from setting too many records to dead");
                } else {
                    for (const missingId of missingIds) {
                        await ddcsControllers.unitActionUpdateByUnitId({unitId: missingId, dead: true});
                    }
                }
            }
        }
    }
    cleanRequestJobArray(curReqJobIndex);
}

export async function reSyncServerObjs(serverCount: number, dbCount: number, isStartupSync: boolean) {
    const curNextUniqueId = ddcsControllers.getNextUniqueId();
    setRequestJobArray({
        reqId: curNextUniqueId,
        callBack: "syncById",
        reqArgs: {
            serverCount,
            dbCount,
            isStartupSync
        }
    }, curNextUniqueId);
    await ddcsControllers.sendUDPPacket("frontEnd", {
        actionObj: {
            action: "getIds",
            reqID: curNextUniqueId,
            time: new Date()
        }
    });
}

export async function activateInactiveSpawn() {
    await ddcsControllers.unitActionChkResyncActive();
    // loop through and activate all non ^~
    const unitObjs = await ddcsControllers.unitActionReadStd({
        dead: false,
        isActive: false,
        _id: {$not: /^~/},
        isResync: false,
        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
    });
    if (unitObjs.length > 0) {
        console.log("inactive units: ", unitObjs.length);
        await ddcsControllers.sendMesgChatWindow("[5/6]STARTUP-ACTIVATEALLUNITS - inactiveUnits: " + unitObjs.length);
    }

    const unitGroups = _.groupBy(unitObjs, (u) => u.groupName);
    if (Object.keys(unitGroups).length > 0) {
        // console.log("Start Activating all units");
        for (const unitKeys of Object.keys(unitGroups)) {
            if (unitKeys !== "undefined") {
                if (_.includes(unitKeys, "DU")) {
                    // console.log("activate: ", unitKeys);
                }
                await ddcsControllers.sendUDPPacket("frontEnd", {
                    actionObj: {
                        action: "CMD",
                        cmd: ["Group.getByName(\"" + unitKeys + "\"):activate()"],
                        reqID: 0,
                        time: new Date()
                    }
                });
            }
        }
    }
}

export async function updateUnitCampaignParents() {
    // update unit db campaigns every second
    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
    const curCampaignConfig: typings.ICampaignConfig = ddcsControllers.getEngineCache().campaign;
    const curAliveUnits = await ddcsControllers.unitActionRead({dead: false});
    for (const curAliveUnit of curAliveUnits) {
        const unitParents = [];
        let isInsidePolygonLonLat: boolean = false;
        for (const [bubbleMapKey, bubbleMapObj] of Object.entries(curCampaignConfig.bubbleMap)) {
            // add all AI and player controlled aircraft and helicopters
            if (
                /^AI/.test(curAliveUnit._id) || /^~/.test(curAliveUnit._id) ||
                (curAliveUnit.playername !== "" && curAliveUnit.playername !== null && curAliveUnit.playername !== undefined)
            ) {
                // console.log("unitAutoPOP: ", curAliveUnit._id, /^AI/.test(curAliveUnit._id), curAliveUnit.playername);
                isInsidePolygonLonLat = true;
            } else {
                // console.log("polygonParentLookup: ", curAliveUnit._id, curAliveUnit.lonLatLoc, curCampaignConfig._id);
                isInsidePolygonLonLat = ddcsControllers.isUnitInsidePolygonLonLat(
                    curAliveUnit,
                    bubbleMapObj.bubbleInformation.bubbleMapLonlat
                );
            }

            if (isInsidePolygonLonLat) {
                unitParents.push(bubbleMapKey);
            }
        }
        if (unitParents.length === 0 && false) {
            console.log(
                "empty UNITPARENTS: ",
                curAliveUnit._id,
                unitParents,
                isInsidePolygonLonLat
            );
        }
        await ddcsControllers.unitActionUpdate({_id: curAliveUnit._id, isBubbleMapCategorized: true, bubbleMapParents: unitParents});
    }
}

export async function syncCheck(serverCount: number): Promise<void> {
    const curMissionState = getMissionState();
    if (curMissionState !== "RUN-NORMAL") {
        console.log("STATE: ", curMissionState);
    }

    let dbCount: number;
    let recordsLeft: any[];
    let knownFlags: typings.IFlags[];
    let inactiveUnitObjs: typings.IUnit[];
    if (ddcsControllers.getSessionName()) {
        const servers = await ddcsControllers.serverActionsRead({_id: process.env.SERVER_NAME});
        if (servers && servers[0]) {
            // is missing empty, pull all units that are active and dont have ^~ in unit/static name
            const preBakedNames = await ddcsControllers.actionAliveIds({
                dead: false,
                _id: /^~/
            });

            switch (curMissionState) {
                case "STARTUP":
                    console.log("ARGUMENTS: " + process.argv);
                    setServerSynced(false);
                    break;
                case "[2/9]STARTUP-BUILDFULLSERVERCLEANUP":
                    setServerSynced(false);
                    setMissionStartupReSync(true);
                    await ddcsControllers.serverActionsUpdate({_id: process.env.SERVER_NAME, currentServerMarkerId: 1000});
                    await ddcsControllers.sendMessageToDiscord("@everyone Campaign has been Won and has been Reset");
                    await ddcsControllers.sendMessageToDiscord("Campaign playtime has been reset");
                    await ddcsControllers.unitActionRemoveall(); // clear unit table
                    await ddcsControllers.replaceCampaignAirfields(); // build fresh campaignAirfields from campaignConfig
                    await ddcsControllers.replaceStrategicPoints(); // build fresh strategicPoints from CampaignConfig
                    await ddcsControllers.srvPlayerActionsUnsetCampaign(); // reset all campaign locks
                    setMissionState("[3/9]STARTUP-BUILDFULLSERVERSTATICS");
                    break;
                case "[3/9]STARTUP-BUILDFULLSERVERSTATICS":
                    setServerSynced(false);
                    await ddcsControllers.spawnNewMapObjs(true);
                    setMissionState("[5/9]STARTUP-BUILDFULLSERVERUNITS");
                    break;
                case "[5/9]STARTUP-BUILDFULLSERVERUNITS":
                    setServerSynced(false);
                    await ddcsControllers.spawnNewMapObjs(false);
                    setMissionState("[6/9]STARTUP-SYNCFULLSERVERUNITS");
                    break;
                    /*
                case "[4/9]STARTUP-SYNCFULLSERVERSTATICS":
                    setServerSynced(false);
                    recordsLeft = await ddcsControllers.unitActionReadStd({
                        dead: false,
                        _id: {$not: /^~/},
                        unitId: null
                    });
                    dbCount = await ddcsControllers.actionCount({
                        dead: false
                    });
                    await reSyncAllUnitsFromDbToServer(true);
                    console.log("STATIC SYNC: Server: " + serverCount + " DB: " + dbCount);
                    if (recordsLeft.length === 0) {
                        setMissionState("[5/9]STARTUP-BUILDFULLSERVERUNITS");
                    }
                    break;
                     */
                case "[6/9]STARTUP-SYNCFULLSERVERUNITS":
                    setServerSynced(false);
                    await ddcsControllers.updateUnitCampaignParents();
                    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
                    recordsLeft = await ddcsControllers.unitActionReadStd({
                        dead: false,
                        _id: {$not: /^~/},
                        unitId: null,
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    dbCount = await ddcsControllers.actionCount({
                        dead: false,
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    await reSyncAllUnitsFromDbToServer(true);
                    console.log("UNIT SYNC: Server: " + serverCount + " DB: " + dbCount + " record");
                    if (recordsLeft.length === 0) {
                        setMissionState("[7/9]STARTUP-SYNCFULLSERVERSYNCBACK");
                    }
                    break;
                case "[7/9]STARTUP-SYNCFULLSERVERSYNCBACK":
                    setServerSynced(false);
                    await ddcsControllers.updateUnitCampaignParents();
                    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
                    dbCount = await ddcsControllers.actionCount({
                        dead: false,
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    await reSyncServerObjs(serverCount, dbCount, true);
                    console.log("UNIT SYNCBACK: Server: " + serverCount + " DB: " + dbCount);
                    if (serverCount === dbCount) {
                        setMissionState("[8/9]STARTUP-SYNCFULLSERVERACTIVATEALLUNITS");
                    }
                    break;
                case "[8/9]STARTUP-SYNCFULLSERVERACTIVATEALLUNITS":
                    setServerSynced(false);
                    await ddcsControllers.updateUnitCampaignParents();
                    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
                    inactiveUnitObjs = await ddcsControllers.unitActionReadStd({
                        dead: false,
                        isActive: false,
                        _id: {$not: /^~/},
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    await activateInactiveSpawn();
                    if (inactiveUnitObjs.length === 0) {
                        setMissionState("STARTUP-SYNCFULLSERVERFINISH");
                    }
                    break;
                case "STARTUP-SYNCFULLSERVERFINISH":
                    setServerSynced(true);
                    setMissionStartupReSync(false);
                    await ddcsControllers.updateUnitCampaignParents();
                    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
                    console.log("sync full server finish");
                    await ddcsControllers.sendMesgChatWindow("Sync Finished - You can now slot");
                    await setResetFullCampaign(false);
                    knownFlags = await ddcsControllers.flagsActionRead({});
                    for (const flag of knownFlags) {
                        console.log("Setting Flag ID:", flag._id, "to value:", flag.value);
                        await ddcsControllers.sendUDPPacket("frontEnd", {
                            actionObj: {
                                action: "setFlagValue",
                                flagID: flag._id,
                                flagValue: flag.value,
                                reqID: 0
                            }
                        });
                    }
                    setMissionState("RUN-NORMAL");
                    break;
                case "[2/6]STARTUP-RESYNCDBCLEANUP":
                    setServerSynced(false);
                    setMissionStartupReSync(true);
                    await ddcsControllers.unitSetBakedUnitsDead(); // set all baked in units to dead
                    await ddcsControllers.unitClearAllUnitIds(); // clear all unitIds to resync to DB
                    setMissionState("[3/6]STARTUP-RESYNCTOSERVER");
                    break;
                case "[3/6]STARTUP-RESYNCTOSERVER":
                    setServerSynced(false);
                    await ddcsControllers.updateUnitCampaignParents();
                    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
                    recordsLeft = await ddcsControllers.unitActionReadStd({
                        dead: false,
                        _id: {$not: /^~/},
                        unitId: null,
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    dbCount = await ddcsControllers.actionCount({
                        dead: false,
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    await reSyncAllUnitsFromDbToServer(true);
                    // await ddcsControllers.sendMesgChatWindow(
                    //    "STATE: " + curMissionState + "UNIT SYNC:" + "Server: " + serverCount + " DB: " + dbCount
                    // );
                    console.log("UNIT SYNC: Server: " + serverCount + " DB: " + dbCount);
                    if (recordsLeft.length === 0) {
                        setMissionState("[4/6]STARTUP-RESYNCSERVERBACK");
                    }
                    break;
                case "[4/6]STARTUP-RESYNCSERVERBACK":
                    setServerSynced(false);
                    await ddcsControllers.updateUnitCampaignParents();
                    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
                    dbCount = await ddcsControllers.actionCount({
                        dead: false,
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    console.log("UNIT SYNC: Server: " + serverCount + " DB: " + dbCount);
                    await reSyncServerObjs(serverCount, dbCount, true);
                    if (serverCount === dbCount) {
                        setMissionState("[5/6]STARTUP-ACTIVATEALLUNITS");
                    }
                    break;
                case "[5/6]STARTUP-ACTIVATEALLUNITS":
                    setServerSynced(false);
                    await ddcsControllers.updateUnitCampaignParents();
                    await ddcsControllers.updateCampaign(ddcsControllers.getEngineCache().config.currentCampaignId);
                    inactiveUnitObjs = await ddcsControllers.unitActionReadStd({
                        dead: false,
                        isActive: false,
                        _id: {$not: /^~/},
                        bubbleMapParents: _.toString(ddcsControllers.getEngineCache().campaign.currentCampaignBubble)
                    });
                    await activateInactiveSpawn();
                    if (inactiveUnitObjs.length === 0) {
                        setMissionState("STARTUP-SYNCFULLSERVERFINISH");
                    }
                    break;
                case "RUN-SYNCDB":
                    setServerSynced(false);
                    const engineCache = ddcsControllers.getEngineCache();
                    dbCount = await ddcsControllers.actionCount({
                        dead: false,
                        $or: [
                            {bubbleMapParents: _.toString(engineCache.campaign.currentCampaignBubble)},
                            {unitCategory: 0},
                            {unitCategory: 1},
                            {unitCategory: 3}
                        ]
                    });
                    await reSyncServerObjs(serverCount, dbCount, false);
                    // console.log("UNIT SYNC: Server: " + serverCount + " DB: " + dbCount);
                    if (serverCount === dbCount) {
                        setMissionState("RUN-FINISHSYNC");
                    }
                    break;
                case "RUN-FINISHSYNC":
                    setServerSynced(true);
                    knownFlags = await ddcsControllers.flagsActionRead({});
                    for (const flag of knownFlags) {
                        console.log("Setting Flag:", flag._id, " -> ", flag.value);
                        await ddcsControllers.sendUDPPacket("frontEnd", {
                            actionObj: {
                                action: "setFlagValue",
                                flagID: flag._id,
                                flagValue: flag.value,
                                reqID: 0
                            }
                        });
                    }
                    setMissionState("RUN-NORMAL");
                    break;
                case "RUN-NORMAL":
                    // normal: turn all loops on
                    setServerSynced(true);
                    // console.log("run normal");
                    break;
                case "HOLD-BLUECAMPAIGNWONSERVERRESTART":
                    setServerSynced(true);
                    console.log("hold campaign win");
                    break;
                case "HOLD-REDCAMPAIGNWONSERVERRESTART":
                    setServerSynced(true);
                    console.log("hold campaign win");
                    break;
                default:
                    console.log("No State has been selected");
            }

            const isServerPopulated = serverCount > preBakedNames.length;
            if (curMissionState === "STARTUP") {
                await ddcsControllers.removeAllMarkersOnEngineRestart();

                if (getResetFullCampaign()) {
                    setMissionState("[2/9]STARTUP-BUILDFULLSERVERCLEANUP");
                } else if (!isServerPopulated) {
                    setMissionState("[2/6]STARTUP-RESYNCDBCLEANUP");
                } else {
                    setMissionState("RUN-NORMAL");
                }
            }

            if (curMissionState === "RUN-NORMAL") {
                const curCache = ddcsControllers.getEngineCache();
                dbCount = await ddcsControllers.actionCount({
                    dead: false,
                    $or: [
                        {bubbleMapParents: _.toString(curCache.campaign.currentCampaignBubble)},
                        {unitCategory: 0},
                        {unitCategory: 1},
                        {unitCategory: 3}
                    ]
                });
                if (serverCount < dbCount || serverCount > dbCount) {
                    setMissionState("RUN-SYNCDB");
                } else {
                    setMissionState("RUN-NORMAL");
                }
            }
        }
    }
}
