export const COLLECTOR_STATES=Object.freeze({BOOTING:'BOOTING',WAITING_QR:'WAITING_QR',AUTHENTICATED:'AUTHENTICATED',READY:'READY',RECONNECTING:'RECONNECTING',ERROR:'ERROR'});
export class CollectorState{
  constructor({now=()=>Date.now()}={}){this.now=now;this.state=COLLECTOR_STATES.BOOTING;this.qr=null;this.qrExpiresAt=0;this.lastReadyAt=null;this.lastError=null;this.groups=0;this.cursor=null;}
  setQr(dataUrl,ttlMs=60_000){this.state=COLLECTOR_STATES.WAITING_QR;this.qr=dataUrl;this.qrExpiresAt=this.now()+ttlMs;}
  ready(){this.state=COLLECTOR_STATES.READY;this.qr=null;this.qrExpiresAt=0;this.lastReadyAt=new Date(this.now()).toISOString();this.lastError=null;}
  fail(error){this.state=COLLECTOR_STATES.ERROR;this.lastError=String(error?.message||error||'collector_error').slice(0,160);}
  snapshot(){const qrAvailable=this.qr&&this.qrExpiresAt>this.now();return {state:this.state,qr_available:Boolean(qrAvailable),qr_data_url:qrAvailable?this.qr:null,last_ready_at:this.lastReadyAt,last_error:this.lastError,groups:this.groups,cursor:this.cursor};}
}
