/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../../";
import {removeWarbonds, simpleStatEventActionsReadLastShotEvent} from "../../";

function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export async function processEventKill(eventObj: any): Promise<void> {
    const engineCache = ddcsControllers.getEngineCache();
    const nowTime = new Date().getTime();
    const playerArray = await ddcsControllers.srvPlayerActionsRead({sessionName: ddcsControllers.getSessionName()});
    let curInitiator: any = {};
    let curTarget: any = {};
    let weaponMesg: string = "";
    let initSideStr = "";
    let targetSideStr = "";

    if (eventObj && eventObj.data) {
        // console.log("eventObj:", eventObj);
        if (!eventObj.data.initiator || !eventObj.data.target) {
            // console.log("Missing Initiator or target: ", eventObj);
        }
        let initSide: number = -1; // hack to make default never match
        let targetSide: number = -2; // hack to make default never match
        let reward: number = 1;
        let teamKill: boolean = false;
        let tempStr: string = "Temp";
        let modifier: number = 0.1;
        if (eventObj.data.initiator) {
            initSide = eventObj.data.initiator.side;
            initSideStr = ddcsControllers.side[initSide];
        }

        if (eventObj.data.target) {
            targetSide = eventObj.data.target.side;
            targetSideStr = ddcsControllers.side[targetSide];
        }

        if (eventObj.data.initiator && eventObj.data.initiator.unitId) {
            const iUnitId = eventObj.data.initiator.unitId;
            const iUnit = await ddcsControllers.unitActionRead({unitId: iUnitId});
            if (iUnit.length > 0) {
                curInitiator = {
                    unit: iUnit[0],
                    player: (!!iUnit[0].playername) ? _.find(playerArray, {name: iUnit[0].playername}) : undefined,
                    playerOwner: (!!iUnit[0].playerOwnerId) ? _.find(playerArray, {_id: iUnit[0].playerOwnerId}) : undefined,
                    isGroundTarget: (ddcsControllers.UNIT_CATEGORY[iUnit[0].unitCategory] === "GROUND_UNIT")
                };
                if (ddcsControllers.UNIT_CATEGORY[iUnit[0].unitCategory] === "GROUND_UNIT") {
                    await ddcsControllers.baseUnitUnderAttack(iUnit[0]);
                }

                const killedUnitDict = _.find(engineCache.unitDictionary, {type : eventObj.data.target.type});
                if (killedUnitDict) {
                    if (targetSide === 0) {
                        reward = 0;
                    } else if (initSide === targetSide) {
                        reward = -Math.abs(reward);
                        teamKill = true;
                        tempStr = "";
                    } else {
                        reward = killedUnitDict.warbondCost;
                    }
                } else {
                    console.log("No Killed Unit: ", eventObj);
                }

                let killingWeaponDict: any = null;
                // check for real weapon object
                if (eventObj.data.weapon && eventObj.data.weapon.typeName) {
                    killingWeaponDict = _.find(engineCache.weaponsDictionary, {_id : eventObj.data.weapon.typeName});
                }

                if (!killingWeaponDict && eventObj.data.weapon_name) {
                    // console.log("killWeaponDict1: ", eventObj, killingWeaponDict);
                    // check for fake weapon object that is based off weapon_name, records start with _
                    killingWeaponDict = _.find(engineCache.weaponsDictionary, {_id : "_" + eventObj.data.weapon_name});
                    if (killingWeaponDict) {
                        if (killingWeaponDict.alias) {
                            const curAlias = _.find(engineCache.weaponsDictionary, {_id: killingWeaponDict.alias});
                            if (!curAlias) {
                                killingWeaponDict = curAlias;
                            } else {
                                // console.log("Alias: " + killingWeaponDict.alias);
                            }
                        }
                    }
                }

                if (!killingWeaponDict) {
                    // console.log("Cant Find Weapon From Event: ", eventObj, killingWeaponDict);
                    // try to get last shot event from same unit, grab weapon from shot event
                    if (iUnitId) {
                        // get last shot record thats no older than 5 minutes
                        const latestShotByUnitId = await simpleStatEventActionsReadLastShotEvent({
                            "initiator.unitId": iUnitId,
                            "updatedAt": {$gte: new Date(new Date().getTime() - ddcsControllers.time.fiveMins)}
                        });
                        // console.log("Find Old Event: ", latestShotByUnitId, iUnitId,
                        //    new Date(new Date().getTime() - ddcsControllers.time.fiveMins));
                        // console.log("maybe found shot record: ", latestShotByUnitId);
                        if (latestShotByUnitId.length > 0) {
                            // console.log("Last Shot Found UnitId:", iUnitId, " Weapon:", latestShotByUnitId[0].weapon);
                            if (latestShotByUnitId[0] && latestShotByUnitId[0].weapon && latestShotByUnitId[0].weapon.typeName) {
                                killingWeaponDict = _.find(engineCache.weaponsDictionary, {_id : latestShotByUnitId[0].weapon.typeName});
                            }

                            if (!killingWeaponDict) {
                                if (latestShotByUnitId[0] && latestShotByUnitId[0].weapon && latestShotByUnitId[0].weapon.weapon_name) {
                                    killingWeaponDict = _.find(
                                        engineCache.weaponsDictionary,
                                        {_id : "_" + latestShotByUnitId[0].weapon.weapon_name}
                                    );
                                    if (killingWeaponDict) {
                                        if (killingWeaponDict.alias) {
                                            const curAlias = _.find(engineCache.weaponsDictionary, {_id: killingWeaponDict.alias});
                                            if (!curAlias) {
                                                killingWeaponDict = curAlias;
                                            } else {
                                                // console.log("Current alias records lookup for " + killingWeaponDict.alias + " is null");
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // console.log("no shot event was ever found for unitId: " + iUnitId );
                        }
                    } else {
                        // console.log("This kill event has no initiator: ", eventObj);
                    }
                }

                if (killedUnitDict && killingWeaponDict) {
                    reward = Math.round(killedUnitDict.warbondCost * killingWeaponDict.warbondKillMultiplier);
                    modifier = killingWeaponDict.warbondKillMultiplier;
                    weaponMesg = killingWeaponDict._id;
                } else {
                    // console.log("KILL: weapon not found: ", eventObj.data);
                    weaponMesg = (eventObj.data.weapon && eventObj.data.weapon.typeName) ?
                        eventObj.data.weapon.typeName : "_" + eventObj.data.weapon_name;
                    await ddcsControllers.weaponScoreActionsCheck({
                        _id: (eventObj.data.weapon && eventObj.data.weapon.typeName) ?
                            eventObj.data.weapon.typeName : "_" + eventObj.data.weapon_name,
                        name: (eventObj.data.weapon && eventObj.data.weapon.typeName) ?
                            eventObj.data.weapon.typeName : "_" + eventObj.data.weapon_name,
                        displayName: (eventObj.data.weapon) ? eventObj.data.weapon.displayName : null,
                        weapon_name: (eventObj.data.weapon) ? eventObj.data.weapon.weapon_name : eventObj.data.weapon_name,
                        unitType: (eventObj.data.initiator) ? eventObj.data.initiator.type : null,
                        category: (eventObj.data.weapon) ? eventObj.data.weapon.category : null
                    });
                    reward = Math.round(killedUnitDict.warbondCost * 0.1);
                }



                if (!!curInitiator.playerOwner && !!curInitiator.unit.playerOwnerId) {
                    const playerOwnerUnit = await ddcsControllers.unitActionRead({playername: curInitiator.playerOwner.name});
                    if (playerOwnerUnit.length > 0) {
                        if (curInitiator.player && teamKill) {
                            tempStr = "";
                            await ddcsControllers.srvPlayerActionsRemoveWarbonds({
                                _id: curInitiator.player._id,
                                groupId: curInitiator.unit.groupId,
                                removeWarbonds: Math.abs(reward),
                                execAction: "Friendly Fire"
                            });
                        } else {
                            tempStr = "";
                            await ddcsControllers.srvPlayerActionsUnitAddToWarbonds({
                                _id: curInitiator.unit.playerOwnerId,
                                score: reward,
                                groupId: (playerOwnerUnit[0].groupId) ? playerOwnerUnit[0].groupId : undefined,
                                unitType: iUnit[0].type,
                                unitCoalition: iUnit[0].coalition
                            });
                        }
                    }
                }

                if (!!curInitiator.player && !!curInitiator.player._id) {
                    if (teamKill) {
                        await ddcsControllers.srvPlayerActionsRemoveWarbonds({
                            _id: curInitiator.player._id,
                            groupId: curInitiator.unit.groupId,
                            removeWarbonds: Math.abs(reward),
                            execAction: "Friendly Fire"
                        });
                    } else {
                        if (curInitiator.unit.unitCategory === 2) {
                            if (curInitiator.unit.playerOwnerId !== curInitiator.player._id) {
                                await ddcsControllers.srvPlayerActionsAddWarbonds(
                                    curInitiator.player,
                                    curInitiator.unit,
                                    reward
                                );
                            }
                        } else {
                            await ddcsControllers.srvPlayerActionsAddTempWarbonds({
                                _id: curInitiator.player._id,
                                groupId: curInitiator.unit.groupId,
                                score: reward
                            });
                        }
                    }
                }
            }
        }

        if (eventObj.data.target && !!eventObj.data.target.unitId) {
            const tUnitId = eventObj.data.target.unitId;
            const tUnit = await ddcsControllers.unitActionRead({unitId: tUnitId});
            if (tUnit.length > 0) {
                curTarget = {
                    unit: tUnit[0],
                    player: (!!tUnit[0].playername) ? _.find(playerArray, {name: tUnit[0].playername}) : undefined,
                    playerOwner: (!!tUnit[0].playerOwnerId) ? _.find(playerArray, {_id: tUnit[0].playerOwnerId}) : undefined,
                    isGroundTarget: (ddcsControllers.UNIT_CATEGORY[tUnit[0].unitCategory] === "GROUND_UNIT")
                };
            }
        }

        let initMesg: string = "";
        let killer: string = "";
        let killerType: string = "";
        let killerControlledBy: string = "Unknown";
        if (!!curInitiator.unit) {
            if (curInitiator.playerOwner && !curInitiator.player) {
                initMesg += eventObj.data.initiator.type + "(" + curInitiator.playerOwner.name + ")";
                killer = curInitiator.playerOwner.name;
                killerType = eventObj.data.initiator.type;
                killerControlledBy = "AI";
            } else if (curInitiator.player) {
                initMesg += eventObj.data.initiator.type + "(" + curInitiator.player.name + ")";
                killer = curInitiator.player.name;
                killerType = eventObj.data.initiator.type;
                killerControlledBy = curInitiator.player.name;
            } else {
                initMesg += eventObj.data.initiator.type;
                killer = "Unknown";
                killerType = eventObj.data.initiator.type;
                killerControlledBy = "AI";
            }
        } else {
            initMesg += "Something";
        }

        let targetMesg: string = "";
        let victim: string = "";
        let victimType: string = "";
        let victimControlledBy: string = "Unknown";
        if (curTarget.unit) {
            if (curTarget.playerOwner && !curTarget.player) {
                targetMesg += eventObj.data.target.type + "(" + curTarget.playerOwner.name + ")";
                victim = curTarget.playerOwner.name;
                victimType = eventObj.data.target.type;
                victimControlledBy = "AI";
            } else if (curTarget.player) {
                targetMesg += eventObj.data.target.type + "(" + curTarget.player.name + ")";
                victim = curTarget.player.name;
                victimType = eventObj.data.target.type;
                victimControlledBy = curTarget.player.name;
            } else {
                targetMesg += eventObj.data.target.type;
                victim = "Unknown";
                victimType = eventObj.data.target.type;
                victimControlledBy = "AI";
            }
        } else {
            targetMesg += "Something";
        }

        await ddcsControllers.sendMessageToAll(
            initSideStr + " " + initMesg + " has killed " + targetSideStr + " " + targetMesg + " with " + weaponMesg +
            "[μ" + modifier + "]" + "(" + reward + " " + tempStr + "Warbonds)\n",
            10,
            nowTime + ddcsControllers.time.oneMin
        );
        /*
        console.log("writing Kill Event to Stat Event Table:",
        "\ninitiator:", eventObj.data.initiator,
        "\ntarget:", eventObj.data.target,
        "\nweapon:", (eventObj.data.weapon) ? eventObj.data.weapon : {weapon_name: eventObj.data.weapon_name},
        "\nkiller:", killer,
        "\nkillerType:", killerType,
        "\nkillerControlledBy:", killerControlledBy,
        "\nvictim:", victim,
        "\nvictimType:", victimType,
        "\nvictimControlledBy:", victimControlledBy
        );
         */
        await ddcsControllers.simpleStatEventActionsSave({
            _id: ddcsControllers.getSessionName() + "_" + new Date().getTime() + "_" + _.random(1000000, 9999999),
            sessionName: ddcsControllers.getSessionName(),
            eventCode: "KILL",
            initiator: eventObj.data.initiator,
            target: eventObj.data.target,
            weapon: (eventObj.data.weapon) ? eventObj.data.weapon : {weapon_name: eventObj.data.weapon_name},
            killer,
            killerType,
            killerControlledBy,
            victim,
            victimType,
            victimControlledBy,
            score: reward,
            weapon_name: weaponMesg
        });
    }
}

/*
    INC2:  { action: 'S_EVENT_KILL',
  data:
   { id: 28,
     initiator:
      { category: 1,
        groupId: 4700,
        side: 1,
        type: 'Su-25T',
        unitId: 10022 },
     initiatorId: 10022,
     name: 'S_EVENT_KILL',
     target: { category: 3, side: 2, type: 'Shelter', unitId: 1000092 },
     targetId: 1000092,
     time: 47686.898,
     weapon: { category: 'SHELL', displayName: 'su-25T', typeName: 'Su-25T' },
     weapon_name: 'Su-25T' },
  type: 'event' }

    Event Kill:  { action: 'S_EVENT_KILL',
  data:
   { id: 28,
     initiator:
      { category: 1,
        groupId: 6564,
        side: 1,
        type: 'Ka-50',
        unitId: 11886 },
     initiatorId: 11886,
     name: 'S_EVENT_KILL',
     target:
      { category: 1,
        groupId: 1001052,
        side: 2,
        type: 'Hawk ln',
        unitId: 1001060 },
     targetId: 1001060,
     time: 52935.23,
     weapon_name: 'Vikhr_M' },
  type: 'event' }

  Event Kill:  { action: 'S_EVENT_KILL',
  data:
   { id: 28,
     name: 'S_EVENT_KILL',
     target:
      { category: 1,
        groupId: 4704,
        side: 1,
        type: 'Su-25T',
        unitId: 10026 },
     targetId: 10026,
     time: 46565.944,
     weapon_name: '' },
  type: 'event' }
     */
