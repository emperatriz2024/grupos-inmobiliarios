import path from 'node:path';
import {access,constants} from 'node:fs/promises';

export function chromiumCandidates(env=process.env){const prefix=env.PREFIX||'/data/data/com.termux/files/usr',join=isTermuxEnvironment(env)?path.posix.join:path.join;return [...new Set([env.CHROMIUM_PATH,env.PUPPETEER_EXECUTABLE_PATH,join(prefix,'bin','chromium-browser'),join(prefix,'bin','chromium'),'/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean))];}
export async function discoverChromium(env=process.env,{accessFn=access}={}){for(const candidate of chromiumCandidates(env)){try{await accessFn(candidate,constants.X_OK);return candidate;}catch{}}throw new Error('CHROMIUM_NOT_FOUND: configura CHROMIUM_PATH o instala chromium desde x11-repo.');}
export function isTermuxEnvironment(env=process.env){return Boolean(env.TERMUX_VERSION||String(env.PREFIX||'').includes('com.termux/files/usr'));}
