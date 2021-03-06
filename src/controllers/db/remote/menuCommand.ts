/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../../typings";
import { dbModels } from "../common";

export async function menuCommandsRead(filter: any): Promise<typings.IMenuCommand[]> {
    return new Promise((resolve, reject) => {
        dbModels.menuCommandModel.find(filter, (err: any, menuCommands: typings.IMenuCommand[]) => {
            if (err) { reject(err); }
            const sortedMenu = menuCommands.sort((a, b) => (a.sort > b.sort) ? 1 : -1);
            // console.log("SM: ", sortedMenu);
            resolve(sortedMenu);
        });
    });
}
