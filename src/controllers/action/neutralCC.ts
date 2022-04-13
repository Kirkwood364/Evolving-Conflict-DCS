/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as typings from "../../typings";
import * as ddcsControllers from "../";
import * as ddcsController from "./unitDetection";
import {I18nResolver} from "i18n-ts";

export async function checkCmdCenters(): Promise<void> {
    let basesChanged = false;
    let curSide;
    const engCache = ddcsControllers.getEngineCache();
    const bases = await ddcsControllers.campaignAirfieldActionRead({baseType: "FOB", enabled: true});
    for (const base of bases) {
        // check for free bases
        if (engCache.campaign.bubbleMap[_.toString(engCache.campaign.currentCampaignBubble)].freeAirframeBases.includes(base._id)) {
            // free airframe base, set to default
            if (base.side !== base.defaultStartSide) {
                await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: base.defaultStartSide})
                    .catch((err: any) => {
                        console.log("erroring line23: ", err);
                    });
            }
        } else {
            const isCCExist = await ddcsControllers.unitActionRead({_id: base._id + " Shelter", dead: false});
            if (isCCExist.length > 0) {
                curSide = isCCExist[0].coalition;
                if (_.get(base, "side") !== curSide) {
                    basesChanged = true;
                    await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: curSide})
                        .catch((err: any) => {
                            console.log("erroring line162: ", err);
                        });
                }
            } else {
                if (/^~/.test(base._id)) {
                    await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: base.defaultStartSide})
                        .catch((err: any) => {
                            console.log("erroring line162: ", err);
                        })
                    ;
                } else if (base.side !== 0) {
                    basesChanged = true;
                    await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: 0})
                        .catch((err: any) => {
                            console.log("erroring line162: ", err);
                        })
                    ;
                }
            }
        }
    }
    /*
    if (basesChanged) {
        await ddcsControllers.setbaseSides();
    }
     */
}

export async function spawnCCAtNeutralBase(curPlayerUnit: typings.IUnit): Promise<boolean> {
    const curPlayerArray = await ddcsControllers.srvPlayerActionsRead({name: curPlayerUnit.playername});
    const curPly = curPlayerArray[0];
    const engineCache = ddcsControllers.getEngineCache();
    const i18n = new I18nResolver(engineCache.i18n, curPly.lang).translation as any;
    const bases = await ddcsControllers.campaignAirfieldActionRead({baseType: "FOB", enabled: true});
    const mainNeutralBases = _.remove(bases, (base) => {
        return !_.includes(base._id, "#");
    });
    // console.log("bases: ", bases, curPlayerUnit);
    for ( const base of mainNeutralBases) {
        const unitsInProx = await ddcsControllers.getPlayersInProximity(base.centerLoc, 3.4, false, curPlayerUnit.coalition);
        if (_.find(unitsInProx, {playername: curPlayerUnit.playername})) {
            const cmdCenters = await ddcsControllers.unitActionRead({_id: base._id + " Shelter", dead: false});
            if (cmdCenters.length > 0) {
                // console.log("player own CC??: " + (cmdCenters[0].coalition === curPlayerUnit.coalition));
                if (cmdCenters[0].coalition === curPlayerUnit.coalition) {
                    // console.log("cmdCenter already exists, replace units: " + base.name + " " + cmdCenters);
                    await ddcsControllers.sendMesgToGroup(
                        curPly,
                        curPlayerUnit.groupId,
                        "G: " + i18n.BASECOMMANDCENTEREXISTS.replace("#1", base._id),
                        5
                    );
                    // console.log('SSB: ', serverName, base.name, curPlayerUnit.coalition);
                    await ddcsControllers.spawnSupportBaseGrp(base._id, curPlayerUnit.coalition, false);
                    return false;
                } else {
                    console.log(" enemy cmdCenter already exists: " + base._id + " " + cmdCenters);
                    await ddcsControllers.sendMesgToGroup(
                        curPly,
                        curPlayerUnit.groupId,
                        "G: " + i18n.ENEMYCOMMANDCENTEREXISTS.replace("#1", base._id),
                        5
                    );
                    return false;
                }
            } else {
                console.log("cmdCenter doesnt exist " + base._id);
                // await ddcsControllers.spawnLogisticCmdCenter({}, false, base, curPlayerUnit.coalition);
                await ddcsControllers.campaignAirfieldActionUpdateSide({_id: base._id, side: curPlayerUnit.coalition});
                // await ddcsControllers.setbaseSides();
                await ddcsControllers.spawnSupportBaseGrp(base._id, curPlayerUnit.coalition, false);
                await ddcsControllers.sendMesgToCoalition(
                    curPlayerUnit.coalition,
                    "BASECOMMANDCENTERISBUILT",
                    [base._id],
                    20
                );
                return true;
            }
        }
    }
    return false;
}
