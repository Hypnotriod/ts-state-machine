import StateMachine, { StateFlowHandler } from "./StateMachine";
import StateToken, { StateTokenHandler } from "./StateToken";

export type StateAction = (token: StateToken) => Promise<void>;
export type StateActions = Array<StateAction>;
export type ParallelStateActions = Array<StateActions>;

export default class StateFlow {
    private listeners: { [key: string]: () => void } = {};
    private before?: (handler: StateFlowHandler) => void;
    private actions?: ParallelStateActions | StateActions | StateAction;
    private after?: (handler: StateFlowHandler) => void;
    private token: StateTokenHandler = new StateTokenHandler();

    constructor(
        before?: (handler: StateFlowHandler) => void,
        actions?: ParallelStateActions | StateActions | StateAction,
        after?: (handler: StateFlowHandler) => void,
    ) {
        this.before = before;
        this.actions = actions;
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
        if (this.actions && this.actions.length) {
            const dequeuedActions: Array<Promise<void>> = [];
            if (this.isSingleAction(this.actions)) {
                dequeuedActions.push(this.dequeueActions([this.actions]));
            } else if (this.areParallel(this.actions)) {
                for (const actions of this.actions) {
                    dequeuedActions.push(this.dequeueActions(actions));
                }
            } else {
                dequeuedActions.push(this.dequeueActions(this.actions));
            }
            await Promise.all(dequeuedActions);
        }
        if (!this.token.completed && this.after) {
            this.after(stateMachine);
        }
        this.token.complete();
    }

    private isSingleAction(actions: ParallelStateActions | StateActions | StateAction): actions is StateAction {
        return actions instanceof Function;
    }

    private areParallel(actions: ParallelStateActions | StateActions | StateAction): actions is ParallelStateActions {
        return Array.isArray(this.actions) && Array.isArray(this.actions[0]);
    }

    private dequeueActions = (actions: StateActions) => new Promise<void>((resolve) => {
        let neddToResume: boolean = false;
        let token: StateTokenHandler;
        const nextAction = async () => {
            while (actions.length && this.token && !this.token.cancelled) {
                token = new StateTokenHandler();
                const action = actions.shift();
                try {
                    await action(token);
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
            neddToResume && nextAction();
        });
        nextAction();
    });
}
