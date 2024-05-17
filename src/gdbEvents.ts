
export class GDBEvent<T extends string = string> {
    public readonly eventType: T;
    public readonly data: string[];
    public other?: string[];

    constructor (parts: string[]) {
        [this.eventType, ...this.data] = parts as [T, ...string[]];
    }
}

export enum ResultTypes {
    DONE = "done",
    RUNNING = "running",
    CONNECTED = "connected",
    ERROR = "error",
    EXIT = "exit"
}

export class ResultEvent extends GDBEvent<ResultTypes> {}

export enum StatusTypes {
    RUNNING = "running",
    STOPPED = "stopped"
}

export class StatusEvent extends GDBEvent<StatusTypes> {}

export enum StreamTypes {
    CONSOLE = "console",
    TARGET = "target",
    INTERNAL = "internal"
}

export const StreamMappingTable: Record<string, StreamTypes> = {
    "~" : StreamTypes.CONSOLE,
    "@" : StreamTypes.TARGET,
    "&" : StreamTypes.INTERNAL
}

export class StreamEvent extends GDBEvent<StreamTypes> {}

export enum ActivityTypes {
    THREAD_GROUP_ADDED = "thread-group-added",
    THREAD_GROUP_REMOVED = "thread-group-removed",
    THREAD_GROUP_STARTED = "thread-group-started",
    THREAD_GROUP_EXITED = "thread-group-exited",
    THREAD_CREATED = "thread-created",
    THREAD_EXITED = "thread-exited",
    THREAD_SELECTED = "thread-selected",
    LIBRARY_LOADED = "library-loaded",
    LIBRARY_UNLOADED = "library-unloaded",
    TRACEFRAME_CHANGED = "traceframe-changed",
    TSV_CREATED = "tsv-created",
    TSV_DELETED = "tsv-deleted",
    TSV_MODIFIED = "tsv-modified",
    BREAKPOINT_CREATED = "breakpoint-created",
    BREAKPOINT_MODIFIED = "breakpoint-modified",
    BREAKPOINT_DELETED = "breakpoint-deleted",
    RECORD_STARTED = "record-started",
    RECORD_STOPPED = "record-stopped",
    CMD_PARAM_CHANGED = "cmd-param-changed",
    MEMORY_CHANGED = "memory-changed"
}

export class ActivityEvent extends GDBEvent<ActivityTypes> {}

export interface GDBEventMap extends Record<string | symbol, any[]> {
    result: [ResultEvent],
    status: [StatusEvent],
    stream: [StreamEvent],
    activity: [ActivityEvent],
    any: [GDBEvent],
    ready: [],
    processOut: [string]
}

