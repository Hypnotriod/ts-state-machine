import StateToken from "./stateMachine/StateToken";
import StateFlow from "./stateMachine/StateFlow";
import StateMachine from "./stateMachine/StateMachine";

const timeout = (ctx: StateToken, timeoutMs: number) => new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
        console.log(`Complete timeout ${timeoutId}`);
        resolve();
    }, timeoutMs);
    console.log(`Start timeout ${timeoutId} for ${timeoutMs} ms`);
    ctx.onCancel(() => {
        console.log(`Cancel timeout ${timeoutId}`);
        clearTimeout(timeoutId);
        reject();
    })
});

const stateMachine: StateMachine = new StateMachine();

const flow1 = () => new StateFlow(
    handler => {
        console.log("Start Flow1");
        handler.onSignal("Cancel", () => {
            console.log("Cancel Flow1 by signal");
            handler.cancel();
        });
    },
    [
        t => timeout(t, 400),
        t => timeout(t, 500),
    ],
    handler => {
        console.log("End Flow1");
        handler.next(flow2());
    },
);

const flow2 = () => new StateFlow(
    async handler => {
        console.log("Start Flow2");
        handler.onSignal("Cancel", () => {
            console.log("Cancel Flow2 by signal");
            handler.cancel();
        });
        await timeout(new StateToken(), 2500);
        if (!handler.cancelled) {
            handler.cancel();
            console.log("Cancel Flow2 by timeout");
        }
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

stateMachine.next(flow1());

document.getElementById("btn-suspend").onclick = () => stateMachine.suspend();
document.getElementById("btn-resume").onclick = () => stateMachine.resume();
document.getElementById("btn-emit-cancel").onclick = () => stateMachine.emit("Cancel");
