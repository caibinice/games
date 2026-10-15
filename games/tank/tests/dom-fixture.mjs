import {beforeEach,afterEach,vi} from 'vitest';
beforeEach(()=>{
 vi.stubGlobal('document',new EventTarget());vi.stubGlobal('window',new EventTarget());
 vi.stubGlobal('KeyboardEvent',class extends Event{constructor(type,options={}){super(type,{cancelable:true});this.code=options.code;}});
});
afterEach(()=>vi.unstubAllGlobals());
