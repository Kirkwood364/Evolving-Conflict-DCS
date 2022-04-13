/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../../";

export async function processEventTakeoff(eventObj: any): Promise<void> {
    const iUnit = await ddcsControllers.unitActionRead({unitId: eventObj.data.initiator.unitId});
    if (iUnit.length > 0) {
        const curIUnit = iUnit[0];
        const curUnitSide = curIUnit.coalition;
        // console.log("curIunit: ", curIUnit);
        const playerArray = await ddcsControllers.srvPlayerActionsRead({sessionName: ddcsControllers.getSessionName()});
        const iPlayer = _.find(playerArray, {name: curIUnit.playername});
        if (iPlayer && iPlayer.ucid) {
            // console.log("iPlayer check on takeoff: ", iPlayer.name);
            if (await ddcsControllers.checkWeaponComplianceOnTakeoff(iPlayer, curIUnit)) {
                const friendlyBases = await ddcsControllers.getBasesInProximity(curIUnit.lonLatLoc, 5, curUnitSide);
                // console.log("getBASE: ", curIUnit, curUnitSide, friendlyBases);
                // console.log("takeoff: ", friendlyBases);
                if (friendlyBases.length > 0) {
                    if (!_.includes(iPlayer.slot, "_") && !iPlayer.takeOffCostDeducted) {
                        // console.log("checkSlotTakeoff: ", iPlayer.slot);
                        await ddcsControllers.removeWarbonds(
                            iPlayer,
                            curIUnit,
                            "Takeoff"
                        );
                    }
                    /*
                    await ddcsControllers.sendToCoalition({payload: {
                            action: eventObj.action,
                            data: _.cloneDeep(iCurObj)
                        }});
                    await ddcsControllers.simpleStatEventActionsSave(iCurObj);
                    */
                }
            }
        }
    } else {
        console.log("TAKEOFF: Can't Find Initiator Id: ", eventObj.data.initiator);
    }
}
