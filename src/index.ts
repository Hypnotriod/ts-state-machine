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
    "Flow 1",
    flow => {
        console.log("Start Flow1");
        flow.onSignal(SIGNAL_CANCEL, () => {
            console.log("Cancel Flow1 by signal");
            flow.cancel();
        });
        flow.onSignal(SIGNAL_DEVIATE, () => {
            console.log("Deviate Flow1");
            flow.switchTo(alternativeFlow());
        });
    },
    [
        t => timeout(t, 1000),
        t => timeout(t, 1500),
    ],
    flow => {
        console.log("End Flow1");
        flow.switchTo(flow2());
    },
);

const flow2 = () => new StateFlow(
    "Flow 2",
    flow => {
        console.log("Start Flow2");
        flow.onSignal(SIGNAL_CANCEL, () => {
            console.log("Cancel Flow2 by signal");
            flow.cancel();
        });
        flow.onSignal(SIGNAL_DEVIATE, () => {
            console.log("Deviate Flow2");
            flow.switchTo(alternativeFlow());
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
    "Alternative Flow",
    flow => {
        console.log("Start Alternative Flow");
        flow.onSignal(SIGNAL_CANCEL, () => {
            console.log("Cancel Alternative Flow");
            flow.cancel();
        });
        flow.onSignal(SIGNAL_DEVIATE, () => {
            console.log("Deviate Alternative Flow");
            flow.switchTo(alternativeFlow());
        });
    },
    t => timeout(t, 1200),
    _ => {
        console.log("End Alternative Flow");
    },
);

stateMachine.logger = {
    onCancel: name => console.log(`Cancel => ${name}`),
    onSuspend: name => console.log(`Suspend => ${name}`),
    onResume: name => console.log(`Resume => ${name}`),
    onSwitch: name => console.log(`Switch to => ${name}`),
};
stateMachine.switchTo(flow1());

document.getElementById("btn-suspend").onclick = () => stateMachine.suspend();
document.getElementById("btn-resume").onclick = () => stateMachine.resume();
document.getElementById("btn-emit-cancel").onclick = () => stateMachine.emit(SIGNAL_CANCEL);
document.getElementById("btn-emit-deviate").onclick = () => stateMachine.emit(SIGNAL_DEVIATE);
