import {parentPort} from 'node:worker_threads';
import {installSearchWorker} from '../search-worker.js';
const port={postMessage:m=>parentPort.postMessage(m)};
installSearchWorker(port);
parentPort.on('message',data=>port.onmessage({data}));
