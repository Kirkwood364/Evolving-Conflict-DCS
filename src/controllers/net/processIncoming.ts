import * as _ from "lodash";
import * as ddcsController from "../";
import {dbModels} from "../db/common";
import * as typings from "../../typings";
import {I18nResolver} from "i18n-ts";
import {updateWeather} from "../";

export async function processingIncomingData(incomingObj: any) {
    switch (incomingObj.action) {
        case "C":
            await ddcsController.processUnitUpdates(incomingObj);
            break;
        case "U":
            await ddcsController.processUnitUpdates(incomingObj);
            break;
        case "D":
            await ddcsController.processUnitUpdates(incomingObj);
            break;
        case "S_EVENT_SHOT":
            await ddcsController.processEventShot(incomingObj);
            break;
        case "S_EVENT_HIT":
            // not using hit anymore for kills
            // await ddcsController.processEventHit(incomingObj);
            break;
        case "S_EVENT_TAKEOFF":
            await ddcsController.processEventTakeoff(incomingObj);
            break;
        case "S_EVENT_LAND":
            await ddcsController.processEventLand(incomingObj);
            break;
        case "S_EVENT_CRASH":
            // await ddcsController.processEventCrash(incomingObj);
            break;
        case "S_EVENT_EJECTION":
            // await ddcsController.processEventEjection(incomingObj);
            break;
        case "S_EVENT_REFUELING":
            // await ddcsController.processEventRefueling(incomingObj);
            break;
        case "S_EVENT_DEAD":
            await ddcsController.processEventDead(incomingObj);
            break;
        case "S_EVENT_PILOT_DEAD":
            await ddcsController.processEventPilotDead(incomingObj);
            break;
        case "S_EVENT_BASE_CAPTURED":
            break;
        case "S_EVENT_MISSION_START":
            break;
        case "S_EVENT_MISSION_END":
            break;
        case "S_EVENT_TOOK_CONTROL":
            break;
        case "S_EVENT_REFUELING_STOP":
            // await ddcsController.processEventRefuelingStop(incomingObj);
            break;
        case "S_EVENT_BIRTH":
            await ddcsController.processEventBirth(incomingObj);
            break;
        case "S_EVENT_HUMAN_FAILURE":
            break;
        case "S_EVENT_DETAILED_FAILURE":
            break;
        case "S_EVENT_ENGINE_STARTUP":
            break;
        case "S_EVENT_ENGINE_SHUTDOWN":
            break;
        case "S_EVENT_PLAYER_ENTER_UNIT":
            // console.log("player enter unit1");
            await ddcsController.processEventPlayerEnterUnit(incomingObj);
            break;
        case "S_EVENT_PLAYER_LEAVE_UNIT":
            // console.log("player EXIT unit1");
            // await ddcsController.processEventPlayerLeaveUnit(incomingObj);
            break;
        case "S_EVENT_PLAYER_COMMENT":
            break;
        case "S_EVENT_SHOOTING_START":
            await ddcsController.processEventShootingStart(incomingObj);
            break;
        case "S_EVENT_SHOOTING_END":
            break;
        case "S_EVENT_MARK_ADDED":
            break;
        case "S_EVENT_MARK_CHANGE":
            break;
        case "S_EVENT_MARK_REMOVED":
            break;
        case "S_EVENT_KILL":
            await ddcsController.processEventKill(incomingObj);
            break;
        case "S_EVENT_SCORE":
            break;
        case "S_EVENT_UNIT_LOST":
            break;
        case "S_EVENT_LANDING_AFTER_EJECTION":
            break;
        case "S_EVENT_PARATROOPER_LENDING":
            break;
        case "S_EVENT_DISCARD_CHAIR_AFTER_EJECTION":
            break;
        case "S_EVENT_WEAPON_ADD":
            break;
        case "S_EVENT_TRIGGER_ZONE":
            break;
        case "S_EVENT_LANDING_QUALITY_MARK":
            break;
        case "S_EVENT_BDA":
            break;
        case "S_EVENT_MAX":
            break;
        case "airbaseC":
            console.log("AIRBASE: ", incomingObj);
            await ddcsController.airfieldDictionaryActionUpdate(incomingObj.data);
            // await ddcsController.processAirbaseUpdates(incomingObj);
            break;
        case "airbaseU":
            // await ddcsController.processAirbaseUpdates(incomingObj);
            break;
        case "strategicPointC":
            // await ddcsController.processStrategicPointUpdates(incomingObj);
            break;
        case "f10Menu":
            await ddcsController.menuCmdProcess(incomingObj);
            break;
        case "unitsAlive":
            await ddcsController.sendMissingUnits(incomingObj.data);
            break;
        case "playerStats":
            await ddcsController.processPlayerEvent(incomingObj);
            break;
        case "friendly_fire":
            await ddcsController.processFriendlyFire(incomingObj);
            break;
        case "self_kill":
            await ddcsController.processSelfKill(incomingObj);
            break;
        case "connect":
            await ddcsController.processConnect(incomingObj);
            console.log("Player Connect:", incomingObj);
            break;
        case "disconnect":
            await ddcsController.processDisconnect(incomingObj);
            console.log("Player Disconnected:", incomingObj);
            break;
        case "change_slot":
            // console.log('CHANGE EVENT SLOT HAPPENED: ', queObj);
            // await ddcsController.processDisconnect(incomingObj);
            break;
        case "processReq":
            const curReqJobObj = ddcsController.getRequestJob(incomingObj.reqId);
            if (curReqJobObj) {
                // @ts-ignore
                await ddcsController[curReqJobObj.callBack](incomingObj, incomingObj.reqId, curReqJobObj.reqArgs);

                // cleanup request job array
                // console.log("req array size before: ", ddcsController.getRequestJobSize());
                ddcsController.cleanRequestJobArray(incomingObj.reqId);
                // console.log("req array size after: ", ddcsController.getRequestJobSize());
            } else {
                console.log("Cant find req Id: ", incomingObj.reqId);
            }
            break;
        case "incomingMessage":
            console.log("MESG: ", incomingObj.message);
            dbModels.srvPlayerModel.find({_id: incomingObj.from}, async (err: any, serverObj: typings.ISrvPlayers[]) => {
                if (err) {
                    console.log("incomingMsgError: ", err);
                }
                const curPly = serverObj[0];
                const engineCache = ddcsController.getEngineCache();
                const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
                switch (incomingObj.message) {
                    case i18n.COMMANDRED:
                        await ddcsController.lockUserToSide(incomingObj, 1);
                        break;
                    case i18n.COMMANDBLUE:
                        await ddcsController.lockUserToSide(incomingObj, 2);
                        break;
                    case "-help":
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "Available Commands:", curPly.playerId);
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "-red to choose the red side for this campaign", curPly.playerId);
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "-blue to choose the red side for this campaign", curPly.playerId);
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "-balance to join the side with the least time played this campaign", curPly.playerId);
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "-swap to join the losing side with less than 10 bases remaining", curPly.playerId);
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "-refreshmenu if the menu in your logistics aircraft doesn't draw correctly", curPly.playerId);
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "-lockcaunits Lock Your Ground Vehicles From Third Party, First Person Control", curPly.playerId);
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "-unlockcaunits Unlock Your Ground Vehicles From Third Party, First Person Control", curPly.playerId);
                        break;
                    case "-lockcaunits":
                        await ddcsController.srvPlayerActionsUpdate({_id: serverObj[0]._id, caLockedToOwner: true});
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "LOCKED: Your CA Units Are Now LOCKED For First Person Control", curPly.playerId);
                        break;
                    case "-unlockcaunits":
                        await ddcsController.srvPlayerActionsUpdate({_id: serverObj[0]._id, caLockedToOwner: false});
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "UNLOCKED: Your CA Units Are Now UNLOCKED For First Person Control", curPly.playerId);
                        break;
                    case "-joinrandom":
                        const randSide = _.random(1, 2);
                        await ddcsController.lockUserToSide(incomingObj, randSide);
                        break;
                    case "-balance":
                        await ddcsController.balanceUserToSide(incomingObj);
                        break;
                    case "-swap":
                        await ddcsController.swapUserToLosingSide(incomingObj);
                        break;
                    case "-redrawf10":
                        await ddcsController.sendMesgToPlayerChatWindow(
                            "This command has been disabled due to abuse causing issues", curPly.playerId);
                        // await ddcsController.setFarpMarks();
                        // await ddcsController.setCircleMarkers();
                        break;
                    case "-refreshmenu":
                        const unit = await ddcsController.unitActionRead({playername: curPly.name, dead: false});
                        if (unit.length > 0) {
                            await ddcsController.initializeMenu(unit[0]);
                            await ddcsController.sendMesgToPlayerChatWindow("Menu has been refreshed", curPly.playerId);
                        } else {
                            await ddcsController.sendMesgToPlayerChatWindow("You are not in a vehicle", curPly.playerId);
                        }
                        break;
                    case "-":
                        const mesg = i18n.COMMANDDEFAULTRESPONSE;
                        await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
                        break;
                }
                if (incomingObj.message.startsWith("-kudos")) {
                    const tgtPlayerName = incomingObj.message.replace("-kudos ", "");
                    await ddcsController.grantKudos(curPly, tgtPlayerName);
                }
                if (incomingObj.message.startsWith("-admin")) {
                    console.log("admin fire");
                    const curPlayerDb = await ddcsController.srvPlayerActionsRead({_id: curPly.ucid});
                    if (curPlayerDb[0].isGameMaster) {
                        await ddcsController.sendMesgToPlayerChatWindow("Admin Command", curPly.playerId);
                        const adminCMDArray = incomingObj.message.split(" ");
                        switch (adminCMDArray[1]) {
                            case "setFlag":
                                console.log("Flag:", adminCMDArray[2], " -> ", adminCMDArray[3]);
                                await ddcsController.sendUDPPacket("frontEnd", {
                                    actionObj: {
                                        action: "setFlagValue",
                                        flagID: adminCMDArray[2],
                                        flagValue: adminCMDArray[3],
                                        reqID: 0
                                    }
                                });
                                await ddcsController.sendMesgToPlayerChatWindow("Setting Flag ID:" + adminCMDArray[2] + "to value:" +
                                    adminCMDArray[3], curPly.playerId);
                                break;
                            case "test":
                                await ddcsController.spawnEscortFighters(adminCMDArray[2]);
                                break;
                            case "yeetCache":
                                await ddcsController.updateUnitDictionary(ddcsController.getEngineCache().campaign.timePeriod);
                                await ddcsController.updateWeaponDictionary();
                                await ddcsController.updateMenuCommands();
                                break;
                            case "order66":
                                const getUnitName = await ddcsController.unitActionRead({unitId: adminCMDArray[2], dead: false});
                                if (getUnitName.length > 0) {
                                    const curCache = ddcsController.getEngineCache();
                                    const playerOwner = await ddcsController.srvPlayerActionsRead({_id: getUnitName[0].playerOwnerId});
                                    if (playerOwner.length > 0) {
                                        const findUnitCost = curCache.unitDictionary.find(
                                            (ud: { type: string; }) => ud.type === getUnitName[0].type);
                                        if (findUnitCost) {
                                            console.log("refund warbonds to " + playerOwner[0].name + " for " +
                                                findUnitCost.warbondCost);
                                            await ddcsController.addWarbonds(
                                                playerOwner[0],
                                                getUnitName[0],
                                                "refundWarbonds",
                                                findUnitCost.warbondCost
                                            );
                                        }
                                    }
                                    await ddcsController.destroyUnit(getUnitName[0]._id, "unit");
                                }
                                break;
                            case "stratPointMarkClear":
                                await ddcsController.checkForNeutralStrategicPoints();
                                break;
                            case "killStatic":
                                const getUnitKillName = await ddcsController.unitActionRead({unitId: adminCMDArray[2], dead: false});
                                if (getUnitKillName.length > 0) {
                                    await ddcsController.destroyUnit(getUnitKillName[0]._id, "static");
                                }
                                break;
                            case "restartin":
                                await ddcsController.restartIn(adminCMDArray[2]);
                                break;
                            case "redrawf10":
                                // clear first
                                await ddcsController.removeAllMarkersOnEngineRestart();
                                // redraw all
                                await ddcsController.setShelterCircleMarkers();
                                await ddcsController.setFarpMarks();
                                await ddcsController.setStrategicPointPolyOwnership();
                                break;
                            case "refundforcrash":
                                // rotate through all players during crash, refund X war bucks, usually 4000, crashes are rough
                                const lastTwoSessions = await ddcsController.sessionsActionsReadLatestTwo();
                                if (lastTwoSessions.length === 2) {
                                    if (lastTwoSessions[1].playersOnlineArray.length > 0) {
                                        const lastTwoSessionPlayers = await ddcsController.srvPlayerActionsRead(
                                            {_id: {$in: lastTwoSessions[1].playersOnlineArray}}
                                        );
                                        if (lastTwoSessionPlayers.length > 0) {
                                            for (const playersObj of lastTwoSessionPlayers) {
                                                const playerUnit = await ddcsController.unitActionRead({
                                                    playername: playersObj.name,
                                                    dead: false
                                                });
                                                await ddcsController.srvPlayerActionsAddWarbonds(
                                                    playersObj,
                                                    playerUnit[0],
                                                    adminCMDArray[2],
                                                    "refundWarbondsFromCrash"
                                                );
                                            }
                                        }
                                    }
                                }
                                break;
                            case "giveplayerwarbonds":
                                // -admin giveplayerwarbonds amount playername
                                const giveWarbondsName = adminCMDArray.slice(3).join(" ");
                                if (giveWarbondsName !== "") {
                                    const playerBondObj = await ddcsController.srvPlayerActionsRead({name: giveWarbondsName});
                                    const curWarbondUnit = await ddcsController.unitActionRead({dead: false, playername: giveWarbondsName});
                                    let curWarUnit: any;
                                    if (curWarbondUnit.length > 0) {
                                        curWarUnit = curWarbondUnit[0];
                                    }
                                    if (playerBondObj.length > 0) {
                                        await ddcsController.srvPlayerActionsAddWarbonds(
                                            playerBondObj[0],
                                            curWarUnit,
                                            adminCMDArray[2],
                                            "refundWarbondsFromCrash"
                                        );
                                    } else {
                                        console.log("Cannot find player: ", adminCMDArray[2]);
                                        await ddcsController.sendMesgToPlayerChatWindow("Cannot find player: " +
                                            adminCMDArray[2], curPly.playerId);
                                    }
                                }
                                break;
                            case "giveallplayerswarbonds":
                                // -admin giveallplayerswarbonds amount
                                const listOfUcids = await ddcsController.sessionsActionsReadLatest();
                                if (listOfUcids.playersOnlineArray.length > 0) {
                                    const curServerPlayers = await ddcsController.srvPlayerActionsRead(
                                        {_id: {$in: listOfUcids.playersOnlineArray}});
                                    for (const curPlayer of curServerPlayers) {
                                        const curPlayerUnit = await ddcsController.unitActionRead({
                                            dead: false,
                                            playername: curPlayer.name
                                        });
                                        let curUnitPlayer;
                                        if (curPlayerUnit.length > 0) {
                                            curUnitPlayer = curPlayerUnit[0];
                                        }
                                        await ddcsController.srvPlayerActionsAddWarbonds(
                                            curPlayer,
                                            curUnitPlayer,
                                            adminCMDArray[2],
                                            "refundWarbondsFromCrash"
                                        );
                                    }
                                }

                                const playerObj = await ddcsController.srvPlayerActionsRead({playername: adminCMDArray[2]});
                                const curIUnit = await ddcsController.unitActionRead({dead: false, playername: adminCMDArray[2]});
                                let curUnit;
                                if (curIUnit.length > 0) {
                                    curUnit = curIUnit[0];
                                }
                                if (playerObj.length > 0) {
                                    await ddcsController.srvPlayerActionsAddWarbonds(
                                        playerObj[0],
                                        curUnit,
                                        adminCMDArray[3],
                                        "refundWarbondsFromCrash"
                                    );
                                } else {
                                    console.log("Cannot find player: ", adminCMDArray[2]);
                                    await ddcsController.sendMesgToPlayerChatWindow("Cannot find player: " +
                                        adminCMDArray[2], curPly.playerId);
                                }
                                break;
                            case "updateAirfields":
                                console.log("Starting Import Mission, clearing airfields and strategicPoints");
                                await ddcsController.sendUDPPacket("frontEnd", {
                                    actionObj: {
                                        action: "updateAirfieldDictionary",
                                        reqID: 0
                                    }
                                });
                                break;
                            case "importlonlat":
                                await ddcsController.updateYxToLonLat();
                                break;
                            case "testPolyLonLatConvert":
                                await ddcsController.sendUDPPacket("frontEnd", {
                                    actionObj: {
                                        action: "convertYXArrayToLonLat",
                                        xyArray: [
                                            {x: -263514.53125, y: 676308.125}
                                        ],
                                        reqID: 0
                                    }
                                });
                                break;
                            case "findType":
                                const unitDict = _.find(engineCache.unitDictionary, {type: adminCMDArray[2]});
                                console.log("unitDict:", unitDict);
                                await ddcsController.sendMesgToPlayerChatWindow(unitDict, curPly.playerId);
                                break;
                            case "kickplayer":
                                // -admin kickplayer "name"
                                const curKickName = adminCMDArray.slice(2).join(" ");
                                if (curKickName !== "") {
                                    const getPlayer = await ddcsController.srvPlayerActionsRead({name: curKickName});
                                    console.log("Admin ", curPlayerDb[0].name, " has kicked player ", getPlayer[0], " from the server");
                                    if (getPlayer.length > 0) {
                                        await ddcsController.kickPlayer(
                                            _.toNumber(getPlayer[0].playerId),
                                            "Admin has kicked you from the server by manual command"
                                        );
                                    } else {
                                        console.log("No player found for name: ", adminCMDArray[2]);
                                    }
                                } else {
                                    console.log(curKickName, " cannot be blank when kicking player");
                                    await ddcsController.sendMesgToPlayerChatWindow(curKickName +
                                        " cannot be kicks since its name is blank", curPly.playerId);
                                }
                                break;
                            case "forcespectator":
                                // -admin forcespectator name
                                const curForceName = adminCMDArray.slice(2).join(" ");
                                // console.log("CArray2: ", curName);
                                if (curForceName !== "") {
                                    const getPlayer = await ddcsController.srvPlayerActionsRead({name: curForceName});
                                    console.log("Admin ", curPlayerDb[0].name, " has forced player ", getPlayer[0], " to spectator");
                                    if (getPlayer.length > 0) {
                                        await ddcsController.forcePlayerSpectator(
                                            getPlayer[0].playerId,
                                            "Admin has kicked you to spectator"
                                        );
                                    } else {
                                        console.log("No player found for name: ", adminCMDArray[2]);
                                    }
                                } else {
                                    console.log(curForceName, " cannot be blank when kicking player");
                                    await ddcsController.sendMesgToPlayerChatWindow(curForceName +
                                        " cannot be kicked since its name is blank", curPly.playerId);
                                }
                                break;
                            case "banplayer":
                                // -admin banplayer playername
                                const curBanName = adminCMDArray.slice(2).join(" ");
                                // console.log("CArray3: ", curName);
                                if (curBanName !== "") {
                                    const getPlayer = await ddcsController.srvPlayerActionsRead({name: curBanName});
                                    console.log("Admin ", curPlayerDb[0].name, " runs command ban: ", getPlayer[0], " has been banned");
                                    if (getPlayer.length > 0) {
                                        await ddcsController.srvPlayerActionsUpdate({
                                            _id: getPlayer[0]._id,
                                            banned: true
                                        });
                                        await ddcsController.kickPlayer(
                                            _.toNumber(getPlayer[0].playerId),
                                            "Admin has banned you from the server"
                                        );
                                    } else {
                                        console.log("No player found for name: ", adminCMDArray[2]);
                                    }
                                } else {
                                    console.log(curBanName, " cannot be blank when kicking player");
                                    await ddcsController.sendMesgToPlayerChatWindow(curBanName +
                                        " cannot be kicks since its name is blank", curPly.playerId);
                                }
                                break;
                            case "unbanplayer":
                                // -admin unbanplayer playername
                                const curName = adminCMDArray.slice(2).join(" ");
                                // console.log("CArray4: ", curName);
                                if (curName !== "") {
                                    const getPlayer = await ddcsController.srvPlayerActionsRead({name: curName});
                                    console.log("Admin ", curPlayerDb[0].name, " runs command unban: ", getPlayer[0], " has been unbanned");
                                    if (getPlayer.length > 0) {
                                        await ddcsController.srvPlayerActionsUpdate({
                                            _id: getPlayer[0]._id,
                                            banned: false
                                        });
                                        await ddcsController.kickPlayer(
                                            _.toNumber(getPlayer[0].playerId),
                                            "Admin has kicked you from the server by manual command"
                                        );
                                    } else {
                                        console.log("No player found for name: ", adminCMDArray[2]);
                                    }
                                } else {
                                    console.log(curName, " cannot be blank when kicking player");
                                    await ddcsController.sendMesgToPlayerChatWindow(curName +
                                        " cannot be kicks since its name is blank", curPly.playerId);
                                }
                                break;
                        }
                    } else {
                        await ddcsController.sendMesgToPlayerChatWindow("You do not have access to these commmands!", curPly.playerId);
                    }
                }
            });
            break;
        case "playerChangeSlot":
            if (incomingObj && incomingObj.occupiedUnitSide && incomingObj.playerInfo && (incomingObj.occupiedUnitSide === 0 ||
                (incomingObj.occupiedUnitSide.groupName && incomingObj.occupiedUnitSide.countryName))) {
                const incPlayer = {_id: incomingObj.playerInfo.ucid, name: incomingObj.playerInfo.name};
                const isSpammer = await ddcsController.slotRequestSpamProtector(incPlayer);
                if (!isSpammer) {
                    const curBaseName = incomingObj.occupiedUnitSide.groupName.split(" @")[0];
                    const curSlotSide = _.includes(ddcsController.engineCache.campaign.countrySides[2],
                        _.toUpper(incomingObj.occupiedUnitSide.countryName)) ? 2 : 1;
                    const bases = await ddcsController.campaignAirfieldActionRead({_id: curBaseName});
                    // console.log("1: ", bases[0], incomingObj.playerInfo.ucid);
                    if (bases.length > 0) {
                        dbModels.srvPlayerModel.find({_id: incomingObj.playerInfo.ucid},
                            async (err: any, serverObj: typings.ISrvPlayers[]) => {
                            if (err) { console.log("ERROR: " + err); }
                            // console.log("2: ", serverObj);
                            if (serverObj.length > 0) {
                                const curPlayer = serverObj[0];
                                const curSlotBase = bases[0];
                                await processSlotLock(curPlayer, curSlotBase.side, curSlotSide, incomingObj.playerInfo.id);
                            }
                        });
                    }
                }
            }
            break;
        case "serverInfo":
            await ddcsController.getLatestSession(incomingObj);
            break;
        case "clearAirfieldAndStrategicTable":
            // await ddcsController.airfieldModelRemoveAll();
            // await ddcsController.strategicPointModelRemoveAll();
            console.log("Starting 20 imports due to UDP missing a few, please wait");
            const loopAmount = 20;
            for (let x = 0; x < loopAmount; x++) {
                setTimeout(async () => {
                    console.log("Import Try (" + (x + 1) + "/" + loopAmount + ")");
                    await ddcsController.sendUDPPacket("frontEnd", {
                        actionObj: {
                            action: "updateCleanAirfieldAndStrategicTables",
                            reqID: 0
                        }
                    });
                }, (2000 * (x + 1)));
            }
            setTimeout(async () => {
                console.log("Mission Import Complete");
            }, ((2000 * (21))));
            break;
        case "FlagValue":
            await ddcsController.flagsActionUpdate({_id: incomingObj.flagID, value: incomingObj.flagValue});
            console.log("Got Flag ID:", incomingObj.flagID, "with value", incomingObj.flagValue);
            break;
    }
}

