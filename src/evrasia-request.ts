import { IncomingMessage, OutgoingHttpHeaders } from 'http';
import https from 'https'; 
import url from 'url';
import tls from 'tls';
import { method } from './types/request';
import { preProcessFile, server } from 'typescript';

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
    port: number;
}

async function request(args: requestArguments) : Promise<serverResponce> {
    async function doRequest(request: requestArguments, proxy?: proxySettings) {
        return new Promise<serverResponce>((resolve, reject) => {

        
        var req = https.request(request.link, {
            method: proxy == null ? request?.method ?? 'GET' : 'CONNECT', 
            headers: request.headers, 
            host: proxy?.host ?? undefined, 
            port: proxy?.port ?? undefined,
        }, (d) => {
            if(proxy != null){
                var tlsConnection = tls.connect({
                    host: 'twitter.com',
                    socket: d.socket
                }, function () {
                    tlsConnection.write(`${request.method} / HTTP/1.1\r\nHost: ${request.link}\r\n\r\n`);
                });
            }

            var responceData;

            var requestListener = (proxy == null ? d : tlsConnection); 

            requestListener.on('data', function (data) {
                responceData += data;
            });

            requestListener.on('end', function () {
                resolve({
                    body: responceData,
                    statusCode: d.statusCode,
                    headers: d.headers,
                })
            });
        });

        req.end();

        });
    }
    return await doRequest(args);
}

export {request}