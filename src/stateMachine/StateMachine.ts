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
    onSignal(name: string, signal: string): void;
    onSwitch(name: string): void;
}

export default class StateMachine implements StateFlowHandler {
    private currentFlow?: StateFlow;
    private nextFlow?: StateFlow;
    private suspendedFlow?: StateFlow;
    private _logger?: StateFlowLogger;

    public get currentStateName(): string {
        return this.currentFlow?.name || "";
    }

    public get cancelled(): boolean {
        return this.currentFlow?.cancelled;
    }

    public get suspended(): boolean {
        return this.currentFlow?.suspended;
    }

    public get completed(): boolean {
        return this.currentFlow?.completed;
    }

    public set logger(logger: StateFlowLogger) {
        this._logger = logger;
    }

    public cancel(): void {
        this._logger?.onCancel(this.currentStateName);
        this.currentFlow?.cancel();
    }

    public suspend(): void {
        this._logger?.onSuspend(this.currentStateName);
        this.currentFlow?.suspend();
    }

    public resume(): void {
        if (this.suspendedFlow) {
            this.nextFlow = this.suspendedFlow;
            this.suspendedFlow = undefined;
            this._logger?.onResume(this.nextFlow.name);
            this.next();
        } else {
            this._logger?.onResume(this.currentStateName);
            this.currentFlow?.resume();
        }
    }

    public emit(signal: string): void {
        this._logger?.onSignal(this.currentStateName, signal);
        this.currentFlow?.emit(signal);
    }

    public onSignal(signal: string, handler: () => void): void {
        this.currentFlow?.onSignal(signal, handler);
    }

    public switchTo(flow: StateFlow): void {
        const completed = this.currentFlow?.completed;
        this.currentFlow?.cancel();
        this.suspendedFlow = undefined;
        this.nextFlow = undefined;
        if (this.currentFlow?.suspended) {
            this.suspendedFlow = flow;
        } else {
            this.nextFlow = flow;
        }
        if (!this.currentFlow || this.nextFlow && completed) {
            this._logger?.onSwitch(flow.name);
            this.next();
        }
    }

    private async next(): Promise<void> {
        this.currentFlow = this.nextFlow;
        this.nextFlow = undefined;
        await this.currentFlow.launch(this);
        if (!this.nextFlow) { return; }
        this._logger?.onSwitch(this.nextFlow.name);
        this.next();
    }
}
