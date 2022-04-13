/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as typings from "../../typings";
import * as ddcsControllers from "..";
import {I18nResolver} from "i18n-ts";

// Modified to getWeaponCost updated to return the warbondCost of a weapon ~ 16-12-2021
export function getWeaponCost(typeName: string, count: number): number {
    const engineCache = ddcsControllers.getEngineCache();
    /*
    ?????
    let mantraCHK = 0;
    if (typeName === "MATRA") {
        mantraCHK += count;
    }
     */
    let curWeaponLookup = _.find(engineCache.weaponsDictionary, {_id: typeName});
    // console.log("curWeaponLookup = ", "_.find(engineCache.weaponsDictionary, {_id:", typeName, "})");
    if (!curWeaponLookup) {
        curWeaponLookup = _.find(engineCache.weaponsDictionary, {_id: "_" + typeName});
        if (curWeaponLookup) {
            if (curWeaponLookup.alias) {
                // console.log("found _ weapon:", curWeaponLookup._id, " alias:" + curWeaponLookup.alias);
                if (curWeaponLookup.alias) {
                    const curAlias = _.find(engineCache.weaponsDictionary, {_id: curWeaponLookup.alias});
                    if (!curAlias) {
                        curWeaponLookup = curAlias;
                    } else {
                        // console.log("alias: " + curWeaponLookup.alias);
                    }
                }
            }
        } else {
            console.log("curWeapon Not Found: ", "_" + typeName);
        }
    }
    if (curWeaponLookup) {
        // console.log(typeName, " Costs:", curWeaponLookup.warbondCost);
        return curWeaponLookup.warbondCost * count;
    } else {
        const lastPartOfName = typeName.split(".")[2];
        console.log("Not Found", typeName, "Last Search:", lastPartOfName);
        curWeaponLookup = _.find(engineCache.weaponsDictionary, {
            _id: lastPartOfName
        });
    }
    if (curWeaponLookup) {
            // console.log(typeName, " cost:", curWeaponLookup.warbondCost);
            return curWeaponLookup.warbondCost * count;
        } else {
            console.log("cant find weapon:", typeName);
            return 0;
    }
}

// Added to getWeaponName updated to return the weapon display name if available ~ 16-12-2021
export function getWeaponName(typeName: string): typings.IWeaponDictionary {
    const engineCache = ddcsControllers.getEngineCache();
    let curWeaponLookup = _.find(engineCache.weaponsDictionary, {_id: typeName});
    if (!curWeaponLookup) {
        curWeaponLookup = _.find(engineCache.weaponsDictionary, {_id: "_" + typeName});
        if (curWeaponLookup) {
            if (curWeaponLookup.alias) {
                const curAlias = _.find(engineCache.weaponsDictionary, {_id: curWeaponLookup.alias});
                if (!curAlias) {
                    curWeaponLookup = curAlias;
                } else {
                    console.log("Current Alias: " + curWeaponLookup.alias +
                        " wildcard:", typeName.split(".")[2]);

                }
            }
        } else {
            console.log("cant find weapon: _" + typeName);
        }
    }
    if (!curWeaponLookup) {
        console.log("Couldn't find weapon _id:", typeName);
        const lastPartOfName = typeName.split(".")[2];
        console.log("Last Search", lastPartOfName);
        curWeaponLookup = _.find(engineCache.weaponsDictionary, {
            _id: lastPartOfName
        });
        if (curWeaponLookup) {
            console.log("Found weapon", typeName,
                " instead ", lastPartOfName);
        }
    }
    return curWeaponLookup;
}

