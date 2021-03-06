/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as ddcsControllers from "../";

export async function processOneHourActions(fullySynced: boolean) {
    await ddcsControllers.campaignStatusMessage();
    if (fullySynced) {
        await ddcsControllers.repairBaseSAMRadars();
    }
}
