/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as ddcsControllers from "../";
import {smokeBaseLosOnMob} from "../";

export async function processFiveMinuteActions(fullySynced: boolean): Promise<void> {
    await ddcsControllers.updateServerLifePoints();
    await ddcsControllers.recordFiveMinutesPlayed();
    if (fullySynced) {
        await ddcsControllers.checkBaseWarnings();
        // await ddcsControllers.baseDefenseDetectSmoke(); // smokes everything 5km from center of main base
        await ddcsControllers.smokeBaseLosOnMob(); // smokes 2-6 units that are true LOS now
        await ddcsControllers.checkForNeutralStrategicPoints(); // clear strat ownership is all buildings are dead
    }
}