export async function getPlayerBalance(): Promise<any> {
    const serverAlloc: any = {};
    const latestSession = await ddcsControllers.sessionsActionsReadLatest();
    const engineCache = ddcsControllers.getEngineCache();
    let curModifier: number;
    // console.log("sessions: ", latestSession);
    if (latestSession._id) {
        const playerArray = await ddcsControllers.srvPlayerActionsRead({sessionName: latestSession._id});
        // console.log("playerArray: ", playerArray);
        for (const ePlayer of playerArray) {
            if ((new Date(ePlayer.updatedAt).getTime() + ddcsControllers.time.oneMin > new Date().getTime()) && ePlayer.slot !== "") {
                serverAlloc[ePlayer.side] = serverAlloc[ePlayer.side] || [];
                serverAlloc[ePlayer.side].push(ePlayer);
            }
        }
        const redAll = _.size(_.get(serverAlloc, 1));
        const blueAll = _.size(_.get(serverAlloc, 2));
        // console.log("GGG1: ", redAll + " > " + blueAll + " &&  " + redAll + " !== 0 ", " REAL:" + (redAll > blueAll && redAll !== 0));
        // console.log("GGG2: ", redAll + " < " + blueAll + " &&  " + blueAll + " !== 0 ", " REAL:" + (redAll > blueAll && redAll !== 0));
        if (redAll > blueAll && redAll !== 0) {
            curModifier = isFinite((2 / (blueAll / redAll))) ?  (2 / (blueAll / redAll)) : 1;
            const redObj = {
                playerCount: {
                    red: redAll,
                    blue: blueAll
                },
                side: 1,
                modifier: curModifier,
                players: playerArray,
                baseWarbondIncome: engineCache.campaign.baseWarbondIncome
            };
            // console.log("ROUT: ", redObj);
            return redObj;
        } else if (redAll < blueAll && blueAll !== 0) {
            curModifier = isFinite((2 / (redAll / blueAll))) ?  (2 / (redAll / blueAll)) : 1;
            const blueObj = {
                playerCount: {
                    red: redAll,
                    blue: blueAll
                },
                side: 2,
                modifier: curModifier,
                players: playerArray,
                baseWarbondIncome: engineCache.campaign.baseWarbondIncome
            };
            // console.log("BOUT: ", blueObj);
            return blueObj;
        } else {
            const cOut = {
                playerCount: {
                    red: redAll,
                    blue: blueAll
                },
                side: 0,
                modifier: 1,
                players: playerArray,
                baseWarbondIncome: engineCache.campaign.baseWarbondIncome
            };
            // console.log("cOut: ", cOut);
            return cOut;
        }
    } else {
        console.log("missing session name");
    }
}

export async function updateServerLifePoints(): Promise<void> {
    let addGeneralPoints: number = 0;
    let addStrategicPoints: number = 0;
    let curUnit = null;
    const playerBalance = await getPlayerBalance();

    console.log("Periodic Warbond Update:", "\nPlayers: " +
        ((playerBalance.players && playerBalance.players.length) ? playerBalance.players.length : 0),
        "\nModifier: " + playerBalance.modifier, "\nWarbond Income: " + playerBalance.baseWarbondIncome,
        "\nUnderdog:" + playerBalance.side);
    if (playerBalance.players && playerBalance.players.length > 0) {
        // get total strategic income
        const strategicIncome = await ddcsControllers.getStrategicIncome();
        if (strategicIncome) {
            for (const cPlayer of playerBalance.players) {
                // console.log("CPLAYER2: ", cPlayer.name);
                if (!_.isEmpty(cPlayer.name)) {
                    const cUnit = await ddcsControllers.unitActionRead({dead: false, playername: cPlayer.name});
                    if (cUnit.length > 0) {
                        curUnit = cUnit[0];

                        if (cPlayer.side === playerBalance.side) {
                            addGeneralPoints = Math.round(playerBalance.baseWarbondIncome);
                            addStrategicPoints = Math.round(strategicIncome[cPlayer.side].income);
                        } else {
                            addGeneralPoints = Math.round(playerBalance.baseWarbondIncome * playerBalance.modifier);
                            addStrategicPoints = Math.round(strategicIncome[cPlayer.side].income * playerBalance.modifier);
                        }
                    } else {
                        curUnit = null;
                    }
                }

                // console.log("+Warbonds: Gen:" + addGeneralPoints + " Strat:" +
                //    addStrategicPoints + " -> " + cPlayer.name, "Side: " + cPlayer.side);
                // if ( !isFinite(addGeneralPoints) || !isFinite(addStrategicPoints)) {
                //     console.log("ERROR-Infinite on addFracPoint - line 122 warbonbadPlayerAircraft.ts");
                //     addGeneralPoints = 50;
                // }
                // console.log("adWarbonds: ", cPlayer, curUnit, addGeneralPoints, strategicIncome);
                await addWarbonds(
                    cPlayer,
                    curUnit,
                    "PeriodicAdd",
                    addGeneralPoints,
                    strategicIncome[cPlayer.side].income
                );
            }
        }
    }
}

