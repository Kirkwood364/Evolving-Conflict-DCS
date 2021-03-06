/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as typings from "../../typings";
import * as ddcsControllers from "../";
import {forcePlayerSpectator, getRTPlayerArray} from "../";

const dBot = {};
const srsServers = {
    // DDCSStandard: "srs.dynamicdcs.com:5002",
    DDCS1978ColdWar: "srs.dynamicdcs.com:5002",
    DDCSModern: "srs.dynamicdcs.com:5010"
};

export function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export async function kickToSpectatorForNoCommJtac() {
    const curPlayers: any = ddcsControllers.getRTPlayerArray();
    const serverSettings = await ddcsControllers.serverActionsRead({_id: process.env.SERVER_NAME});
    if (serverSettings.length > 0) {
        for (const player of curPlayers) {
            if (/^artillery_commander/.test(player.slot) || /^forward_observer/.test(player.slot)) {
                // console.log("player in tac/JTAC/FORWARD: ", player.name, player.slot);
                let isPlayerInComms: boolean = false;
                let currentName: string = "";
                let currentNick: string = "";
                for (const [playerKey, playerObj] of Object.entries(serverSettings[0].discordCurrentOnlineVoice)) {
                    currentName = player.name;
                    const curPlayerName = new RegExp(escapeRegExp(player.name), "gi");
                    // @ts-ignore
                    if (playerObj.username && curPlayerName.test(playerObj.username)) {
                        isPlayerInComms = true;
                        currentName = player.name;
                    }
                    // @ts-ignore
                    if (!isPlayerInComms && playerObj.nickName && curPlayerName.test(playerObj.nickName)) {
                        isPlayerInComms = true;
                        // @ts-ignore
                        currentNick = playerObj.nickName;
                    }
                }
                if (!isPlayerInComms) {
                    const curPlayerAccount = await ddcsControllers.srvPlayerActionsRead({name: player.name});
                    if (curPlayerAccount.length > 0) {
                        if (!curPlayerAccount[0].isGameMaster) {
                            console.log("Player is not in comms: ", player.name, currentName, currentNick);
                            await ddcsControllers.forcePlayerSpectator(
                                player.id,
                                "You must be in a discord voice channel and your name in discord has to match your name in game to occupy JTAC/Operator or Tactical cmdr slots"
                            );
                        }
                    }
                }
            }
        }
    }
}

export const oldestAllowedUser = 300;
export const timeToCorrect = 15;
export const only0ChannelNames = [
    "Please join side before joining GCI"
];
export const only1ChannelNames = [
    "Red Gen Chat(Relaxed GCI)",
    "Red GCI Group 1(Brevity)",
    "Red GCI Group 2(Brevity)"
];
export const only2ChannelNames = [
    "Blue Gen Chat(Relaxed GCI)",
    "Blue GCI Group 1(Brevity)",
    "Blue GCI Group 2(Brevity)"
];

export async function resetKickTimer(curPlayer: typings.ISrvPlayers): Promise<void> {
    const curPlayerDB = await ddcsControllers.srvPlayerActionsRead({ _id: curPlayer.ucid });
    await ddcsControllers.srvPlayerActionsUnsetGicTimeLeft({_id: curPlayerDB[0].ucid });
}

