import StateFlow from "./StateFlow";

export interface StateFlowHandler {
    suspended: boolean;
    cancelled: boolean;
    cancel(): void;
    suspend(): void;
    resume(): void;
    onSignal(signal: string, handler: () => void): void;
    next(flow: StateFlow): void;
}

export default class StateMachine implements StateFlowHandler {
    private flow?: StateFlow;
    private suspendedFlow?: StateFlow;

    public get cancelled(): boolean {
        return this.flow?.cancelled;
    }

    public get suspended(): boolean {
        return this.flow?.suspended;
    }

    public cancel(): void {
        this.flow?.cancel();
    }

    public suspend(): void {
        this.flow?.suspend();
    }

    public resume(): void {
        if (this.suspendedFlow) {
            this.flow = this.suspendedFlow;
            this.suspendedFlow = undefined;
            this.suspendedFlow.launch(this);
        } else {
            this.flow?.resume();
        }
    }

    public emit(signal: string): void {
        this.flow?.emit(signal);
    }

    public onSignal(signal: string, handler: () => void): void {
        this.flow?.onSignal(signal, handler);
    }

    public next(flow: StateFlow): void {
        this.flow?.cancel();
        if (this.flow?.suspended) {
            this.suspendedFlow = flow;
        } else {
            this.flow = flow;
            flow.launch(this);
        }
    }
}
