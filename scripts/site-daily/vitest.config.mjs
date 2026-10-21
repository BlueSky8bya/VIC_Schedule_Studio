import {defineConfig,mergeConfig} from 'vitest/config';
import base from '../../vitest.config.ts';
// An explicit numeric host avoids Vite's startup localhost DNS probe. Thread
// workers communicate via MessagePorts; no application/test network is allowed.
export default mergeConfig(base,defineConfig({server:{host:'127.0.0.1',ws:false},test:{api:false,pool:'threads'}}));
