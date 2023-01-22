import { IncomingMessage, OutgoingHttpHeaders, request } from 'http';
import axios, { AxiosResponse, RawAxiosRequestConfig } from 'axios';
import url from 'url';
import { method } from './types/request';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface requestArguments {
    link: string;
    method?: method;
    headers?: OutgoingHttpHeaders;
}

interface proxySettings {
    host: string;
    port?: number;
}

async function httpsRequest(args: requestArguments): Promise<AxiosResponse> {
    async function doRequest(r: requestArguments, proxy?: proxySettings): Promise<AxiosResponse> {
        var axiosProxy: RawAxiosRequestConfig = {
            proxy: false,
            httpAgent: proxy == null ? undefined : new HttpsProxyAgent(`${proxy.host}:${proxy.port}`),
            headers: r.headers,
        };

        console.log(r.headers);

        var req: AxiosResponse;

        switch (r.method) {
            default:
            case 'GET':
                req = await axios.get(r.link, axiosProxy);
                break;
            case 'POST':
                req = await axios.post(r.link, axiosProxy);
                break;
            case 'PUT':
                req = await axios.put(r.link, axiosProxy);
                break;
            case 'HEAD':
                req = await axios.head(r.link, axiosProxy);
                break;
            case 'DELETE':
                req = await axios.delete(r.link, axiosProxy);
                break;
            case 'OPTIONS':
                req = await axios.options(r.link, axiosProxy);
                break;
            case 'PATCH':
                req = await axios.patch(r.link, axiosProxy);
                break;
        }

        return req;
    }

    return await doRequest(args, {
        host: '51.159.115.233',
        port: 3128,
    });
}

export { httpsRequest as request }