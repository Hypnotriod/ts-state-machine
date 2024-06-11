import StateFlow from "./StateFlow";

export interface StateFlowHandler {
    currentStateName: string;
    suspended: boolean;
    cancelled: boolean;
    completed: boolean;
    cancel(): void;
    suspend(): void;
    resume(): void;
    onSignal(signal: string, handler: () => void): void;
    switchTo(flow: StateFlow): void;
}

export interface StateFlowLogger {
    onCancel(name: string): void;
    onSuspend(name: string): void;
    onResume(name: string): void;
    onSwitch(name: string): void;
}

export default class StateMachine implements StateFlowHandler {
    private flow?: StateFlow;
    private suspendedFlow?: StateFlow;
    private _logger?: StateFlowLogger;

    public get currentStateName(): string {
        return this.flow?.name || "";
    }

    public get cancelled(): boolean {
        return this.flow?.cancelled;
    }

    public get suspended(): boolean {
        return this.flow?.suspended;
    }

    public get completed(): boolean {
        return this.flow?.completed;
    }

    public set logger(logger: StateFlowLogger) {
        this._logger = logger;
    }

    public cancel(): void {
        this._logger?.onCancel(this.currentStateName);
        this.flow?.cancel();
    }

    public suspend(): void {
        this._logger?.onSuspend(this.currentStateName);
        this.flow?.suspend();
    }

    public resume(): void {
        if (this.suspendedFlow) {
            this.flow = this.suspendedFlow;
            this.suspendedFlow = undefined;
            this._logger?.onResume(this.flow.name);
            this.flow.launch(this);
        } else {
            this._logger?.onResume(this.flow.name);
            this.flow?.resume();
        }
    }

    public emit(signal: string): void {
        this.flow?.emit(signal);
    }

    public onSignal(signal: string, handler: () => void): void {
        this.flow?.onSignal(signal, handler);
    }

    public switchTo(flow: StateFlow): void {
        this._logger?.onSwitch(flow.name);
        this.flow?.cancel();
        if (this.flow?.suspended) {
            this.suspendedFlow = flow;
        } else {
            this.flow = flow;
            this.flow.launch(this);
        }
    }
}
