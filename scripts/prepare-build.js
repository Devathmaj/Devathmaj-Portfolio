import {
  createBuildInfo,
  readBuildInfo,
  writeFunctionsBuildModule,
} from './build-info.js';

const mode = process.argv.includes('--dev')
  ? 'dev'
  : process.argv.includes('--reuse')
    ? 'reuse'
    : 'production';

const info = mode === 'production'
  ? createBuildInfo()
  : mode === 'dev'
    ? createBuildInfo({ dev: true })
    : readBuildInfo();

writeFunctionsBuildModule(info);

console.log(`[build] ${info.id}${info.dev ? ' (development)' : ''}`);
