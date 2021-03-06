/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typing from "../../typings";
import * as ddcsControllers from "../";

export async function processAirbaseUpdates(airbaseObj: typing.IBasePayload): Promise<void> {
    if (airbaseObj.action === "airbaseC") {
        await ddcsControllers.airfieldDictionaryActionUpdate({
            ...airbaseObj.data
        });
    }
}