export async function processKick(
    curPlayer: typings.ISrvPlayers,
    playerCommObj: typings.IRemoteComms,
    isDiscordAllowed: boolean,
    curPlayerUnit: typings.IUnit,
    discordOnline: boolean
): Promise<void> {
    const curPlayerDB = await ddcsControllers.srvPlayerActionsRead({ _id: curPlayer.ucid });
    let mesg: string;
    const curPlayerName = curPlayer.name;
    const curGicTimeLeft = curPlayerDB[0].gicTimeLeft;
    const newLifeCount = (curGicTimeLeft === 0) ? timeToCorrect : curGicTimeLeft - 1 ;

    if (newLifeCount !== 0) {
        if (!playerCommObj && isDiscordAllowed) {
            mesg = "REQUIREMENT(" + newLifeCount + " mins left):You are not a member of the DDCS discord(with your name matching " +
                "EXACTLY) and also you need to be in a VOICE discord channel(Not AFK)(Status is online(not invisi)) OR connected " +
                "to the correct SRS server (#serverName) https://discord.gg/h4G9QZf ";
            console.log("GTBK: ", newLifeCount, curPlayerName, " Not A Member, discordOnline: " + discordOnline);
        } else if (!playerCommObj)  {
            mesg = "REQUIREMENT(" + newLifeCount + " mins left):You are not a member of the DDCS discord(with your name matching " +
                "EXACTLY), & also need to be connected to the correct SRS server ( #serverName ) https://discord.gg/h4G9QZf ";
            console.log("GTBK: ", newLifeCount, curPlayerName, " Not A Member, discordOnline: " + discordOnline);
        } else if (isDiscordAllowed) {
            mesg = "REQUIREMENT(" + newLifeCount + " mins left):You need to be in a VOICE discord channel(Not AFK)(Status is " +
                "online(not invisi)) OR connected to the correct SRS server ( #serverName ), https://discord.gg/h4G9QZf ";
            console.log("GTBK: ", newLifeCount, curPlayerName, " Not In Discord Or SRS, discordOnline: " + discordOnline);
            /* } else if (serverName !== _.get(playerCommObj, 'SRSData.SRSServer')) {
                mesg = "REQUIREMENT(" + newLifeCount + " mins left):You must join the correct SRS server ( #serverName )";
                console.log('GTBK: ', newLifeCount, curPlayerName, ' Not In the correct SRS, discordOnline: ' + discordOnline); */
        } else {
            mesg = "REQUIREMENT(" + newLifeCount + " mins left):You must join the correct SRS server ( #serverName )";
            console.log("GTBK: ", newLifeCount, curPlayerName, " Not In SRS, discordOnline: " + discordOnline);
        }
        if (curPlayerUnit) {
            await ddcsControllers.sendMesgToGroup(curPlayer, curPlayerUnit.groupId, mesg, 60);
        }
        await ddcsControllers.srvPlayerActionsUpdate({_id: curPlayer.ucid, gicTimeLeft: newLifeCount});
    } else {
        if (!playerCommObj && isDiscordAllowed) {
            mesg = "KICKED: You are not a member of the DDCS discord(with your name matching EXACTLY) and also you need to be in " +
                "a VOICE discord channel(Not AFK)(Status is online(not invisi)) OR connected to the correct SRS server " +
                "( #serverName ) https://discord.gg/h4G9QZf ";
            console.log("KICKING: ", curPlayerName, "Not A Member, discordOnline: " + discordOnline);
        } else if (!playerCommObj)  {
            mesg = "KICKED:You are not a member of the DDCS discord(with your name matching EXACTLY), & also need to be connected" +
                " to the correct SRS server ( #serverName ) https://discord.gg/h4G9QZf ";
            console.log("KICKING: ", curPlayerName, "Not A Member, discordOnline: " + discordOnline);
        } else if (isDiscordAllowed) {
            mesg = "KICKED: You need to be in a VOICE discord channel(Not AFK)(Status is online(not invisi)) OR connected to the " +
                "SRS correct server ( #serverName ), https://discord.gg/h4G9QZf ";
            console.log("KICKING: ", curPlayerName, "Not In Discord OR SRS, discordOnline: " + discordOnline);
            /* } else if (serverName !== _.get(playerCommObj, 'SRSData.SRSServer')) {
                mesg = "KICKED: You must join the correct SRS server (" + _.get(srsServers, [serverName]) + ")";
                console.log('KICKING: ', curPlayerName, 'Not In the correct SRS, discordOnline: ' + discordOnline); */
        } else {
            mesg = "KICKED: You must join the correct SRS server ( #serverName )";
            console.log("KICKING: ", curPlayerName, "Not In SRS, discordOnline: " + discordOnline);
        }
        await ddcsControllers.srvPlayerActionsUpdate({_id: curPlayer.ucid, gicTimeLeft: newLifeCount});
        if (curPlayerUnit) {
            console.log("KICKED FOR NO COMMS: ", curPlayerUnit.playername, curPlayer.playerId);
            await ddcsControllers.sendMesgToGroup(curPlayer, curPlayerUnit.groupId, mesg, 60);
        }
        await ddcsControllers.forcePlayerSpectator(curPlayer.playerId, mesg);
    }
}

