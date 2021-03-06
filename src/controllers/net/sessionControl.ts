import * as ddcsController from "../";

let sessionName: string = "";
let curServerEpoc: number = 0;
let curAbsTime: number = 0;
let startAbsTime: number = 0;
let curServerCnt: number = 0;

export function getSessionName() {
    return sessionName;
}
export function getCurServerEpoc() {
    return curServerEpoc;
}
export function getCurAbsTime() {
    return curAbsTime;
}
export function getStartAbsTime() {
    return startAbsTime;
}
export function getCurServerCnt() {
    return curServerCnt;
}

export function setSessionName(curSessionName: string) {
    sessionName = curSessionName;
}
export function setCurServerEpoc(serverEpoc: number) {
    curServerEpoc = serverEpoc;
}
export function setCurAbsTime(absTime: number) {
    curAbsTime = absTime;
}
export function setStartAbsTime(curStartAbsTime: number) {
    startAbsTime = curStartAbsTime;
}
export function setCurServerCnt(serverCount: number) {
    curServerCnt = serverCount;
}

export async function getLatestSession(serverInfoObj: any): Promise<void> {
    if (serverInfoObj.epoc && serverInfoObj.startAbsTime && ddcsController.getEngineCache().campaign._id) {
        const buildSessionName = process.env.SERVER_NAME + "_" + ddcsController.getEngineCache().campaign._id + "_" + serverInfoObj.epoc;
        const latestSession = await ddcsController.sessionsActionsReadLatest();
        if ((buildSessionName !== latestSession._id || curAbsTime > serverInfoObj.curAbsTime)) {
            console.log(
                "create new session: ",
                buildSessionName,
                " !== ",
                (latestSession) ? latestSession._id : buildSessionName,
                " || ",
                getCurAbsTime(),
                " > ",
                serverInfoObj.curAbsTime
            );

            await ddcsController.resetMinutesPlayed();
            const campaign = await ddcsController.campaignsActionsReadLatest();
            if (!campaign || ddcsController.getEngineCache().config.resetFullCampaign) {
                console.log("buildNewCampaign: ", buildSessionName);
                await ddcsController.campaignsActionsSave({ _id: buildSessionName});
            }
            const newSession = {
                _id: buildSessionName,
                name: buildSessionName,
                startAbsTime: serverInfoObj.startAbsTime,
                curAbsTime: serverInfoObj.curAbsTime,
                campaignName: (campaign) ? campaign._id : buildSessionName
            };
            console.log("new session: ", newSession);

            await ddcsController.sessionsActionsUpdate(newSession);
            setSessionName(buildSessionName);

        } else {
            // console.log("use existing session: ", buildSessionName);
            await ddcsController.sessionsActionsUpdate({
                _id: buildSessionName,
                curAbsTime: serverInfoObj.curAbsTime
            });
            setSessionName(buildSessionName);
        }

        setCurServerEpoc(serverInfoObj.epoc);
        setCurAbsTime(serverInfoObj.curAbsTime);
        setStartAbsTime(serverInfoObj.startAbsTime);
        setCurServerCnt(serverInfoObj.serverCount);
    }
}
