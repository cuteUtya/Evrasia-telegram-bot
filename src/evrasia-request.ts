import https from 'https'; 
import url from 'url';
import { headers, method } from './types/request';

async function request(link: string, method?: method, headers?: headers) : Promise<Object> /**define object type */ {
    https.get(url.parse(link));
    return null;
}

export {request}