export async function kickForNoComms(playerArray: typings.ISrvPlayers[], isDiscordAllowed: boolean): Promise<void> {
    const playersInComms = await ddcsControllers.remoteCommsActionsRead({});
    console.log("-------------------------------");
    for (const curPlayer of playerArray) {
        const curPlayerName = curPlayer.name;
        const curPlayerCommObj = _.find(playersInComms, {_id: curPlayerName});
        ddcsControllers.unitActionRead({dead: false, playername: curPlayerName})
            .then((pUnit: any) => {
                /*
                const curPlayerUnit = pUnit[0];
                if (curPlayerCommObj) {
                    if (curPlayerUnit) {
                        curPlayerCommObj.playerType = "unit";
                    } else if (_.includes(curPlayer.slot, "artillery_commander")) {
                        curPlayerCommObj.playerType = "jtac";
                    }  else if (_.includes(curPlayer.slot, "")) {
                        curPlayerCommObj.playerType = "spectator";
                    }

                    if (!((curPlayerCommObj.isInSRS && serverName === _.get(curPlayerCommObj, 'SRSData.SRSServer')) ||
                        (curPlayerCommObj.isInDiscord && isDiscordAllowed))) {
                        constants.getServer(serverName)
                            .then(function (serverConf) {
                                let isDiscordOnline = _.get(serverConf, 'isDiscordOnline');
                                if (isDiscordOnline) {
                                    dBot.processKick(
                                        serverName,
                                        curPlayer,
                                        curPlayerCommObj,
                                        isDiscordAllowed,
                                        curPlayerUnit,
                                        isDiscordOnline
                                    );
                                }
                            })
                            .catch(function (err) {
                                reject('line:542, failed to connect to db: ', serverName, err);
                            })
                        ;
                    } else {
                        //reset gic timer for matching
                        dBot.resetKickTimer(serverName, curPlayer)
                    }
                } else {
                    constants.getServer(serverName)
                        .then(function (serverConf) {
                            let isDiscordOnline = _.get(serverConf, 'isDiscordOnline');
                            if (isDiscordOnline) {
                                dBot.processKick(
                                    serverName,
                                    curPlayer,
                                    curPlayerCommObj,
                                    isDiscordAllowed,
                                    curPlayerUnit,
                                    isDiscordOnline
                                );
                            }
                        })
                        .catch(function (err) {
                            reject('line:542, failed to connect to db: ', serverName, err);
                        })
                    ;
                }
                */
            })
            .catch((err) => {
                console.log("line37", err);
            });
    }
}

/*
_.set(dBot, 'kickForOpposingSides', function (playerArray, discordByChannel) {
    var moveToChan;
    _.forEach(exports.Only1ChannelNames, function (chanName) {
        if(discordByChannel[chanName]) {
            _.forEach(discordByChannel[chanName], function (vcUser, userName) {
                var findCurPlayer = _.find(playerArray, {name: userName});
                if(findCurPlayer) {
                    if (findCurPlayer.side === 0) {
                        console.log('kick user to gen: ', userName);
                        moveToChan = client.channels.find("name", _.first(exports.only0ChannelNames));
                        vcUser.setVoiceChannel(moveToChan);
                    } else if (findCurPlayer.side !== 1) {
                        console.log('kick user for wrong side GCI: ', userName);
                        moveToChan = client.channels.find("name", _.first(exports.Only2ChannelNames));
                        vcUser.setVoiceChannel(moveToChan);
                    }
                }
            });
        }
    });
    _.forEach(exports.Only2ChannelNames, function (chanName) {
        if(discordByChannel[chanName]) {
            _.forEach(discordByChannel[chanName], function (vcUser, userName) {
                var findCurPlayer = _.find(playerArray, {name: userName});
                if(findCurPlayer) {
                    if (findCurPlayer.side === 0) {
                        console.log('kick user to gen: ', userName);
                        moveToChan = client.channels.find("name", _.first(exports.only0ChannelNames));
                        vcUser.setVoiceChannel(moveToChan);
                    } else if (findCurPlayer.side !== 2) {
                        console.log('kick user for wrong side GCI: ', userName);
                        moveToChan = client.channels.find("name", _.first(exports.Only1ChannelNames));
                        vcUser.setVoiceChannel(moveToChan);
                    }
                }
            });
        }
    });
});
*/

export async function checkForComms(isDiscordAllowed: boolean, playerArray: typings.ISrvPlayers[]): Promise<void> {
    // console.log('PA: ', playerArray);
    /* Turn OFf Comms
    var removeServerHost = _.filter(playerArray, function (p) {
        if (p) {
            return p.id != 1;
        }
        return false;
    });
    dBot.kickForNoComms(serverName, removeServerHost, isDiscordAllowed);
 */
    /*
    var fiveMinsAgo = new Date().getTime() - (5 * oneMin);
    masterDBController.sessionsActions('readLatest', serverName, {})
        .then(function (latestSession) {
            if (latestSession.name) {
                masterDBController.srvPlayerActions('read', serverName, {
                    playerId: {$ne: '1'},
                    name: {$ne: ''},
                    sessionName: latestSession.name,
                    updatedAt: {
                        $gt: new Date(fiveMinsAgo)
                    }
                })
                    .then(function (playerArray) {
                        console.log('PA: ', playerArray.length, fiveMinsAgo, new Date().getTime(), new Date().getTime() - fiveMinsAgo, {
                            playerId: {$ne: '1'},
                            name: {$ne: ''},
                            sessionName: latestSession.name,
                            updatedAt: {
                                $gt: new Date(fiveMinsAgo)
                            }});
                        dBot.kickForNoComms(serverName, playerArray, isDiscordAllowed);
                        // have all the existing player names on the server
                        // dBot.kickForOpposingSides(playerArray, discordByChannel); for the future
                    })
                    .catch(function (err) {
                        console.log('line181', err);
                    })
                ;
            }
        })
        .catch(function (err) {
            console.log('line187', err);
        })
    ;
    */
}
