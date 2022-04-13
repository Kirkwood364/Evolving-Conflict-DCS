/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../../";
import {getPlayerBalance} from "../../";

// bring this into the server configs, remove the hardcode
export const maxPlayersPerSide = 30;

export let rtPlayerArray: any;

export let banArray: string[] = [];

export let kickCommsLimiter: any = {};

export async function playerUpdateRecord(player: any): Promise<void> {
    player._id = player.ucid;
    player.playerId = player.id;
    player.sessionName = ddcsControllers.getSessionName();
    if (player.ucid) {
        await ddcsControllers.srvPlayerActionsUpdateFromServer(player);
    }
}

export function setRTPlayerArray(setArray: any) {
    rtPlayerArray = setArray;
}

export function getRTPlayerArray() {
    return rtPlayerArray;
}

export function setBanArray(curBanArray: string[]) {
    banArray = curBanArray;
}

export function getBanArray() {
    return banArray;
}

export async function updateCurrentRunningCampaign(missionFilename: string) {
    const engineCache = ddcsControllers.getEngineCache();
    if (missionFilename !== "") {
        const missionArray = missionFilename.split("_");
        if (_.isString(missionArray[0]) && _.isNumber(_.toNumber(missionArray[1])) &&
            engineCache.config.currentCampaignId !== missionArray[0]) {
            console.log("ChangedMissionFilename: ", missionFilename);
            await ddcsControllers.serverActionsUpdate({_id: process.env.SERVER_NAME, currentCampaignId: missionArray[0]});
            await ddcsControllers.updateConfig();
        }
        if (_.isString(missionArray[0]) && _.isNumber(_.toNumber(missionArray[1])) &&
            engineCache.campaign.currentCampaignBubble !== _.toNumber(missionArray[1])) {
            console.log("ChangedCampaignBubble: ", missionFilename);
            await ddcsControllers.campaignConfigActionsUpdate({_id: missionArray[0], currentCampaignBubble: _.toNumber(missionArray[1])});
            await ddcsControllers.updateCampaign(missionArray[0]);
        }
    }
}

export async function processPlayerEvent(playerArray: any): Promise<void> {
    const curPlayerArray = playerArray.players;
    const curOnlineUcidArray = curPlayerArray.map((pl: { ucid: string; }) => pl.ucid);
    if (ddcsControllers.getSessionName() !== "") {
        await ddcsControllers.sessionsActionsUpdate({_id: ddcsControllers.getSessionName(), playersOnlineArray: curOnlineUcidArray});
    }
    const playerBalance = await ddcsControllers.getPlayerBalance();
    // console.log("playerBalance: ", playerBalance);
    const engineCache = ddcsControllers.getEngineCache();

    await updateCurrentRunningCampaign(playerArray.missionFileName);

    if (curPlayerArray.length === 1) {
        // server just timed out everyone, give all those users their in air their life points back
        const pastPlayerArray = getRTPlayerArray();
        // console.log("pastPlayerArray:",pastPlayerArray);
        if (pastPlayerArray !== undefined) {
            for (const player of pastPlayerArray) {
                // console.log("Giving Player Back LP and award RS: ", player);
                await ddcsControllers.srvPlayerActionsApplyTempToRealScore({
                    _id: player.ucid
                });
                await ddcsControllers.srvPlayerActionsAddWarbonds(player);
            }
        }
    }

    if (curPlayerArray.length > 0) {
        setRTPlayerArray(curPlayerArray);
        for (const player of curPlayerArray) {
            // console.log("player: ", player);
            // player check sides, lock etc
            const curPlyrUcid = player.ucid;
            const curPlyrName = player.name;
            const isInGameMasterSlot = _.includes(player.slot, "instructor");
            const isArtilleryCmdr = _.includes(player.slot, "artillery_commander");
            // const isForwardObserver = _.includes(player.slot, "forward_observer");
            // console.log("player slot: ", player.slot);

            const curPlayerDb = await ddcsControllers.srvPlayerActionsRead({_id: curPlyrUcid});
            if (curPlayerDb.length > 0) {
                const localPlayer = curPlayerDb[0];

                // lockout if server is not synced
                if (!localPlayer.isGameMaster && ddcsControllers.getMissionStartupReSync() && player.side !== 0) {
                    await ddcsControllers.forcePlayerSpectator(
                        player.id,
                        "You attempted to slot while the server was still syncing, please rejoin and wait for the sync to finish."
                    );
                }

                if (localPlayer.banned) {
                    console.log("Banning User: ", curPlyrName, curPlyrUcid, player.ipaddr);
                    await ddcsControllers.kickPlayer(
                        player.id,
                        ""
                    );
                    await ddcsControllers.banPlayer(player.id, 86400, "");
                }

                if (isInGameMasterSlot && !localPlayer.isGameMaster) {
                    await ddcsControllers.forcePlayerSpectator(player.id, "You are not allowed to use Game Master slot.");
                }
                if (engineCache.campaign.isJtacLocked && isArtilleryCmdr &&
                    !localPlayer.gciAllowed && localPlayer.sideLock === player.side) {
                    await ddcsControllers.forcePlayerSpectator(player.id, "You are not allowed to use " +
                        "GCI/Tac Commander slot. Reason:" + localPlayer.gciBlockedReason);
                }

                if (curPlyrName === "") {
                    console.log("Kicking User for blank name: ", curPlyrName, curPlyrUcid, player.ipaddr);
                    await ddcsControllers.kickPlayer(
                        player.id,
                        "You have been kicked from this server for having a blank name."
                    );
                }

                if (/^player$/gi.test(curPlyrName)) {
                    console.log("Kicking User generic name Player: ", curPlyrName, curPlyrUcid, player.ipaddr);
                    await ddcsControllers.kickPlayer(
                        player.id,
                        "You have been kicked from this server not creating a unique name. Come back when you change your name"
                    );
                }
            }
            const curEpoc = new Date().getTime();
            if (curPlyrName === "" && kickCommsLimiter[curPlyrName] < curEpoc) {
                kickCommsLimiter[curPlyrName] = curEpoc + ddcsControllers.time.sec;
                await ddcsControllers.kickToSpectatorForNoCommJtac();
            }
            await playerUpdateRecord(player);
        }
    }
}

