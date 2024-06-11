import StateMachine, { StateFlowHandler } from "./StateMachine";
import StateToken from "./StateToken";

export type StateTasks = Array<(token: StateToken) => Promise<void>>;
export type StateTasksQueue = Array<StateTasks>;

export default class StateFlow {
    private listeners: { [key: string]: () => void } = {};
    private before?: (handler: StateFlowHandler) => void;
    private tasks?: StateTasksQueue | StateTasks;
    private after?: (handler: StateFlowHandler) => void;
    private token: StateToken = new StateToken();

    constructor(
        before?: (handler: StateFlowHandler) => void,
        tasks?: StateTasksQueue | StateTasks,
        after?: (handler: StateFlowHandler) => void,
    ) {
        this.before = before;
        this.tasks = tasks;
        this.after = after;
    }

    public get cancelled(): boolean {
        return this.token.cancelled;
    }

    public get suspended(): boolean {
        return this.token.suspended;
    }

    public get completed(): boolean {
        return this.token.completed;
    }

    public cancel(): void {
        this.token.cancel();
        this.listeners = {};
    }

    public suspend(): void {
        this.token.suspend();
    }

    public resume(): void {
        this.token.resume();
    }

    public emit(signal: string): void {
        this.listeners[signal]?.();
    }

    public onSignal(signal: string, handler: () => void): void {
        this.listeners[signal] = handler;
    }

    public async launch(stateMachine: StateMachine): Promise<void> {
        if (this.token.completed) { return; }
        this.before?.(stateMachine);
        if (this.token.completed) { return; }
        if (this.tasks && this.tasks.length) {
            const dequeuedTasks: Array<Promise<void>> = [];
            if (this.areParallel(this.tasks)) {
                for (const tasks of this.tasks) {
                    dequeuedTasks.push(this.dequeueTasks(tasks));
                }
            } else {
                dequeuedTasks.push(this.dequeueTasks(this.tasks));
            }
            await Promise.all(dequeuedTasks);
        }
        if (!this.token.completed && this.after) {
            this.after(stateMachine);
        }
        this.token.complete();
    }

    private areParallel(tasks: StateTasksQueue | StateTasks): tasks is StateTasksQueue {
        return Array.isArray(this.tasks[0]);
    }

    private dequeueTasks = (tasks: StateTasks) => new Promise<void>((resolve) => {
        let neddToResume: boolean = false;
        let token: StateToken;
        const nextTask = async () => {
            while (tasks.length && this.token && !this.token.cancelled) {
                token = new StateToken();
                const task = tasks.shift();
                try {
                    await task(token);
                } catch (e) { }
                if (token.suspended) {
                    token = undefined;
                    neddToResume = true;
                    return;
                }
                token = undefined;
                neddToResume = false;
            }
            resolve();
        }
        this.token.onCancel(() => token?.cancel());
        this.token.onSuspend(() => token?.suspend());
        this.token.onResume(() => {
            token?.resume();
            neddToResume && nextTask();
        });
        nextTask();
    });
}
