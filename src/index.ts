import StateToken from "./stateMachine/StateContext";
import StateFlow from "./stateMachine/StateFlow";

const timeout = (ctx: StateToken, timeoutMs: number) => new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
        console.log(`Complete timeout ${timeoutId} for ${timeoutMs} ms`);
        resolve();
    }, timeoutMs);
    console.log(`Start timeout ${timeoutId} for ${timeoutMs} ms`);
    ctx.onCancel(() => {
        console.log(`Cancel timeout ${timeoutId} for ${timeoutMs} ms`);
        clearTimeout(timeoutId);
        reject();
    })
});

const flow1 = () => new StateFlow(
    _ => {
        console.log("Start Flow1");
    },
    [
        ctx => timeout(ctx, 400),
        ctx => timeout(ctx, 500),
    ],
    handler => {
        console.log("End Flow1");
        handler.next(flow2());
    },
);

const flow2 = () => new StateFlow(
    async handler => {
        console.log("Start Flow2");
        await timeout(new StateToken(), 2500);
        handler.cancel();
        console.log("Cancel Flow2");
    },
    [
        [
            ctx => timeout(ctx, 1000),
            ctx => timeout(ctx, 1500),
        ],
        [
            ctx => timeout(ctx, 500),
            ctx => timeout(ctx, 2500),
        ],
    ],
    _ => {
        console.log("End Flow2");
    },
);

flow1().launch();
