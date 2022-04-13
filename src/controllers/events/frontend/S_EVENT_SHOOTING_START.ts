/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../../";
import {weaponScoreActionsRead} from "../../";

export async function processEventShootingStart(eventObj: any): Promise<void> {

    // save shot list to lookup later if weapon in kill event is missing
    await ddcsControllers.simpleStatEventActionsSave({
        _id: ddcsControllers.getSessionName() + "_" + new Date().getTime() + "_" + _.random(1000000, 9999999),
        sessionName: ddcsControllers.getSessionName(),
        eventCode: "SHOOTING_START",
        initiator: eventObj.data.initiator,
        target: eventObj.data.target,
        weapon: (eventObj.data.weapon) ? eventObj.data.weapon : {weapon_name: eventObj.data.weapon_name}
    });

    let curAlias = null;
    let hasNoParentObj = false;
    const curTableId = (eventObj.data.weapon && eventObj.data.weapon.typeName) ?
        eventObj.data.weapon.typeName : "_" + eventObj.data.weapon_name;

    if (curTableId === "_" + eventObj.data.weapon_name) {
        const findMainWeapon = await ddcsControllers.weaponScoreActionsRead({_id: new RegExp(eventObj.data.weapon_name + "$/")});
        if (findMainWeapon.length === 1) {
            curAlias = findMainWeapon[0]._id;
            console.log("Found Weapon Alias: ", findMainWeapon[0]._id);
        }
        if (findMainWeapon.length === 0) {
            console.log("No Parent Record: ", eventObj.data.weapon_name);
            hasNoParentObj = true;
        }
        if (findMainWeapon.length > 1) {
            console.log("Multiple Matches: ", eventObj.data.weapon_name);
        }
    }

    await ddcsControllers.weaponScoreActionsCheck({
        _id: curTableId,
        name: curTableId,
        alias: curAlias,
        hasNoParentObj,
        displayName: (eventObj.data.weapon) ? eventObj.data.weapon.displayName : null,
        weapon_name: (eventObj.data.weapon) ? eventObj.data.weapon.weapon_name : eventObj.data.weapon_name,
        unitType: (eventObj.data.initiator) ? eventObj.data.initiator.type : null,
        category: (eventObj.data.weapon) ? eventObj.data.weapon.category : null
    });
}
