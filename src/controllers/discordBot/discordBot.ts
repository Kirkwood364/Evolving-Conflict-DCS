/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../";
import {campaignsActionsReadLatest, escapeRegExp} from "../";

// tslint:disable-next-line:no-var-requires variable-name
const Discord = require("discord.js");

const dBot: any = {};

export async function sendMessageToDiscord(MSG: string) {
    const engineCache = ddcsControllers.getEngineCache();
    // console.log("engCache: ", engineCache.config);
    const webHookURL = engineCache.config.discordWebHookURL;
    if (webHookURL) {
        const request = require("request");
        const today = new Date();
        const time = today.getUTCHours() + ":" + today.getUTCMinutes() + ":" + today.getUTCSeconds();
        const options = {
            method: "POST",
            url: webHookURL,
            headers: {
                "Content-Type": "application/json",
                "Cookie": "__dcfduid=2c634e490bef11ec8f2e42010a0a051e; __sdcfduid=2c634e490bef11ec8f2e42010a0a051e0669c9af189f129d4f3434040e29b3b15f6c37206fd8b1473c26474961022577; __cfruid=de531a260997a81c9a4baa383f422a3888a8faa4-1630588241"
            },
            body: JSON.stringify({content: "[" + time + " UTC]:" + MSG + ""})

        };

        request(options, (error: any, response: any) => {
            if (error) {
                console.log("webHook Error: ", error);
                // throw new Error(error);
            }
            console.log(response.body);
        });
    } else {
        console.log("Discord Webhook is disabled: ", webHookURL, MSG);
    }
}

export async function sendDCSLogFileToDiscord() {
    const engineCache = ddcsControllers.getEngineCache();
    const webHookURL = engineCache.config.discordWebHookURL;
    if (webHookURL) {
        const fs = require("fs");
        const request = require("request");
        const options = {
            method: "POST",
            url: webHookURL,
            headers: {
                "Content-Type": "multipart/form-data",
                "Cookie": "__dcfduid=2c634e490bef11ec8f2e42010a0a051e; __sdcfduid=2c634e490bef11ec8f2e42010a0a051e0669c9af189f129d4f3434040e29b3b15f6c37206fd8b1473c26474961022577; __cfruid=de531a260997a81c9a4baa383f422a3888a8faa4-1630588241"
            },
            formData: {
                file1: fs.createReadStream(engineCache.config.DCSLogFileLocation),
                payload_json: JSON.stringify({})
            }

        };
        // tslint:disable-next-line:only-arrow-functions
        request(options, function(error: any, response: any) {
            if (error) {
                throw new Error(error);
            }
            console.log(response.body);
        });
    } else {
        console.log("Discord Webhook is disabled: ", webHookURL);
    }
}

export async function campaignStatusMessage() {
    const campaignStats = await ddcsControllers.campaignsActionsReadLatest();
    const registeredRedPlayers = await ddcsControllers.srvPlayerActionsRead({sideLock: 1});
    const registeredBluePlayers = await ddcsControllers.srvPlayerActionsRead({sideLock: 2});
    const redMobs = await ddcsControllers.campaignAirfieldActionRead({baseType: "MOB", side: 1, enabled: true});
    const blueMobs = await ddcsControllers.campaignAirfieldActionRead({baseType: "MOB", side: 2, enabled: true});
    const latestSession = await ddcsControllers.sessionsActionsReadLatest();
    const unitsNewThan = new Date().getTime() - ddcsControllers.time.fourMins;
    const redplayerArray = await ddcsControllers.srvPlayerActionsRead({
        sessionName: latestSession._id,
        side: 1,
        updatedAt: {$gt: unitsNewThan}
    });
    const blueplayerArray = await ddcsControllers.srvPlayerActionsRead({
        sessionName: latestSession._id,
        side: 2,
        updatedAt: {$gt: unitsNewThan}
    });
    let discordMessage = "__**Current Campaign Hourly Stats**__\n";
    discordMessage = discordMessage + "**:red_circle: Red Minutes Played: **" + campaignStats.totalMinutesPlayed_red + "** | :blue_circle: Blue Minutes Played:**" + campaignStats.totalMinutesPlayed_blue + "\n";
    discordMessage = discordMessage + "**:red_circle: Red Registered Players: **" + registeredRedPlayers.length + "** | :blue_circle: Blue Registered Players: **" + registeredBluePlayers.length + "\n";
    discordMessage = discordMessage + "\n**:red_circle: Red Controlled Mob's: **\n";
    for (const mob of redMobs) {
        discordMessage = discordMessage + mob._id + "\n";
    }
    discordMessage = discordMessage + "**:blue_circle: Blue Controlled Mob's: **\n";
    for (const mob of blueMobs) {
        discordMessage = discordMessage + mob._id + "\n";
    }
    discordMessage = discordMessage + "\n**:red_circle: Red Players Online: **\n";
    for (const player of redplayerArray) {
        discordMessage = discordMessage + player.name + "\n";
    }
    discordMessage = discordMessage + "**:blue_circle: Blue Players Online: **\n";
    for (const player of blueplayerArray) {
        discordMessage = discordMessage + player.name + "\n";
    }
    await sendMessageToDiscord(discordMessage);
}

