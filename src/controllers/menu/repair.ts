/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as typing from "../../typings";
import * as ddcsControllers from "../";

export async function repairBase(base: typing.ICampaignAirfield, curUnit: typing.IUnit): Promise<void> {
    console.log("repairBase: ", base._id);
    const curBaseName = _.split(base._id, " #")[0];
    // console.log("rebase start");
    const resp = await ddcsControllers.healBase(curBaseName, curUnit, false);
    // console.log("base healed");
    if (resp) {
        await ddcsControllers.unitActionUpdateByUnitId({unitId: curUnit.unitId, intCargoType: ""});
        const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: curUnit.playername});
        const curPly = curPlayerArray[0];
        const engineCache = ddcsControllers.getEngineCache();
        const shelters = _.find(engineCache.unitDictionary, {type: "Shelter"});
        // console.log("shelters:", shelters);
        console.log(curPly.name, " is repairing ", base._id, ", warbondCost:", shelters.warbondCost);
        await ddcsControllers.addWarbonds(curPly, curUnit, "baseRepair", shelters.warbondCost);
        await ddcsControllers.sendMesgToCoalition(
            curUnit.coalition,
            "BASEHASBEENBUILT",
            [curBaseName],
            5
        );
    }
}

export async function repairBaseSAMRadars(): Promise<void> {
    // console.log("Base Radars Repair Check");
    const engineCache = ddcsControllers.getEngineCache();
    const samTypeArray = _.map(_.filter( engineCache.unitDictionary, (filtObj) => {
        return filtObj.spawnCat.includes("samRadar") || filtObj.spawnCat.includes("unarmedAmmo");
    }) , "type");

    const units = await ddcsControllers.unitActionRead({type: {$in: samTypeArray }, playerOwnerId: null, dead: false});
    const groups = _.groupBy(units, "groupName");
    for (const group of Object.keys(groups)) {
        let launcher = 0;
        for (const element of groups[group]) {
            const curUnitDict = _.find(
                _.cloneDeep( engineCache.unitDictionary),
                {_id: element.type}
            );
            if (curUnitDict) {
                element.unitDict = curUnitDict;
                if (element.unitDict.launcher) {
                    launcher += 1;
                }
            }
        }
        const curReqArray = _.get(
            _.find(groups[group], (curGroup) => {
                return curGroup.unitDict.launcher;
            }),
            "unitDict.reloadReqArray"
        );

        const unitsMissing = _.difference(curReqArray, _.uniq(_.map(groups[group], "type")));

        // if there are units missing and the launcher exists, fix the group
        if (unitsMissing.length && launcher && _.sample([true, false])) {
            const curSAMTemplate = groups[group][0];
            const tNameArry = _.split(curSAMTemplate._id, "|");
            // add missing units to existing array
            if (tNameArry.length > 1) {
                // console.log("repairStarSam: ", tNameArry, _.get(tNameArry, [2]));
                await ddcsControllers.spawnStarSam(
                    curSAMTemplate.coalition,
                    tNameArry[1],
                    tNameArry[2].charAt(0),
                    false,
                    launcher,
                    unitsMissing[0],
                    curSAMTemplate.lonLatLoc
                );
                // console.log("TRUCKHERE? ", unitsMissing);
                for (const removeElement of groups[group]) {
                    await ddcsControllers.destroyUnit(removeElement.name, "unit");
                }
            }
        }
    }
}
