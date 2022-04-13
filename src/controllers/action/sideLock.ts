/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as ddcsController from "../";
import {I18nResolver} from "i18n-ts";

const sideLock = [
    "Platinum Contributor",
    "Ludicrous Contributor",
    "Plaid Contributor"
];

export async function lockUserToSide(incomingObj: any, lockToSide: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const curPlayerArray = await ddcsController.srvPlayerActionsRead({_id: incomingObj.from});
        const curPly = curPlayerArray[0];
        const engineCache = ddcsController.getEngineCache();
        const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
        if (curPly && curPly.sideLock !== 0) {
            const mesg = i18n.PLAYERALREADYLOCKEDTOSIDE.replace("#1", i18n[curPly.sideLock].toUpperCase());
            await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
            resolve();
        } else {
            const mesg = i18n.PLAYERISNOWLOCKEDTOSIDE.replace("#1", i18n[lockToSide].toUpperCase());
            await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
            await ddcsController.srvPlayerActionsUpdate({_id: incomingObj.from, sideLock: lockToSide});
            resolve();
        }
        resolve();
    });
}

export async function balanceUserToSide(incomingObj: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const curPlayerArray = await ddcsController.srvPlayerActionsRead({_id: incomingObj.from});
        const curPly = curPlayerArray[0];
        const engineCache = ddcsController.getEngineCache();
        const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
        if (curPly && curPly.sideLock !== 0) {
            const mesg = i18n.PLAYERALREADYLOCKEDTOSIDE.replace("#1", i18n[curPly.sideLock].toUpperCase());
            await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
            resolve();
        } else {
            const currentCampaign = await ddcsController.campaignsActionsReadLatest();
            let lockToSide: number;
            if (currentCampaign.totalMinutesPlayed_blue > currentCampaign.totalMinutesPlayed_red) {
                lockToSide = 1;
            } else {
                lockToSide = 2;
            }
            const mesg = i18n.PLAYERISNOWLOCKEDTOSIDE.replace("#1", i18n[lockToSide].toUpperCase());
            await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
            await ddcsController.srvPlayerActionsUpdate({_id: incomingObj.from, sideLock: lockToSide});
            resolve();
        }
        resolve();
    });
}

export async function swapUserToLosingSide(incomingObj: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
        let lockToSide: number = 0;
        const curPlayerArray = await ddcsController.srvPlayerActionsRead({_id: incomingObj.from});
        const curPly = curPlayerArray[0];
        const engineCache = ddcsController.getEngineCache();
        const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
        // tslint:disable-next-line:triple-equals
        if (curPly && curPly.sideLock == 0) {
            const mesg = "You are not currently locked to any side, please use -help, -balance, -red or -blue";
            await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
            resolve();
        } else {
            // Let Patreons Platinum and above switch sides every +30 hours
            let patreonLvls;
            const currentPatreonLvls = await ddcsController.serverActionsRead({_id: process.env.SERVER_NAME});
            if (currentPatreonLvls.length > 0) {
                patreonLvls = currentPatreonLvls[0].patreonLvl;
            }

            if (patreonLvls && Object.entries(patreonLvls).length > 0) {
                for (const [patreonKey, patreonObj] of Object.entries(patreonLvls)) {
                    const epocNow = new Date().getTime();
                    const premiumSwitchTimer = (curPly.premiumSideSwitchTimer) ? new Date(curPly.premiumSideSwitchTimer).getTime() : 0;
                    if (sideLock.includes(patreonKey) &&
                        patreonObj.includes(curPly.name) &&
                        premiumSwitchTimer < epocNow
                    ) {
                        console.log("Player " + curPly.name + " has used patreon perk to swap sides");
                        if (curPly.sideLock === 1) {
                            lockToSide = 2;
                        } else {
                            lockToSide = 1;
                        }
                        await ddcsController.srvPlayerActionsUpdate({
                            _id: curPly._id,
                            premiumSideSwitchTimer: new Date(epocNow + (ddcsController.time.oneHour * 30))
                        });
                    } else {
                        console.log("Patreon user " + curPly.name + " tried to switch but failed ",
                            sideLock.includes(patreonKey),
                            patreonObj.includes(curPly.name),
                            premiumSwitchTimer < epocNow
                        );
                    }
                }
            } else {
                const currentRedBases = await ddcsController.campaignAirfieldActionRead({
                    side: 1,
                    enabled: true
                });
                const currentBlueBases = await ddcsController.campaignAirfieldActionRead({
                    side: 2,
                    enabled: true
                });
                if (currentRedBases.length < 10) {
                    lockToSide = 1;
                } else if (currentBlueBases.length < 10) {
                    lockToSide = 2;
                }
            }

            // tslint:disable-next-line:triple-equals
            if (lockToSide == 0) {
                const mesg = "You cannot swap teams right now, the other team isn't losing that badly just yet, they still have more than 10 bases.";
                await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
            } else {
                const mesg = i18n.PLAYERISNOWLOCKEDTOSIDE.replace("#1", i18n[lockToSide].toUpperCase());
                await ddcsController.sendMesgToPlayerChatWindow(mesg, curPly.playerId);
                await ddcsController.srvPlayerActionsUpdate({_id: incomingObj.from, sideLock: lockToSide});
            }
            resolve();
        }
        resolve();
    });
}