export function getName(vcUser: any) {
    if (vcUser.nickname) {
        return vcUser.nickname;
    }
    return vcUser.user.username;
}

export async function setDiscordOnlineStatus(onlineStatus: boolean) {
    console.log("firing set discord");
    const srvs = await ddcsControllers.serverActionsRead({enabled: true});
    for (const srv of srvs) {
        const curServerName = srv._id;
        console.log("update server: " + curServerName + " " + onlineStatus);
        await ddcsControllers.serverActionsUpdate({
            name: curServerName,
            isDiscordOnline: onlineStatus
        });
    }
}

export function clientLogin(cObj: any, token: string) {
    cObj.login(token)
        .then(() => {
            console.log("Client login successful");
        })
        .catch(() => {
            console.log("Client login failure");
            setTimeout(() => {
                exports.clientLogin(cObj, token);
            }, 5 + 1000);
        });
}

dBot.clientLogin = (cObj: { login: (arg0: any) => Promise<any>; }, token: string) => {
    cObj.login(token)
        .then(() => {
            console.log("Client login successful");
        })
        .catch(() => {
            console.log("Client login failure");
            setTimeout(() => {
                dBot.clientLogin(cObj, token);
            }, 5 + 1000);
        });
};

export async function discordDualChannelBotClient() {
    const client = new Discord.Client(
        {intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS", "GUILD_PRESENCES", "GUILD_VOICE_STATES"]});
    dBot.clientLogin(client, process.env.DISCORDBOTTOKEN);
    client.on("resume", async () => {
        console.log("socket resumes");
        await ddcsControllers.setDiscordOnlineStatus(true);
    });
    client.on("disconnect", async () => {
        console.error("Connection lost...");
        await ddcsControllers.setDiscordOnlineStatus(false);
    });
    client.on("reconnecting", async () => {
        console.log("Attempting to reconnect...");
        await ddcsControllers.setDiscordOnlineStatus(false);
    });
    client.on("error", (error: { message: any; }) => {
        console.error(error.message);
    });
    client.on("warn", (info: { message: any; }) => {
        console.error(info.message);
    });
    client.on("ready", async (input: RequestInfo, init?: RequestInit) => {
        console.log("Ready!");
        await ddcsControllers.setDiscordOnlineStatus(true);
        dBot.counter = 0;
        setInterval(async () => {
            const discordCurrentOnlineVoice: any = {};
            const curGuild = client.guilds.cache.get("389682718033707008");
            const voiceChans = curGuild.channels.cache.filter((ch: any) => ch.type === "GUILD_VOICE");
            voiceChans.forEach((voiceChan: any) => {
                if (voiceChan.name !== "AFK") {
                    voiceChan.members.forEach((vcUser: any) => {
                        // if (vcUser.user.username === "Drex") {
                        //    console.log("Channel", voiceChan.name, "nick: ", vcUser.nickname, "mainUsername: ",
                        //        vcUser.user.username, voiceChan.name);
                        // }
                        discordCurrentOnlineVoice[vcUser.user.username + "#" + vcUser.user.discriminator] = {
                            ...vcUser.user,
                            nickName: vcUser.nickname,
                            currentChannel: voiceChan.name
                        };
                    });
                }
            });
            await ddcsControllers.serverActionsUpdate({_id: process.env.SERVER_NAME, discordCurrentOnlineVoice});

            // update users patreon levels, with Contributor in the name
            const patreonLvl: any = {};
            const currentMembers = await Promise.all(curGuild.roles.cache.filter((rn: { name: string; }) => /Contributor$/i.test(rn.name)));
            // console.log("CMM: ", currentMembers);
            for (const key of Object.keys(currentMembers)) {
                // @ts-ignore
                const curRole = currentMembers[key][1];
                // console.log("RN: ", curRole.name);
                if (!patreonLvl[curRole.name]) {
                    patreonLvl[curRole.name] = [];
                }
                // @ts-ignore
                for (const member of curRole.members) {
                    // console.log("member: ", member[1]);
                    patreonLvl[curRole.name].push(member[1].user.username);
                    if (member.nickname) {
                        patreonLvl[curRole.name].push(member[1].nickname);
                    }
                }
            }
            // console.log("PL: ", patreonLvl);
            await ddcsControllers.serverActionsUpdate({_id: process.env.SERVER_NAME, patreonLvl});
        }, 5 * 1000);
        client.on("messageCreate", async (message: {
            content: string; channel: { send: (arg0: string) => void; }; }) => {
            console.log(message.content);

            if (message.content === "!patreon") {
                message.channel.send("https://www.patreon.com/dynamicdcs");
            }
            if (message.content === "!paypal") {
                message.channel.send("https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=HSRWLCYNXQB4N");
            }
            if (/trees/i.test(message.content)) {
                message.channel.send("Please let Eagle Dynamics know about how we need this setting: https://forum.dcs.world/topic/174210-server-setting-to-force-customized-tree-setting/");
            }
            if (/stack/i.test(message.content)) {
                message.channel.send("Join the side you want to play, dont worry about the amount of players on a side, the underdogs are well compensated with MUCH more warbonds and autoGCI");
            }
        });
    });
}
