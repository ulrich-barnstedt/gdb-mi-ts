import EventEmitter from "node:events";

export type KeyType = string | symbol;
export type EK<T> = Extract<keyof T, KeyType>;
export type EventMap = Record<KeyType, any[]>;
export type Listener<T extends EventMap, E extends EK<T>> = (...args: T[E]) => any;

export class TypedEventEmitter <T extends EventMap> extends EventEmitter {
    addListener<E extends EK<T>>(eventName: E, listener: Listener<T, E>): this {
        return super.addListener(eventName, listener);
    }

    on<E extends EK<T>>(eventName: E, listener: Listener<T, E>): this {
        return super.on(eventName, listener);
    }

    once<E extends EK<T>>(eventName: E, listener: Listener<T, E>): this {
        return super.once(eventName, listener);
    }

    removeListener<E extends EK<T>>(eventName: E, listener: Listener<T, E>): this {
        return super.removeListener(eventName, listener);
    }

    off <E extends EK<T>>(eventName: E, listener: Listener<T, E>): this {
        return super.off(eventName, listener);
    }

    removeAllListeners <E extends EK<T>>(eventName?: E): this {
        return super.removeAllListeners(eventName);
    }

    listeners <E extends EK<T>>(eventName: E): Array<Listener<T, E>> {
        return super.listeners(eventName) as Array<Listener<T, E>>;
    }

    rawListeners <E extends EK<T>>(eventName: E): Array<Listener<T, E>> {
        return super.rawListeners(eventName) as Array<Listener<T, E>>;
    }

    emit <E extends EK<T>>(eventName: E, ...args: T[E]): boolean {
        return super.emit(eventName, ...args);
    }

    listenerCount <E extends EK<T>>(eventName: E, listener?: Listener<T, E>): number {
        return super.listenerCount(eventName, listener);
    }

    prependListener <E extends EK<T>>(eventName: E, listener: Listener<T, E>): this {
        return super.prependListener(eventName, listener);
    }

    prependOnceListener <E extends EK<T>>(eventName: E, listener: Listener<T, E>): this {
        return super.prependOnceListener(eventName, listener);
    }

    eventNames(): Array<KeyType> {
        return super.eventNames();
    }
}
