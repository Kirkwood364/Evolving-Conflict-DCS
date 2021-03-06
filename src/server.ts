import * as bodyParser from "body-parser";
import * as controllers from "./webControllers";
import * as cors from "cors";
import { Server } from "@overnightjs/core";
import { Logger } from "@overnightjs/logger";
import * as express from "express";
import * as ddcsControllers from "./controllers";

class DDCSServer extends Server {

    private readonly SERVER_START_MSG = "DDCS server started on port: ";

    constructor() {
        super(true);
        // this.app.use(bodyParser.json());
        // this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(cors());
        this.app.disable("x-powered-by");
        this.app.use("/", express.static(__dirname + "/"));
        this.app.use("/json", express.static(__dirname + "/../app/assets/json"));
        this.app.use("/css", express.static(__dirname + "/../app/assets/css"));
        this.app.use("/fonts", express.static(__dirname + "/../app/assets/fonts"));
        this.app.use("/imgs", express.static(__dirname + "/../app/assets/images"));
        this.app.use("/tabs", express.static(__dirname + "/../app/tabs"));
        this.app.use("/libs", express.static(__dirname + "/../node_modules"));
        this.app.use("/shh", express.static(__dirname + "/../shh"));
        this.setupControllers()
            .catch((err) => {
                console.log("Error setting up controllers: ", err);
            });
    }


    private async setupControllers(): Promise<void> {
        const ctlrInstances = [];

        await ddcsControllers.initV3EngineMaster()
            .then(async () => {})
            .catch((err) => {
                throw new Error("Engine Errors: " + err);
            });
        await ddcsControllers.discordDualChannelBotClient();

        for (const name in controllers) {
            if (controllers.hasOwnProperty(name)) {
                const controller = (controllers as any)[name];
                ctlrInstances.push(new controller());
            }
        }
        super.addControllers(ctlrInstances);
    }

    public start(port: number): void {
        const server = this.app.listen(port, () => {
            Logger.Imp(this.SERVER_START_MSG + port);
        });
        const io = require("socket.io")(server);

        io.on("connection", (socket: any) => {
            console.log(socket.id + " user Connected");

            socket.on("disconnect", () => {
                console.log(socket.id + " user disconnected");
            });
            socket.on("error", (err: any) => {
                if (err === "handshake error") {
                    console.log("handshake error", err);
                } else {
                    console.log("io error", err);
                }
            });
        });
    }
}

export default DDCSServer;
