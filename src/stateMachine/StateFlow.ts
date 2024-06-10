import StateToken from "./StateToken";

export type StateTasks = Array<(token: StateToken) => Promise<void>>;
export type StateTasksQueue = Array<StateTasks>;

export interface StateFlowHandler {
    cancel(): void;
    next(flow: StateFlow): void;
}

export default class StateFlow implements StateFlowHandler {
    private before?: (handler: StateFlowHandler) => void;
    private tasks?: StateTasksQueue | StateTasks;
    private after?: (handler: StateFlowHandler) => void;
    private token?: StateToken;

    constructor(
        before?: (handler: StateFlowHandler) => void,
        tasks?: StateTasksQueue | StateTasks,
        after?: (handler: StateFlowHandler) => void,
    ) {
        this.before = before;
        this.tasks = tasks;
        this.after = after;
    }

    public cancel(): void {
        const token = this.token;
        this.drain();
        token?.cancel();
    }

    public next(flow: StateFlow): void {
        this.cancel();
        flow.launch();
    }

    public async launch(): Promise<void> {
        this.token = new StateToken();
        this.before?.(this);
        if (!this.token || this.token.cancelled) {
            this.drain();
            return;
        }
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
        if (this.token && !this.token.cancelled && this.after) {
            this.drain();
            this.after(this);
        } else {
            this.drain();
        }
    }

    private areParallel(tasks: StateTasksQueue | StateTasks): tasks is StateTasksQueue {
        return Array.isArray(this.tasks[0]);
    }

    private async dequeueTasks(tasks: StateTasks): Promise<void> {
        let token: StateToken;
        this.token!.onCancel(() => token?.cancel());
        while (tasks.length && !this.token?.cancelled) {
            token = new StateToken();
            const task = tasks.shift();
            try {
                await task(token);
            } catch (e) { }
            token = undefined;
        }
    }

    private drain(): void {
        this.tasks = undefined;
        this.token = undefined;
    }
}
