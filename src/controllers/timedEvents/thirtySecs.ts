/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../";

const aIMaxIdleTime = ddcsControllers.time.tenMinutes;
const maxCrateLife = (3 * 60 * 60 * 1000); // 3 hrs

export async function processThirtySecActions(fullySynced: boolean) {
    // const engineCache = ddcsControllers.getEngineCache();
    await ddcsControllers.unitActionRemoveAllDead();
    // await ddcsControllers.checkTimeToRestart(); // dont need this anymore
    await ddcsControllers.checkAircraftCosts();
    await ddcsControllers.checkAircraftWeaponCompliance();

    // auto gci broken, need to put more checks in before
    await ddcsControllers.getAllDetectedUnitsByNameArray();
    // auto GCI crashing hard leave off, when it finds a bad unit name

    await ddcsControllers.aliveJtac30SecCheck();

    // cleanupAI aIMaxIdleTime
    const aICleanup = await ddcsControllers.unitActionRead({isAI: true, dead: false});
    for (const aIUnit of aICleanup) {
        if (_.isEmpty(aIUnit.playername) && new Date(aIUnit.updatedAt).getTime() + aIMaxIdleTime < new Date().getTime()) {
            await ddcsControllers.destroyUnit( aIUnit.name, "unit" );
        }
    }

    const crateCleanup = await ddcsControllers.staticCrateActionReadStd({});
    for (const crate of crateCleanup) {
        if (new Date(crate.createdAt).getTime() + maxCrateLife < new Date().getTime()) {
            await ddcsControllers.staticCrateActionDelete({_id: crate._id});
            console.log("cleanup crate: ", crate.name);
            await ddcsControllers.destroyUnit( crate.name, "static" );
        }
    }

    ddcsControllers.jobArrayCleanup();
    const knownFlags = await ddcsControllers.flagsActionRead({});
    for (const flag of knownFlags) {
        // console.log("Getting Flag Value for _ID:", flag._id);
        await ddcsControllers.sendUDPPacket("frontEnd", {
            actionObj: {
                action: "getFlagValue",
                flagID: flag._id,
                reqID: 0
            }
        });
    }

    if (fullySynced) {
        await ddcsControllers.checkCmdCenters();
    }
}
