import {searchAnalogs} from './analogs-core.mjs?v=20261020-strength2';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:searchAnalogs(data.rows,data.options)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