export async function processSlotLock(curPlayer: typings.ISrvPlayers, baseSide: number, curSlotSide: number, playerId: string) {
    const engineCache = ddcsController.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;

    if (curPlayer.sideLock === 0 && !curPlayer.isGameMaster) {
        await ddcsController.forcePlayerSpectator(playerId, i18n.CHOOSEASIDE);
    } else {
        if (curPlayer.sideLock !== curSlotSide && !curPlayer.isGameMaster) {
            await ddcsController.forcePlayerSpectator(playerId, i18n.PLAYERALREADYLOCKEDTOSIDE.replace("#1", i18n[curPlayer.sideLock]));
        }

        if (baseSide !== curSlotSide) {
            // message = "You must capture this base before you can occupy slot";
            // TODO: need to get this translation into every language...^^^^ using locked to side for now
            const sideMobBases = await ddcsController.campaignAirfieldActionRead({
                baseType: "MOB",
                bubbleMapIds: _.toString(engineCache.campaign.currentCampaignBubble)
            });
            let openBaseNames: string[] = [];
            if (sideMobBases.length > 0) {
                openBaseNames = sideMobBases.map((base) => base._id);
            }
            await ddcsController.forcePlayerSpectator(playerId,
                "Your team must capture this base before you can occupy this slot. Current Open Main Bases: " +
                openBaseNames.join(", ")
            );
        }
        await ddcsController.kickToSpectatorForNoCommJtac();
    }
}

