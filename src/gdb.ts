import * as child_process from "node:child_process";
import * as readline from "node:readline";
import {Writable} from "node:stream";
import {
    ActivityEvent,
    GDBEvent, GDBEventMap,
    ResultEvent,
    ResultTypes,
    StatusEvent,
    StreamEvent,
    StreamMappingTable,
    StreamTypes
} from "./gdbEvents.js";
import {TypedEventEmitter} from "./typedEventEmitter.js";

interface Options {
    spawn: child_process.SpawnOptions,
    gdbExecutable: string,
    exitHandler: () => never,
    debug: boolean,
    readyCallback: () => any
}

export class GDB {
    private readonly process: child_process.ChildProcess;
    private readonly stdout: readline.Interface;
    private readonly stdin: Writable;
    private readonly emitter: TypedEventEmitter<GDBEventMap>;

    private collecting: boolean = false;
    private collector: string[][] = [];
    private collectingProcessOut: boolean = false;
    private processOutCollector: string[] = [];

    private stack: [(event: ResultEvent | StatusEvent) => any, (reason: string) => any][] = [];  // resolve, reject

    private ready: boolean = false;
    private readonly readyCallback: () => any;

    constructor (target: string, args: string | string[] = [], options: Partial<Options> = {}) {
        let fullOptions: Options = {
            spawn: {},
            gdbExecutable: "gdb",
            exitHandler: () => {
                process.exit();
            },
            debug: false,
            readyCallback: () => {},
            ...options
        };
        this.readyCallback = fullOptions.readyCallback;

        if (typeof args === "string") {
            args = args.split(" ");
        }
        args.unshift(target, "-i=mi3");

        this.process = child_process.spawn(
            fullOptions.gdbExecutable,
            args,
            {stdio: ["pipe", "pipe", "inherit"], ...options.spawn}
        );

        this.emitter = new TypedEventEmitter<GDBEventMap>();
        this.stdin = this.process.stdin!;
        this.stdout = readline.createInterface(this.process.stdout!);
        if (fullOptions.debug) {
            this.stdout.on("line", console.log);
        }
        this.stdout.on("line", this.processLine.bind(this));
        this.process.on("exit", fullOptions.exitHandler);
    }

    public get gdbProcess () {
        return this.process;
    }

    public get events () {
        return this.emitter;
    }

    public exit (): never {
        this.process.kill();
        process.exit();
    }


    // ---------------------------------- command processing

    private processLine (line: string) {
        const parts = line.slice(1).match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)!;
        let event: GDBEvent<any>;

        switch (line[0]) {
            case "^":
                event = new ResultEvent(parts);
                this.emitter.emit("result", event);
                this.processResult(event);
                break;

            case "*":
                event = new StatusEvent(parts);
                this.emitter.emit("status", event);
                this.processStatus(event);
                break;

            case "~":
            case "&":
            case "@":
                parts.unshift(StreamMappingTable[line[0]]);
                event = new StreamEvent(parts);
                this.emitter.emit("stream", event);
                this.processStream(event);
                break;

            case "=":
                event = new ActivityEvent(parts);
                this.emitter.emit("activity", event);
                this.processActivity(event);
                break;

            case "(":
                if (this.ready) return;

                this.ready = true;
                this.emitter.emit("ready");
                this.readyCallback();
                return;

            default:
                this.emitter.emit("other", line);
                if (this.collectingProcessOut) {
                    this.processOutCollector.push(line);
                }
                return;
        }

        this.emitter.emit("any", event);
    }

    private notifyCaller (event: ResultEvent | StatusEvent) {
        if (this.collectingProcessOut) {
            event.other = structuredClone(this.processOutCollector);
            this.processOutCollector = [];
            this.collectingProcessOut = false;
        }
        this.stack.pop()![0](event);
    }

    private processResult (event: ResultEvent) {
        // note: running is deprecated
        if (event.eventType === ResultTypes.EXIT || event.eventType === ResultTypes.RUNNING) {
            return;
        }

        if (this.stack.length === 0) {
            return;
        }

        if (event.eventType === ResultTypes.ERROR) {
            this.stack.pop()![1](event.data.join(" // "));
            return;
        }

        this.notifyCaller(event);
    }

    private processStatus (event: StatusEvent) {
        if (this.stack.length === 0) {
            return;
        }

        this.notifyCaller(event);
    }

    private processStream (event: StreamEvent) {
        if (this.collecting && event.eventType === StreamTypes.CONSOLE) {
            this.collector.push(event.data);
        }
    }

    private processActivity (event: ActivityEvent) {}


    // ---------------------------------- execution interface

    private writeCommand (command: string) {
        if (command.endsWith("\n")) {
            this.stdin.write(command);
        } else {
            this.stdin.write(command + "\n");
        }
    }

    public async execute (command: string, collectProcessOut: boolean = false) {
        this.collectingProcessOut = collectProcessOut;
        this.writeCommand(command);

        return new Promise<ResultEvent | StatusEvent>((resolve, reject) => this.stack.push([resolve, reject]));
    }
    public ex = this.execute;

    public async collect_execute (command: string, collectProcessOut: boolean = false) {
        if (this.collecting) return Promise.reject("Another collection command is active");

        this.collecting = true;
        this.collectingProcessOut = collectProcessOut;
        this.writeCommand(command);

        return new Promise<[ResultEvent | StatusEvent, string[][]]>((resolve, reject) => {
            this.stack.push([
                (event) => {
                    this.collecting = false;
                    let cpy = structuredClone(this.collector);
                    this.collector = [];

                    resolve([event, cpy]);
                },
                (reason) => {
                    this.collecting = false;
                    this.collector = [];

                    reject(reason);
                }
            ]);
        })
    }
    public exc = this.collect_execute;

    public async next_stop (collectProcessOut: boolean = false) {
        this.collectingProcessOut = collectProcessOut;
        return new Promise<ResultEvent | StatusEvent>((resolve, reject) => this.stack.push([resolve, reject]));
    }
    public ns = this.next_stop;

    // write raw content such as a process requesting from stdin
    public externalWrite (data: string) {
        this.writeCommand(data);
    }
}
