import * as child_process from "node:child_process";
import * as readline from "node:readline";
import {Writable} from "node:stream";
import {TypedEventEmitter} from "./typedEventEmitter";
import {ActivityEvent, GDBEvent, GDBEventMap, ResultEvent, StatusEvent, StreamEvent} from "./gdbEvents";

interface Options {
    spawn: child_process.SpawnOptions,
    gdbExecutable: string,
    exitHandler: () => {},
    debug: boolean
}

export class GDB {
    private readonly process: child_process.ChildProcess;
    private readonly stdout: readline.Interface;
    private readonly stdin: Writable;
    private readonly emitter: TypedEventEmitter<GDBEventMap>;

    constructor (target: string, args: string | string[] = [], options: Partial<Options>) {
        let fullOptions: Options = {
            spawn: {},
            gdbExecutable: "gdb",
            exitHandler: () => {
                process.exit();
            },
            debug: false,
            ...options
        };

        if (typeof args === "string") {
            args = args.split(" ");
        }
        args.unshift(target, "-i=mi3");

        this.process = child_process.spawn(
            fullOptions.gdbExecutable,
            args,
            {stdio: ["pipe", "pipe", "inherit"], ...options.spawn}
        );

        this.stdin = this.process.stdin!;
        if (fullOptions.debug) {
            this.process.stdout?.on("data", process.stdout.write);
        }
        this.stdout = readline.createInterface(this.process.stdout!);
        this.stdout.on("line", this.processLine);
        this.process.on("exit", fullOptions.exitHandler);

        this.emitter = new TypedEventEmitter();
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
                break;
            default:
                console.error("Encountered unknown record: " + line);
        }
    }

    private processResult (event: ResultEvent) {

    }

    private processStatus (event: StatusEvent) {

    }

    private processStream (event: StreamEvent) {

    }

    private processActivity (event: ActivityEvent) {

    }


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

        // register return to stack
    }
    public ex = this.execute;

    public async collect_execute (command: string) {
        this.writeCommand(command);

        // register
        // enable collection mode
        // lock stack until done
    }
    public cex = this.collect_execute;

    // write content such as a process requesting from stdin
    public external_write (data: string) {
        this.writeCommand(data);
    }
}