export async function protectSlots(curPlayer: typings.ISrvPlayers, playerSide: number, playerId: string) {
    const engineCache = ddcsController.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;

    if (!curPlayer.isGameMaster) {
        if (curPlayer.sideLock === 0 && playerSide !== 0) {
            console.log("kick player back to spectator for not choosing a side: ", curPlayer.name);
            const isSpammer = await ddcsController.slotRequestSpamProtector(curPlayer);
            if (!isSpammer) {
                await ddcsController.forcePlayerSpectator(playerId, i18n.CHOOSEASIDE);
            }
        } else if (playerSide !== 0 && curPlayer.sideLock !== playerSide) {
            console.log("kick player back to spectator for being on wrong side: ", curPlayer.name);
            const isSpammer = await ddcsController.slotRequestSpamProtector(curPlayer);
            if (!isSpammer) {
                const sideMobBases = await ddcsController.campaignAirfieldActionRead({
                    baseType: "MOB",
                    bubbleMapIds: _.toString(engineCache.campaign.currentCampaignBubble)
                });
                let openBaseNames: string[] = [];
                if (sideMobBases.length > 0) {
                    openBaseNames = sideMobBases.map((base) => base._id);
                }
                // await ddcsController.forcePlayerSpectator(
                // playerId, i18n.PLAYERALREADYLOCKEDTOSIDE.replace("#1", i18n[curPlayer.sideLock]));
                await ddcsController.forcePlayerSpectator(
                    playerId,
                    "Choose an open base on " + ddcsController.side[curPlayer.sideLock] + " side. Open Bases: " + openBaseNames.join(", ")
                    );
            }
        }
    }
}