export async function lookupLifeResource(playerUcid: string): Promise<void> {
    const srvPlayer = await ddcsControllers.srvPlayerActionsRead({_id: playerUcid});
    const curPlayer = srvPlayer[0];
    if (curPlayer) {
        const engineCache = ddcsControllers.getEngineCache();
        const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;

        if (curPlayer.name) {
            const cUnit = await ddcsControllers.unitActionRead({dead: false, playername: curPlayer.name});
            const curUnit = cUnit[0];
            const message = "G: " + i18n.LIFERESOURCEPOINTS.replace("#1", curPlayer.warbonds);
            await ddcsControllers.sendMesgToGroup(curPlayer, curUnit.groupId, message, 5);
        }
    }
}

// Updated lookupAircraftCosts to work entirely with Warbonds ~ 16-12-2021
export async function lookupAircraftCosts(playerUcid: string): Promise<void> {
    const engineCache = ddcsControllers.getEngineCache();
    const srvPlayer = await ddcsControllers.srvPlayerActionsRead({_id: playerUcid});
    if (srvPlayer.length > 0) {
        const curPlayer = srvPlayer[0];
        if (curPlayer) {
            const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;
            if (curPlayer.name) {
                const cUnit = await ddcsControllers.unitActionRead({dead: false, playername: curPlayer.name});
                if (cUnit.length > 0) {
                    const curUnit = cUnit[0];
                    const curUnitDictionary = _.find(engineCache.unitDictionary, {_id: curUnit.type});
                    if (curUnitDictionary) {
                        let curUnitwarbondCost = (curUnitDictionary) ? curUnitDictionary.warbondCost : 1;
                        let totalTakeoffCosts = 0;
                        let weaponCost = 0;
                        let weaponCostString = "";
                        let thisweaponCost;
                        let weaponDisplayName;
                        for (const value of curUnit.ammo || []) {
                            thisweaponCost = getWeaponCost(value.typeName, value.count);
                            weaponDisplayName = getWeaponName(value.typeName);
                            weaponCost = weaponCost + thisweaponCost;
                            const curWeaponName = (weaponDisplayName) ? weaponDisplayName._id : "";
                            weaponCostString += "\n" + _.toString(value.count) + " x " + curWeaponName + "(" +
                                _.toString(thisweaponCost / value.count) + ")";
                            // console.log("weaponCostString: ", weaponCostString);
                        }
                        // console.log("full string: ", weaponCostString);
                        if (_.includes(engineCache.campaign.bubbleMap[
                            engineCache.campaign.currentCampaignBubble].freeAirframeBases,
                            curUnit.groupName.split(" @")[0])) {
                            curUnitwarbondCost = 0;
                        }
                        totalTakeoffCosts = curUnitwarbondCost + weaponCost;


                        let messages = "G: Your aircraft costs:\n" + curUnit.type + "(" + curUnitwarbondCost + ")";
                        messages += weaponCostString;
                        messages += "\nTotal Warbond Cost:" + _.toString(totalTakeoffCosts);
                        // console.log("message: " + messages);
                        await ddcsControllers.sendMesgToGroup(curPlayer, curUnit.groupId, messages, 15);
                    } else {
                        console.log("cant find unit in dictionary: line 129");
                        console.log("lookup unit: ", curUnit);
                    }
                }
            }
        }
    }
}

