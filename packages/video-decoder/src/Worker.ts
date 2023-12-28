import MyWorker from './worker/WebWorkerDecoders?worker&inline';

interface ExtendedWorker extends Worker {
    ready: boolean
}

const worker: ExtendedWorker = new MyWorker();
worker.ready = false;
worker.addEventListener('message', (event) => {
    if (event.data.type === 'response:ready') {
        worker.ready = true;
    }
});

export default worker;