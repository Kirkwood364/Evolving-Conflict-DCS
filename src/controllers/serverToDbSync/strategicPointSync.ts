/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typing from "../../typings";
import * as ddcsControllers from "../";

export async function processStrategicPointUpdates(strategicPointObj: typing.IBasePayload): Promise<void> {
    console.log(": ", strategicPointObj);
    if (strategicPointObj.action === "strategicPointC") {
        for (const [key, value] of Object.entries(strategicPointObj.data)) {
            await ddcsControllers.strategicPointSave({
                ...value
            });
        }
    }
}
