export const SECONDARY_RESUME_MIN_MS=3*60*1000;
export const SECONDARY_POLL_MS=5*60*1000;
export function shouldSyncSecondary({lastAttempt=0,now=Date.now(),minimumMs=SECONDARY_RESUME_MIN_MS}={}){return !Number(lastAttempt)||now-Number(lastAttempt)>=minimumMs;}