export async function slotRequestSpamProtector(curPlayer: any): Promise<boolean> {
    // has user clicked slot more than allowed times
    const curDate = new Date().getTime();
    const curConfig = ddcsController.getEngineCache();
    const dbPlayerRecord = await ddcsController.srvPlayerActionsRead({_id: curPlayer._id});
    const firstSpectatorKickTimer: number = (dbPlayerRecord[0].firstSpectatorKickTimer) ?
        dbPlayerRecord[0].firstSpectatorKickTimer.getTime() : 0;
    const totalServerKicks = dbPlayerRecord[0].totalServerKicks || 0;
    console.log("SpamProt: ", curPlayer.name, " specKicks: ", dbPlayerRecord[0].totalServerSpectatorKicks, "/",
        curConfig.config.maxAllowedSpectatorSlotKicks, " FullKicks: ", dbPlayerRecord[0].totalServerKicks, "/",
        curConfig.config.maxAllowedServerKicks);
    const isPlayerServerBanned = await ddcsController.banForSlotSpammingCheck(curPlayer);
    if (!isPlayerServerBanned && firstSpectatorKickTimer > curDate &&
        dbPlayerRecord[0].totalServerSpectatorKicks >= curConfig.config.maxAllowedSpectatorSlotKicks) {
        // kick player from server
        await ddcsController.srvPlayerActionsUpdate({
            _id: curPlayer._id,
            totalServerKicks: totalServerKicks + 1,
            totalServerSpectatorKicks: 0,
            firstSpectatorKickTimer: new Date(firstSpectatorKickTimer)
        });
        console.log("KICK PLAYER FOR SPAMMING SLOT: ", dbPlayerRecord[0].name);
        await ddcsController.kickPlayer(_.toNumber(dbPlayerRecord[0].playerId),
            "You have been kicked for clicking on a plane slot to many times, Please rejoin and click once to enter aircraft or vehicle"
        );
        return true;
    } else {
        if (firstSpectatorKickTimer < curDate) {
            await ddcsController.srvPlayerActionsUpdate({
                _id: curPlayer._id,
                totalServerSpectatorKicks: 1,
                firstSpectatorKickTimer: (new Date(curDate + (ddcsController.time.sec * 10)))
            });
        } else {
            await ddcsController.srvPlayerActionsUpdate({
                _id: curPlayer._id,
                totalServerSpectatorKicks: dbPlayerRecord[0].totalServerSpectatorKicks + 1
            });
        }
    }
    return false;
}

