/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../typings";
import * as ddcsControllers from "../";

export async function maintainPvEConfig(): Promise<void> {
    const engineCache = ddcsControllers.getEngineCache();
    const stackObj = await campaignStackTypes();
    // console.log("stackobj: ", stackObj);
    let didAISpawn: boolean = false;
    for (const pveConfig of engineCache.campaign.pveAIConfig) {
        for (let x = 0; x < pveConfig.campaign.length; x++) {
            const aIConfig = pveConfig.campaign[x];
            // @ts-ignore
            const sideStackedAgainst = stackObj[aIConfig.functionCall];
            if (sideStackedAgainst.ratio >= aIConfig.stackTrigger) {
                didAISpawn = (!didAISpawn) ?  await processAI(sideStackedAgainst, aIConfig) : false;
            } else {
                if (pveConfig.campaign.length > 1) {
                    didAISpawn = (!didAISpawn) ? await processAI({underdog: 1}, aIConfig) : false;
                    didAISpawn = (!didAISpawn) ? await processAI({underdog: 2}, aIConfig) : false;
                    x++; // double increment
                }
            }
        }
    }
}

export async function campaignStackTypes(): Promise<{}> {
    const fullCampaign = await ddcsControllers.checkCurrentPlayerBalance();
    const instant = await ddcsControllers.checkRealtimeSideBalance();
    return {
        fullCampaign,
        instant
    };
}

export async function processAI(sideStackedAgainst: {underdog: number}, aIConfig: typings.IAIConfig): Promise<boolean> {
    // console.log("sideStackedAgainst: ", sideStackedAgainst);
    if (sideStackedAgainst.underdog > 0) {
        const friendlyBases = await ddcsControllers.campaignAirfieldActionRead({
            baseType: "MOB",
            side: sideStackedAgainst.underdog,
            enabled: true
        });
        return await checkBasesToSpawnConvoysFrom(friendlyBases, aIConfig);
    }
    return false;
}

export async function checkBasesToSpawnConvoysFrom(
    friendlyBases: typings.ICampaignAirfield[],
    aIConfig: typings.IAIConfig
): Promise<boolean> {
    for (const base of friendlyBases) {
        const shelterAlive = await ddcsControllers.unitActionRead({
            _id:  base._id + " Shelter",
            dead: false,
            coalition: base.side
        });

        // console.log("CONVOY SHELTER ALIVE: ", shelterAlive.length, !aIConfig.isShelterRequired, aIConfig.isShelterRequired);
        if (shelterAlive.length > 0 || !aIConfig.isShelterRequired) {
            // @ts-ignore
            for (const [key, baseTemplate] of Object.entries(base.polygonLoc.convoyTemplate)) {
                if (aIConfig.AIType === "groundConvoy") {
                    const destBaseInfo = await ddcsControllers.campaignAirfieldActionRead({
                        _id: baseTemplate.destBase,
                        side: ddcsControllers.enemyCountry[base.side],
                        enabled: true
                    });
                    if (destBaseInfo.length > 0) {
                        const curBase = destBaseInfo[0];
                        const baseConvoyGroupName = "AI|" + aIConfig.name +
                            "|" + baseTemplate.sourceBase +
                            "|" + baseTemplate.destBase + "|";
                        const convoyGroup = await ddcsControllers.unitActionRead({
                            groupName: baseConvoyGroupName,
                            isCrate: false,
                            dead: false
                        });
                        if (convoyGroup.length === 0) {
                            // console.log("convoy ", base.name, " attacking ", curBase.name);
                            const message = "C: A convoy just left " + base._id + " is attacking " + curBase._id;

                            const curNextUniqueId = ddcsControllers.getNextUniqueId();
                            ddcsControllers.setRequestJobArray({
                                reqId: curNextUniqueId,
                                callBack: "spawnConvoy",
                                reqArgs: {
                                    baseConvoyGroupName,
                                    side: base.side,
                                    aIConfig,
                                    message
                                }
                            }, curNextUniqueId);
                            await ddcsControllers.sendUDPPacket("frontEnd", {
                                actionObj: {
                                    action: "getGroundRoute",
                                    type: "roads",
                                    lat1: base.centerLoc[1],
                                    lon1: base.centerLoc[0],
                                    lat2: curBase.centerLoc[1],
                                    lon2: curBase.centerLoc[0],
                                    reqID: curNextUniqueId,
                                    time: new Date()
                                }
                            });
                            return true;
                        }
                    }
                }
                if (aIConfig.AIType === "CAPDefense") {
                    const destBaseInfo = await ddcsControllers.campaignAirfieldActionRead({
                        _id: baseTemplate.destBase,
                        side: ddcsControllers.enemyCountry[base.side],
                        enabled: true
                    });
                    if (destBaseInfo.length > 0) {
                        // check if convoy exists first
                        const baseCapGroupName = "AI|" + aIConfig.name + "|" + base._id + "|";
                        const capGroup = await ddcsControllers.unitActionRead({
                            groupName: baseCapGroupName,
                            isCrate: false,
                            dead: false
                        });
                        // console.log("RESPAWNCAP: ", baseCapGroupName, capGroup.length);
                        // respawn convoy because it doesnt exist
                        await ddcsControllers.spawnCAPDefense(
                            baseCapGroupName,
                            base.side,
                            base,
                            aIConfig,
                            "C: A CAP Defense spawned at " + base._id
                        );
                    }
                }
            }
        } else {
            console.log(base._id + " Shelter does not exist, dont spawn convoys");
        }
    }
    return false;
}