// Updated checkAircraftCosts to work entirely with Warbonds ~ 16-12-2021
export async function checkAircraftCosts(): Promise<void> {
    const engineCache = ddcsControllers.getEngineCache();
    const latestSession = await ddcsControllers.sessionsActionsReadLatest();
    let message: string;
    if (latestSession && latestSession._id) {
        const srvPlayers = await ddcsControllers.srvPlayerActionsRead({sessionName: latestSession._id, playername: {$ne: ""}});
        for (const curPlayer of srvPlayers) {
            if (curPlayer.name) {
                const cUnit = await ddcsControllers.unitActionRead({dead: false, playername: curPlayer.name, unitCategory: {$in: [0, 1]}});
                if (cUnit.length > 0) {
                    const curUnit = cUnit[0];
                    if (!curUnit.inAir && !curPlayer.takeOffCostDeducted) {
                        const curUnitDictionary = _.find(engineCache.unitDictionary, {_id: curUnit.type});
                        let curUnitwarbondCost = (curUnitDictionary) ? curUnitDictionary.warbondCost : 1;
                        let totalTakeoffCosts = 0;
                        let weaponCost = 0;
                        let weaponCostString = "";
                        let thisweaponCost;
                        let weaponDisplayName;
                        for (const value of curUnit.ammo || []) {
                            thisweaponCost = getWeaponCost(value.typeName, value.count) || 0;
                            weaponDisplayName = getWeaponName(value.typeName) || "";
                            const weaponId = weaponDisplayName._id || "";
                            weaponCost = weaponCost + thisweaponCost;
                            weaponCostString = "\n" + weaponCostString.concat(",", value.count.toString(), "x", weaponId, "(",
                                (thisweaponCost / value.count).toString(), ")");
                        }
                        if (_.includes(engineCache.campaign.bubbleMap[
                            engineCache.campaign.currentCampaignBubble].freeAirframeBases,
                            curUnit.groupName.split(" @")[0])) {
                            curUnitwarbondCost = 0;
                        }
                        totalTakeoffCosts = curUnitwarbondCost + weaponCost;
                        if ((curPlayer.warbonds || 0) < totalTakeoffCosts) {
                            message = "G:You Do Not Have Enough Warbonds To Takeoff In a " + curUnit.type + " with your current loadout(" +
                                totalTakeoffCosts.toFixed(2) + "/" + curPlayer.warbonds.toFixed(2) + ")"
                                .replace("#2", totalTakeoffCosts.toFixed(2))
                                    .replace("#3", curPlayer.warbonds.toFixed(2));
                            console.log(curPlayer.name + " - " + curUnit.groupId + " " + message);
                            await ddcsControllers.sendMesgToGroup(curPlayer, curUnit.groupId, message, 30);
                        }
                    }
                }
            }
        }
    }
}

export async function addWarbonds(
    curPlayer: typings.ISrvPlayers,
    curUnit: any,
    execAction?: string,
    addCurWarbonds?: number,
    strategicIncome?: number
): Promise<void> {
    await ddcsControllers.srvPlayerActionsAddWarbonds(
        curPlayer,
        curUnit,
        addCurWarbonds,
        execAction,
        strategicIncome
    );
}

export async function removeWarbonds(
    curPlayer: any,
    curUnit: any,
    execAction: string,
    isDirect?: boolean,
    removeCurWarbonds?: number
): Promise<void> {
    const engineCache = ddcsControllers.getEngineCache();
    let curRemoveWarbonds = removeCurWarbonds;
    if (!isDirect) {
        const curUnitDictionary = _.find(engineCache.unitDictionary, {_id: curUnit.type});
        let curUnitWarbondCost = (curUnitDictionary) ? curUnitDictionary.warbondCost : 1;
        let weaponCost = 0;
        let thisWeaponCost = 0;
        for (const value of curUnit.ammo || []) {
            thisWeaponCost = getWeaponCost(value.typeName, value.count);
            weaponCost = weaponCost + thisWeaponCost;
        }
        if (_.includes(engineCache.campaign.bubbleMap[
            engineCache.campaign.currentCampaignBubble].freeAirframeBases, curUnit.groupName.split(" @")[0])) {
            console.log("Free Airframe Bases:", engineCache.campaign.bubbleMap[
                engineCache.campaign.currentCampaignBubble].freeAirframeBases);
            curUnitWarbondCost = 0;
            console.log(curPlayer.name + " got free aircraft from ", curUnit.groupName.split(" @")[0]);
        }
        curRemoveWarbonds = curUnitWarbondCost + weaponCost;
    }
    await ddcsControllers.srvPlayerActionsRemoveWarbonds({
        _id: curPlayer._id,
        groupId: curUnit.groupId,
        removeWarbonds: curRemoveWarbonds || 0,
        execAction,
        storePoints: !isDirect
    });
}
