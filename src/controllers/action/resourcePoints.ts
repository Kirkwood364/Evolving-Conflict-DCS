/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../typings";
import * as ddcsControllers from "../";
import {I18nResolver} from "i18n-ts";

export async function spendResourcePoints(
    player: typings.ISrvPlayers,
    rsCost: number,
    rsItem: string,
    itemObj: typings.IUnit
): Promise<boolean> {

    let curUnit: typings.IUnit;
    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, player.lang).translation as any;
    if (isNaN(Number(player.slot))) {
        // console.log("player doesnt have slotID: " + player);
        return Promise.resolve(false);
    } else {
        const cUnit = await ddcsControllers.unitActionRead({unitId: Number(player.slot)});
        let message;
        let currentObjUpdate: any;
        curUnit = cUnit[0];
        if (curUnit.inAir) {
            const unitExist = await ddcsControllers.unitActionRead({_id: "AI|" + itemObj.name + "|"});
            if (unitExist.length > 0 && rsItem === "Tanker") {
                message = "G: Tanker " + "AI|" + itemObj.name + "|" + " Already exists";
                await ddcsControllers.sendMesgToGroup(
                    player,
                    curUnit.groupId,
                    message,
                    5
                );
                return false;
            } else {
                if (player.warbonds >= rsCost) {
                    currentObjUpdate = {
                        _id: player._id,
                        warbonds: player.warbonds - rsCost
                    };
                    await ddcsControllers.srvPlayerActionsUpdate(currentObjUpdate);
                    // message = "G: " + i18n.YOUHAVESPENTRSPOINTS.replace("#1", i18n[1])
                    //     .replace("#2", rsCost).replace("#3", rsItem).replace("#4", currentObjUpdate.warbonds);
                    message = "G: You have spend " + rsCost + " warbonds. Your have " + player.warbonds + " left.";
                    await ddcsControllers.sendMesgToGroup(
                        player,
                        curUnit.groupId,
                        message,
                        5
                    );
                    return true;
                } else {
                    // message = "G: " + i18n.YOUDONTHAVEENOUGHRSPOINTSTOBUY.replace("#1", i18n[1])
                    //    .replace("#2", rsCost).replace("#3", rsItem).replace("#4", player.warbonds);
                    message = "G: Your dont have enough warbonds - have: " + player.warbonds + " need: " + rsCost;
                    await ddcsControllers.sendMesgToGroup(
                        player,
                        curUnit.groupId,
                        message,
                        5
                    );
                    return false;
                }
            }
        } else {
            message = "G: You cannot order this item on the ground";
            await ddcsControllers.sendMesgToGroup(
                player,
                curUnit.groupId,
                message,
                5
            );
            return false;
        }
    }
}


