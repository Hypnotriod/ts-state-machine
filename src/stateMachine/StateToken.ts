export default class StateToken {
    private cancelCallbacks: Array<() => void> = [];
    private _cancelled: boolean = false;

    public get cancelled(): boolean {
        return this._cancelled;
    }

    public cancel(): void {
        if (this._cancelled) { return; }
        this._cancelled = true;
        this.cancelCallbacks.forEach(cb => cb());
        this.cancelCallbacks = [];
    }

    public onCancel(callback: () => void): void {
        if (this._cancelled) { return; }
        this.cancelCallbacks.push(callback);
    }
}
