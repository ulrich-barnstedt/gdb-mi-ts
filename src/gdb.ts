import * as child_process from "node:child_process";
import * as readline from "node:readline";
import {Writable} from "node:stream";
import {TypedEventEmitter} from "./typedEventEmitter.js";
import {
    ActivityEvent,
    GDBEvent,
    GDBEventMap,
    ResultEvent,
    ResultTypes,
    StatusEvent,
    StreamEvent,
    StreamMappingTable,
    StreamTypes
} from "./gdbEvents.js";
import {log} from "node:util";
import * as util from "node:util";

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
    private stack: [(event: ResultEvent) => any, (reason: string) => any][] = [];  // resolve, reject

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

        this.emitter = new TypedEventEmitter();
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

    private exit (code: number) : never {
        this.process.kill();
        process.exit(code);
    }


    // ---------------------------------- command processing

    private processLine (line: string) {
        const parts = line.slice(1).match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)!;
        let event: GDBEvent<any>;

        switch (line[0]) {
            case "^":
                event = new ResultEvent(parts);
                this.emitter.emit("result", event);
                if (event.isHandled) break;
                this.processResult(event);
                break;

            case "*":
                event = new StatusEvent(parts);
                this.emitter.emit("status", event);
                if (event.isHandled) break;
                this.processStatus(event);
                break;

            case "~":
            case "&":
            case "@":
                parts.unshift(StreamMappingTable[line[0]]);
                event = new StreamEvent(parts);
                this.emitter.emit("stream", event);
                if (event.isHandled) break;
                this.processStream(event);
                break;

            case "=":
                event = new ActivityEvent(parts);
                this.emitter.emit("activity", event);
                if (event.isHandled) break;
                this.processActivity(event);
                break;

            case "(":
                if (this.ready) return;

                this.ready = true;
                this.emitter.emit("ready");
                this.readyCallback();
                return;

            default:
                console.error("Encountered unknown record: " + line);
                return;
        }

        this.emitter.emit("all", event);
    }

    private processResult (event: ResultEvent) {
        if (event.eventType === ResultTypes.EXIT) {
            return;
        }

        if (this.stack.length === 0) {
            console.error("Received result for non-existent command");
            return;
        }

        if (event.eventType === ResultTypes.ERROR) {
            this.stack.pop()![1](event.data.join(" // "));
            return;
        }

        this.stack.pop()![0](event);
    }

    private processStatus (event: StatusEvent) {}

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

    public async execute (command: string) {
        this.writeCommand(command);
        return new Promise<ResultEvent>((resolve, reject) => this.stack.push([resolve, reject]));
    }
    public ex = this.execute;

    public async collect_execute (command: string) {
        if (this.collecting) return Promise.reject("Another collection command is active");

        this.writeCommand(command);
        this.collecting = true;

        return new Promise<[ResultEvent, string[][]]>((resolve, reject) => {
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

    // write raw content such as a process requesting from stdin
    public external_write (data: string) {
        this.writeCommand(data);
    }
}
