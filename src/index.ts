import StateToken from "./stateMachine/StateToken";
import StateFlow from "./stateMachine/StateFlow";
import StateMachine from "./stateMachine/StateMachine";

const timeout = (token: StateToken, timeoutMs: number) => new Promise<void>((resolve, reject) => {
    let timestamp: number;
    let timeoutId: NodeJS.Timeout;
    const start = () => {
        timestamp = Date.now();
        timeoutId = setTimeout(() => {
            console.log(`Complete timeout ${timeoutId}`);
            resolve();
        }, Math.max(timeoutMs, 0));
    }
    token.onCancel(() => {
        console.log(`Cancel timeout ${timeoutId}`);
        clearTimeout(timeoutId);
        reject();
    });
    token.onSuspend(() => {
        clearTimeout(timeoutId);
        console.log(`Suspend timeout ${timeoutId}`);
        timeoutMs -= Date.now() - timestamp;
    });
    token.onResume(() => {
        start();
        console.log(`Resume timeout ${timeoutId} for ${timeoutMs} ms`);
    });
    start();
    console.log(`Start timeout ${timeoutId} for ${timeoutMs} ms`);
});

const stateMachine: StateMachine = new StateMachine();
const SIGNAL_CANCEL = "Cancel";
const SIGNAL_DEVIATE = "Deviate";

const flow1 = () => new StateFlow(
    handler => {
        console.log("Start Flow1");
        handler.onSignal(SIGNAL_CANCEL, () => {
            console.log("Cancel Flow1 by signal");
            handler.cancel();
        });
        handler.onSignal(SIGNAL_DEVIATE, () => {
            console.log("Deviate Flow1");
            handler.next(alternativeFlow());
        });
    },
    [
        t => timeout(t, 1000),
        t => timeout(t, 1500),
    ],
    handler => {
        console.log("End Flow1");
        handler.next(flow2());
    },
);

const flow2 = () => new StateFlow(
    handler => {
        console.log("Start Flow2");
        handler.onSignal(SIGNAL_CANCEL, () => {
            console.log("Cancel Flow2 by signal");
            handler.cancel();
        });
        handler.onSignal(SIGNAL_DEVIATE, () => {
            console.log("Deviate Flow2");
            handler.next(alternativeFlow());
        });
    },
    [
        [
            t => timeout(t, 1000),
            t => timeout(t, 1500),
        ],
        [
            t => timeout(t, 500),
            t => timeout(t, 2500),
        ],
    ],
    _ => {
        console.log("End Flow2");
    },
);

const alternativeFlow = () => new StateFlow(
    handler => {
        console.log("Start Alternative Flow");
        handler.onSignal(SIGNAL_CANCEL, () => {
            console.log("Cancel Alternative Flow");
            handler.cancel();
        });
        handler.onSignal(SIGNAL_DEVIATE, () => {
            console.log("Deviate Alternative Flow");
            handler.next(alternativeFlow());
        });
    },
    [
        t => timeout(t, 1000),
    ],
    _ => {
        console.log("End Alternative Flow");
    },
);

stateMachine.next(flow1());

document.getElementById("btn-suspend").onclick = () => stateMachine.suspend();
document.getElementById("btn-resume").onclick = () => stateMachine.resume();
document.getElementById("btn-emit-cancel").onclick = () => stateMachine.emit(SIGNAL_CANCEL);
document.getElementById("btn-emit-deviate").onclick = () => stateMachine.emit(SIGNAL_DEVIATE);
