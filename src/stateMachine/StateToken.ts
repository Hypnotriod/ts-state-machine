export default class StateToken {
    private cancelCallbacks: Array<() => void> = [];
    private suspendCallbacks: Array<() => void> = [];
    private resumeCallbacks: Array<() => void> = [];
    private _cancelled: boolean = false;
    private _suspended: boolean = false;

    public get cancelled(): boolean {
        return this._cancelled;
    }

    public get suspended(): boolean {
        return this._suspended;
    }

    public cancel(): void {
        if (this._cancelled) { return; }
        this._cancelled = true;
        const cancelCallbacks = this.cancelCallbacks;
        this.drain();
        cancelCallbacks.forEach(cb => cb());
    }

    public onCancel(callback: () => void): void {
        if (this._cancelled) { return; }
        this.cancelCallbacks.push(callback);
    }

    public suspend(): void {
        if (this._suspended) { return; }
        this._suspended = true;
        this.suspendCallbacks.forEach(cb => cb());
    }

    public onSuspend(callback: () => void): void {
        if (this._suspended) { return; }
        this.suspendCallbacks.push(callback);
    }


    public resume(): void {
        if (!this._suspended) { return; }
        this._suspended = false;
        this.resumeCallbacks.forEach(cb => cb());
    }

    public onResume(callback: () => void): void {
        if (this._suspended) { return; }
        this.resumeCallbacks.push(callback);
    }

    public drain(): void {
        this.cancelCallbacks = [];
        this.suspendCallbacks = [];
        this.resumeCallbacks = [];
    }
}
