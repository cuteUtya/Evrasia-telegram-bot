import { IncomingMessage, OutgoingHttpHeaders, request } from 'http';
import axios from 'axios';
import url from 'url';
import { method } from './types/request';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface requestArguments {
    link: string;
    method?: method;
    headers?: OutgoingHttpHeaders;
}

interface serverResponce {
    body: string;
    statusCode: number;
    headers: IncomingMessage["headers"];
}

interface proxySettings {
    host: string;
    port?: number;
}

async function httpsRequest(args: requestArguments) : Promise<serverResponce> {
    async function doRequest(r: requestArguments, proxy?: proxySettings) {
        var bruh = await axios.get(r.link, {
            proxy: false,
            httpAgent: proxy == null ? undefined : new HttpsProxyAgent(`${proxy.host}:${proxy.port}`)
        });

        console.log(bruh.data);

        return null;
    }
    return await doRequest(args, {
        host: '51.159.115.233',
        port: 3128,
    });
}

export {httpsRequest as request}