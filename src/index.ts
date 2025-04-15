import { StateFlow, StateMachine, StateToken } from './state-machine';

const SIGNAL_CANCEL = 'Cancel';
const SIGNAL_DEVIATE = 'Deviate';

const timeout = (token: StateToken, timeoutMs: number) => new Promise<void>((resolve) => {
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
        resolve();
    });
    token.onSuspend(() => {
        clearTimeout(timeoutId);
        timeoutMs -= Date.now() - timestamp;
        console.log(`Suspend timeout ${timeoutId} with ${timeoutMs} ms left`);
    });
    token.onResume(() => {
        start();
        console.log(`Resume as timeout ${timeoutId} with ${timeoutMs} ms left`);
    });
    start();
    console.log(`Start timeout ${timeoutId} for ${timeoutMs} ms`);
});

const flow1 = () => new StateFlow(
    'Flow 1',
    state => {
        console.log('Start Flow1');
        state.onSignal(SIGNAL_CANCEL, () => {
            console.log('Cancel Flow1 by signal');
            state.cancel();
        });
        state.onSignal(SIGNAL_DEVIATE, () => {
            console.log('Deviate Flow1');
            state.switchTo(alternativeFlow());
        });
    },
    StateFlow.inSequence(
        t => timeout(t, 1000),
        t => timeout(t, 1500),
    ),
    state => {
        console.log('End Flow1');
        state.switchTo(flow2());
    },
);

const flow2 = () => new StateFlow(
    'Flow 2',
    state => {
        console.log('Start Flow2');
        state.onSignal(SIGNAL_CANCEL, () => {
            console.log('Cancel Flow2 by signal');
            state.cancel();
        });
        state.onSignal(SIGNAL_DEVIATE, () => {
            console.log('Deviate Flow2');
            state.switchTo(alternativeFlow());
        });
    },
    StateFlow.inParallel(
        t => timeout(t, 4500),
        StateFlow.inSequence(
            t => timeout(t, 1000),
            t => timeout(t, 1500),
        ),
        StateFlow.inSequence(
            t => timeout(t, 500),
            t => timeout(t, 2500),
        ),
    ),
    _ => {
        console.log('End Flow2');
    },
);

const alternativeFlow = () => new StateFlow(
    'Alternative Flow',
    state => {
        console.log('Start Alternative Flow');
        state.onSignal(SIGNAL_CANCEL, () => {
            console.log('Cancel Alternative Flow');
            state.cancel();
        });
        state.onSignal(SIGNAL_DEVIATE, () => {
            console.log('Deviate Alternative Flow');
            state.switchTo(alternativeFlow());
        });
    },
    t => timeout(t, 1200),
    _ => {
        console.log('End Alternative Flow');
    },
);

const stateMachine: StateMachine = new StateMachine();
stateMachine.logger = {
    onCancel: name => console.log(`Cancel => ${name}`),
    onSuspend: name => console.log(`Suspend => ${name}`),
    onResume: name => console.log(`Resume => ${name}`),
    onSignal: (name, signal) => console.log(`Signal => ${name} => ${signal}`),
    onSwitch: name => console.log(`Switch to => ${name}`),
};
stateMachine.switchTo(flow1());

document.getElementById('btn-suspend').onclick = () => stateMachine.suspend();
document.getElementById('btn-resume').onclick = () => stateMachine.resume();
document.getElementById('btn-emit-cancel').onclick = () => stateMachine.emit(SIGNAL_CANCEL);
document.getElementById('btn-emit-deviate').onclick = () => stateMachine.emit(SIGNAL_DEVIATE);
