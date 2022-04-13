/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../";
import {I18nResolver} from "i18n-ts";

export async function checkWeaponComplianceOnTakeoff(iPlayer: any, curIUnit: any): Promise<boolean> {
    const engineCache = ddcsControllers.getEngineCache();

    for (const weaponRule of engineCache.campaign.weaponRules || []) {
        const limitedWeapons: any[] = [];
        let maxLimitedWeaponCount = 0;
        for ( const value of curIUnit.ammo || []) {
            const curTypeName = value.typeName;
            if (_.includes(weaponRule.weapons, curTypeName)) {
                limitedWeapons.push(curTypeName);
                maxLimitedWeaponCount = maxLimitedWeaponCount + value.count;
            }
        }
        // console.log("weaponRestrictions: ", maxLimitedWeaponCount, " > ", weaponRule.maxTotalAllowed, iPlayer.playerId, iPlayer.name) ;
        if (maxLimitedWeaponCount > weaponRule.maxTotalAllowed) {
            const msg = "Removed from aircraft not complying with weapon restrictions, (" +
                maxLimitedWeaponCount + " of " + _.join(limitedWeapons) + ")";
            console.log("Removed " + iPlayer.name + " from aircraft not complying with weapon restrictions, (" +
                maxLimitedWeaponCount + " of " + _.join(limitedWeapons) + ")");
            await ddcsControllers.forcePlayerSpectator(
                iPlayer.playerId,
                msg
            );
            return false;
        }
    }
    return true;
}

export async function checkAircraftWeaponCompliance(): Promise<void> {
    const engineCache = ddcsControllers.getEngineCache();
    const latestSession = await ddcsControllers.sessionsActionsReadLatest();
    if (latestSession && latestSession._id) {
        const srvPlayers = await ddcsControllers.srvPlayerActionsRead({sessionName: latestSession._id, playername: {$ne: ""}});
        for (const curPlayer of srvPlayers) {
            const i18n = new I18nResolver(engineCache.i18n, curPlayer.lang).translation as any;
            const cUnit = await ddcsControllers.unitActionRead({dead: false, playername: curPlayer.name});
            if (cUnit.length > 0) {
                const curUnit = cUnit[0];
                // console.log("CU:", curUnit);
                for (const weaponRule of engineCache.campaign.weaponRules || []) {
                    const limitedWeapons: any[] = [];
                    let maxLimitedWeaponCount = 0;
                    for (const value of curUnit.ammo || []) {
                        const curTypeName = value.typeName;
                        if (curTypeName) {
                            if (_.includes(weaponRule.weapons, curTypeName)) {
                                limitedWeapons.push(curTypeName);
                                maxLimitedWeaponCount = maxLimitedWeaponCount + value.count;
                            }
                        }
                    }
                    if (maxLimitedWeaponCount > weaponRule.maxTotalAllowed && !curUnit.inAir) {
                        const message = "G: " + i18n.YOUHAVEBANNEDWEAPONS.replace("#1", maxLimitedWeaponCount)
                            .replace("#2", _.join(limitedWeapons)).replace("#3", weaponRule.maxTotalAllowed);

                        await ddcsControllers.sendMesgToGroup(curPlayer, curUnit.groupId, message, 30);
                    }
                }
            }
        }
    }
}
