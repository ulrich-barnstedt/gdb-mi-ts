import {ActivityEvent, GDBEvent, ResultEvent, StatusEvent, StreamEvent} from "./gdbEvents.js";
import {EK, Listener, TypedEventEmitter} from "./typedEventEmitter.js";

export interface GDBEventMap extends Record<string | symbol, any[]> {
    result: [ResultEvent],
    status: [StatusEvent],
    stream: [StreamEvent],
    activity: [ActivityEvent],
    all: [GDBEvent],
    ready: [],
    other: [string]
}

export class GDBEventEmitter extends TypedEventEmitter<GDBEventMap> {
    private finalListeners: Record<EK<GDBEventMap>, Listener<GDBEventMap, EK<GDBEventMap>>> = {};

    public registerFinalListener <E extends EK<GDBEventMap>>(eventName: E, listener: Listener<GDBEventMap, E>) {
        this.finalListeners[eventName] = listener;
    }

    private wrapListener <E extends EK<GDBEventMap>>(eventName: E, listener: Listener<GDBEventMap, E>): Listener<GDBEventMap, E> {
        if (eventName === "ready" || eventName === "other") return listener;

        return (...args) => {
            if (args[0].isHandled) return;
            listener(...args);
        };
    }

    addListener<E extends EK<GDBEventMap>>(eventName: E, listener: Listener<GDBEventMap, E>): this {
        listener = this.wrapListener(eventName, listener);
        return super.addListener(eventName, listener);
    }

    on<E extends EK<GDBEventMap>>(eventName: E, listener: Listener<GDBEventMap, E>): this {
        listener = this.wrapListener(eventName, listener);
        return super.on(eventName, listener);
    }

    once<E extends EK<GDBEventMap>>(eventName: E, listener: Listener<GDBEventMap, E>): this {
        listener = this.wrapListener(eventName, listener);
        return super.once(eventName, listener);
    }

    prependListener<E extends EK<GDBEventMap>>(eventName: E, listener: Listener<GDBEventMap, E>): this {
        listener = this.wrapListener(eventName, listener);
        return super.prependListener(eventName, listener);
    }

    prependOnceListener<E extends EK<GDBEventMap>>(eventName: E, listener: Listener<GDBEventMap, E>): this {
        listener = this.wrapListener(eventName, listener);
        return super.prependOnceListener(eventName, listener);
    }

    emit <E extends EK<GDBEventMap>>(eventName: E, ...args: GDBEventMap[E]): boolean {
        let res = super.emit(eventName, ...args);

        if (eventName in this.finalListeners && !args[0].isHandled) {
            this.finalListeners[eventName](args[0]);
        }

        return res;
    }
}
