export class AppendOnlyEventStore{
  #events=[];
  append(event){const frozen=Object.freeze({...event,payload_json:structuredClone(event.payload_json||{})});this.#events.push(frozen);return frozen;}
  list(filter={}){return this.#events.filter(event=>Object.entries(filter).every(([key,value])=>event[key]===value));}
  update(){throw new Error('domain_events_append_only');}
  delete(){throw new Error('domain_events_append_only');}
}
