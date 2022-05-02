/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../../typings";
import { dbModels } from "../common";

export async function weatherRead(obj: any): Promise<typings.IWeather[]> {
    return new Promise((resolve, reject) => {
        dbModels.weatherModel.find(obj, (err: any, weathers: typings.IWeather[]) => {
            if (err) { reject(err); }
            resolve(weathers);
        }).catch((err: any) => {
            console.log("ERR: ", err);
        });
    });
}
