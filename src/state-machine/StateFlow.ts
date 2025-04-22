import { StateMachine, StateFlowHandler } from './StateMachine';
import { StateToken, StateTokenHandler } from './StateToken';

export type FlowAction = (token: StateToken) => Promise<void>;
export type FlowActions = Array<FlowAction>;
export type ParallelFlowActions = Array<FlowActions>;

const isSingleAction = (actions: ParallelFlowActions | FlowActions | FlowAction): actions is FlowAction => {
    return actions instanceof Function;
}

const areParallel = (actions: ParallelFlowActions | FlowActions | FlowAction): actions is ParallelFlowActions => {
    return Array.isArray(actions) && Array.isArray(actions[0]);
}

export const inParallel = (...actions: (FlowAction | FlowActions)[]): ParallelFlowActions => {
    return actions.map(actions => {
        if (isSingleAction(actions)) {
            return [actions];
        } else {
            return actions;
        }
    }, []);
}

export const inSequence = (...actions: FlowAction[]): FlowActions => {
    return actions;
}

export class StateFlow {
    private listeners: { [key: string]: () => StateFlow | void } = {};
    private before?: (handler: StateFlowHandler) => StateFlow | void;
    private actions?: ParallelFlowActions | FlowActions | FlowAction;
    private after?: () => StateFlow | void;
    private token: StateTokenHandler = new StateTokenHandler();
    private _name!: string;

    constructor(
        name: string,
        before?: (handler: StateFlowHandler) => StateFlow | void,
        actions?: ParallelFlowActions | FlowActions | FlowAction,
        after?: () => StateFlow | void,
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

    public emit(signal: string): StateFlow | void {
        return this.listeners[signal]?.();
    }

    public onSignal(signal: string, handler: () => StateFlow | void): void {
        this.listeners[signal] = handler;
    }

    public async launch(stateMachine: StateMachine): Promise<void> {
        if (this.token.completed) { return; }
        let nextFlow = this.before?.(stateMachine);
        if (nextFlow) {
            stateMachine.switchTo(nextFlow);
            return;
        }
        if (this.token.completed) { return; }
        if (this.actions && this.actions.length) {
            const dequeuedActions: Array<Promise<void>> = [];
            if (isSingleAction(this.actions)) {
                dequeuedActions.push(this.dequeueActions([this.actions]));
            } else if (areParallel(this.actions)) {
                for (const actions of this.actions) {
                    dequeuedActions.push(this.dequeueActions(actions));
                }
            } else {
                dequeuedActions.push(this.dequeueActions(this.actions));
            }
            await Promise.all(dequeuedActions);
        }
        if (!this.token.completed && this.after) {
            nextFlow = this.after();
            if (nextFlow) {
                stateMachine.switchTo(nextFlow);
                return;
            }
        }
        this.token.complete();
    }

    private dequeueActions = (actions: FlowActions) => new Promise<void>((resolve) => {
        let neddToResume: boolean = false;
        let token: StateTokenHandler;
        const nextAction = async () => {
            while (actions.length && this.token && !this.token.cancelled) {
                token = new StateTokenHandler();
                const action = actions.shift();
                await action(token);
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
