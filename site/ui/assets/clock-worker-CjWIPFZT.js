(function(){"use strict";let e;self.onmessage=({data:s})=>{clearInterval(e),s===!0&&(e=setInterval(()=>self.postMessage(0),1e3/60))}})();
