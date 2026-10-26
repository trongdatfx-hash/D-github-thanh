import {searchAnalogs} from './analogs-core.mjs?v=20261025-dcommon-all1';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:searchAnalogs(data.rows,data.options)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
