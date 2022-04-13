/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../../";

export async function processEventShot(eventObj: any): Promise<void> {

    // console.log("EVENT_SHOT: ", eventObj);
    await ddcsControllers.detectHarmShot(eventObj);

    // save shot list to lookup later if weapon in kill event is missing
    await ddcsControllers.simpleStatEventActionsSave({
        _id: ddcsControllers.getSessionName() + "_" + new Date().getTime() + "_" + _.random(1000000, 9999999),
        sessionName: ddcsControllers.getSessionName(),
        eventCode: "SHOT",
        initiator: eventObj.data.initiator,
        target: eventObj.data.target,
        weapon: (eventObj.data.weapon) ? eventObj.data.weapon : {weapon_name: eventObj.data.weapon_name}
    });

    const curTableId = (eventObj.data.weapon && eventObj.data.weapon.typeName) ?
        eventObj.data.weapon.typeName : "_" + eventObj.data.weapon_name;

    const weaponCheckObj: any = {
        _id: curTableId,
        name: curTableId,
        displayName: (eventObj.data.weapon) ? eventObj.data.weapon.displayName : null,
        weapon_name: (eventObj.data.weapon) ? eventObj.data.weapon.weapon_name : eventObj.data.weapon_name,
        unitType: (eventObj.data.initiator) ? eventObj.data.initiator.type : null,
        category: (eventObj.data.weapon) ? eventObj.data.weapon.category : null
    };

    if (curTableId === "_" + eventObj.data.weapon_name) {
        const findMainWeapon = await ddcsControllers.weaponScoreActionsRead({_id: new RegExp(eventObj.data.weapon_name + "$/")});
        if (findMainWeapon.length === 1) {
            console.log("Found Weapon Alias: ", findMainWeapon[0]._id);
            weaponCheckObj.curAlias = findMainWeapon[0]._id;
        }
        if (findMainWeapon.length === 0) {
            console.log("No Parent Record: ", eventObj.data.weapon_name);
        }
        if (findMainWeapon.length > 1) {
            console.log("Multiple Matches: ", eventObj.data.weapon_name);
        }
    }

    await ddcsControllers.weaponScoreActionsCheck(weaponCheckObj);

    /*
    SHOT:  {
        action: 'S_EVENT_SHOT',
            data: {
            id: 1,
                initiator: {
                category: 1,
                    groupId: 1005783,
                    side: 1,
                    type: 'T-80UD',
                    unitId: 1005784
            },
            initiatorId: 1005784,
                name: 'S_EVENT_SHOT',
                time: 2906.471,
                weapon: {
                category: 'MISSILE',
                    displayName: 'AT-11 Sniper',
                    impactPoint: [Object],
                    typeName: 'weapons.missiles.REFLEX'
            },
            weapon_name: 'REFLEX'
        },
        type: 'event'
    }

/*
EVENT_SHOT:  { action: 'S_EVENT_SHOT',
data:
{ id: 1,
 initiator:
  { category: 1,
    groupId: 8076,
    side: 2,
    type: 'F-16C_50',
    unitId: 13437 },
 initiatorId: 13437,
 name: 'S_EVENT_SHOT',
 time: 47727.693,
 weapon:
  { category: 'MISSILE',
    displayName: 'AIM-120C',
    targetName: 'Maykop-Khanskaya #130',
    typeName: 'weapons.missiles.AIM_120C' },
 weapon_name: 'AIM_120C' },
type: 'event' }
 */

}