export async function banForSlotSpammingCheck(curPlayer: typings.ISrvPlayers): Promise<boolean> {
    const curDate = new Date().getTime();
    const curConfig = ddcsController.getEngineCache();
    const dbPlayerRecord = await ddcsController.srvPlayerActionsRead({_id: curPlayer._id});
    const totalServerKicks = dbPlayerRecord[0].totalServerKicks || 0;
    const firstKickTimer: number = (dbPlayerRecord[0].firstKickTimer) ? dbPlayerRecord[0].firstKickTimer.getTime() : 0;

    if (firstKickTimer > curDate &&
        totalServerKicks >= curConfig.config.maxAllowedServerKicks) {
        // ban user for being kicked for slot spamming too many times

        console.log("BANNING PLAYER FOR SPAMMING SLOT: ", dbPlayerRecord[0].name);
        await ddcsController.srvPlayerActionsUpdate({
            _id: curPlayer._id,
            totalServerKicks: 0,
            totalServerSpectatorKicks: 0,
            firstKickTimer: new Date(),
            firstSpectatorKickTimer: new Date(),
            bannedReason: "For taking control of units without permission and not vacating after being told (Auto)",
            banned: true
        });
        await ddcsController.banPlayer(_.toNumber(curPlayer.playerId), 86400, "");
        return true;
    } else {
        if (firstKickTimer < curDate) {
            await ddcsController.srvPlayerActionsUpdate({
                _id: curPlayer._id,
                totalServerKicks: 0,
                totalServerSpectatorKicks: 0,
                firstKickTimer: (new Date(curDate + (ddcsController.time.oneHour * 24))),
                firstSpectatorKickTimer: (new Date(curDate + (ddcsController.time.sec * 5)))
            });
        }
    }
    return false;
}

