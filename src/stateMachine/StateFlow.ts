import StateMachine, { StateFlowHandler } from "./StateMachine";
import StateToken, { StateTokenHandler } from "./StateToken";

export type FlowAction = (token: StateToken) => Promise<void>;
export type FlowActions = Array<FlowAction>;
export type ParallelFlowActions = Array<FlowActions>;

export default class StateFlow {
    private listeners: { [key: string]: () => void } = {};
    private before?: (handler: StateFlowHandler) => void;
    private actions?: ParallelFlowActions | FlowActions | FlowAction;
    private after?: (handler: StateFlowHandler) => void;
    private token: StateTokenHandler = new StateTokenHandler();
    private _name!: string;

    public static inParallel(...actions: (FlowAction | FlowActions)[]): ParallelFlowActions {
        return actions.map(actions => {
            if (StateFlow.isSingleAction(actions)) {
                return [actions];
            } else {
                return actions;
            }
        }, []);
    }

    public static inSequence(...actions: FlowAction[]): FlowActions {
        return actions;
    }

    constructor(
        name: string,
        before?: (handler: StateFlowHandler) => void,
        actions?: ParallelFlowActions | FlowActions | FlowAction,
        after?: (handler: StateFlowHandler) => void,
    ) {
        this._name = name;
        this.before = before;
        this.actions = actions;
        this.after = after;
    }

    public get name(): string {
        return this._name;
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
        this.drain();
        this.token.cancel();
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
            if (StateFlow.isSingleAction(this.actions)) {
                dequeuedActions.push(this.dequeueActions([this.actions]));
            } else if (StateFlow.areParallel(this.actions)) {
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

    private static isSingleAction(actions: ParallelFlowActions | FlowActions | FlowAction): actions is FlowAction {
        return actions instanceof Function;
    }

    private static areParallel(actions: ParallelFlowActions | FlowActions | FlowAction): actions is ParallelFlowActions {
        return Array.isArray(actions) && Array.isArray(actions[0]);
    }

    private dequeueActions = (actions: FlowActions) => new Promise<void>((resolve) => {
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

    private drain(): void {
        this.listeners = {};
    }
}
