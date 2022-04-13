import * as ddcsControllers from "../";
import * as _ from "lodash";
import { ISrvPlayers } from "src/typings";
import { engineCache } from "../constants";

export async function grantKudos(curPly: ISrvPlayers, trgtPlayerName: string) {
        const giftingPlayer = await ddcsControllers.srvPlayerActionsRead({ucid: curPly.ucid});
        const curTime = new Date().getTime();
        const time1HAgo = curTime - ddcsControllers.time.oneHour;
        let lastKudosEpoch = time1HAgo;
        if (giftingPlayer[0].lastKudosTime) {
            lastKudosEpoch = giftingPlayer[0].lastKudosTime.getTime();
            console.log("Gifting Player has given Kudos previously @", giftingPlayer[0].lastKudosTime);
        }
        console.log("lastKudosEpoch:", lastKudosEpoch, " time1HAgo:", time1HAgo);
        if (lastKudosEpoch <= time1HAgo) {
            // Can give kudos
            console.log("updatedAt:", new Date().getTime() - ddcsControllers.time.oneMin);
            const giftedPlayer = await ddcsControllers.srvPlayerActionsRead({
                name: new RegExp(trgtPlayerName),
                $or : [ { slot : /forward/ },
                { slot : /artillery/} ]
            });
            if (giftedPlayer.length > 0 && giftedPlayer[0].name) {
                console.log(curPly.name + " has gifted player ", giftedPlayer[0].name + " through kudos");
            }
            if (giftedPlayer.length === 1) {
                if (giftingPlayer[0].ucid !== giftedPlayer[0].ucid) {
                    await ddcsControllers.addWarbonds(giftedPlayer[0], null, "kudos", engineCache.campaign.kudosAmount);
                    await ddcsControllers.sendMesgToPlayerChatWindow(
                        curPly.name + " kudos you for your efforts, as a result you have gained " + engineCache.campaign.kudosAmount + " Warbonds",
                        giftedPlayer[0].playerId
                    );
                    await ddcsControllers.sendMesgToPlayerChatWindow(
                        "You have sucessfully thanked " + trgtPlayerName,
                        curPly.playerId
                    );
                    console.log(trgtPlayerName, "has been gifted kudos");
                    await ddcsControllers.srvPlayerActionsUpdate({
                        _id: giftingPlayer[0]._id,
                        lastKudosTime: new Date().getTime()
                        }
                    );
                } else {
                    await ddcsControllers.sendMesgToPlayerChatWindow(
                        "Target Player:" + trgtPlayerName + "| Nice try! You cannot Kudos yourself",
                        curPly.playerId
                    );
                }

            } else if (giftedPlayer.length === 0) {
                await ddcsControllers.sendMesgToPlayerChatWindow(
                    "Target Player:" + trgtPlayerName + "| There is no player with a name similar to that in any JTAC/TacCom slots currently",
                    curPly.playerId
                );

                console.log(trgtPlayerName, "There is no player with a name similar to that in any JTAC/TacCom slots currently");
            } else {
                await ddcsControllers.sendMesgToPlayerChatWindow(
                    "Target Player:" + trgtPlayerName + "|Found multiple players with a name similar to that in any JTAC/TacCom slots currently, be more specific",
                    curPly.playerId
                );

                console.log(trgtPlayerName, "Found multiple players with a name similar to that in any JTAC/TacCom slots currently, be more specific");
            }
        } else {
            await ddcsControllers.sendMesgToPlayerChatWindow(
                "You have already given kudos to another player within the past hour, please wait " +
                Math.round((lastKudosEpoch - time1HAgo) / 1000) + " seconds",
                curPly.playerId
            );
            console.log(trgtPlayerName, "You have already given kudos to another player within the past hour, please wait");
        }
}

export async function restartIn(curRestartIn: number) {
    console.log("player restart in: ", curRestartIn);
}
