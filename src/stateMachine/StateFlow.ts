import { resolve } from "../../webpack.config";
import StateToken from "./StateToken";

export type StateTasks = Array<(token: StateToken) => Promise<void>>;
export type StateTasksQueue = Array<StateTasks>;

export interface StateFlowHandler {
    cancel(): void;
    suspend(): void;
    resume(): void;
    next(flow: StateFlow): void;
}

export default class StateFlow implements StateFlowHandler {
    private before?: (handler: StateFlowHandler) => void;
    private tasks?: StateTasksQueue | StateTasks;
    private after?: (handler: StateFlowHandler) => void;
    private token: StateToken = new StateToken();
    private suspendedFlow?: StateFlow;

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
        this.token.cancel();
    }

    public suspend(): void {
        this.token.suspend();
    }

    public resume(): void {
        this.token.resume();
        if (this.suspendedFlow) {
            const suspendedFlow = this.suspendedFlow;
            this.suspendedFlow = undefined;
            suspendedFlow.launch();
        }
    }

    public next(flow: StateFlow): void {
        this.cancel();
        if (this.token.suspended) {
            this.suspendedFlow = flow;
        } else {
            flow.launch();
        }
    }

    public async launch(): Promise<void> {
        if (this.token.cancelled) { return; }
        this.before?.(this);
        if (this.token.cancelled) { return; }
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
        if (!this.token.cancelled && this.after) {
            this.after(this);
        }
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
                neddToResume = false;
                token = undefined;
            }
            resolve();
        }
        this.token.onCancel(() => token?.cancel());
        this.token.onSuspend(() => token?.suspend());
        this.token.onResume(() => neddToResume && nextTask());
        nextTask();
    });
}
