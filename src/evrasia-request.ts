import https from 'https';
import { method } from './types/request';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { OutgoingHttpHeaders } from 'node:http';
import { brotliDecompress } from 'zlib';
import { IncomingHttpHeaders } from 'http';
import { proxies } from './proxy-manager';


interface requestArguments {
    link: string;
    method?: method;
    headers?: OutgoingHttpHeaders;
    data?: any, 
}

interface responce {
    body: string;
    headers: IncomingHttpHeaders;
    statusCode: number;
    requestHeader: any;
    //TODO idk
}

interface proxySettings {
    host: string;
    port?: number;
}

async function httpsRequest(args: requestArguments): Promise<responce> {
    async function doRequest(r: requestArguments, proxy?: proxySettings): Promise<responce> {
        return new Promise((complete, reject) => {
            var rlink = r.link.replace('https://', '').replace('http://', '');

            console.log('request on ' +rlink.split('/')[0] );

            var request = https.request({
                protocol: 'https:',
                method: r.method,
                headers: r.headers,
                hostname: rlink.split('/')[0],
                
                path: rlink.replace(rlink.split('/')[0], ''),
                //TODO fix proxy
                // agent: proxy == null ? null : new HttpsProxyAgent(`${proxy.host}:${proxy.port}`),
            }, (responce) => {
                let body = '';

                responce.on('data', (chunk) => {
                    
                    body += chunk;
                })

                responce.on('end', () => {
                    complete({
                        body: body,
                        statusCode: responce.statusCode,
                        headers: responce.headers,
                        requestHeader: request.getRawHeaderNames(),
                    })
                });
            });

            console.log(request);
            
            if(r.data) request.write(r.data);

            request.end();
/*
            console.log('here');
            request.on('connect', (s) => {
                if(r.data != null) {
                    
                    request.end();
                }
                s.on('data', (responce) => {
                    let body = '';
    
                    responce.on('data', (chunk) => {
                        
                        body += chunk;
                    })
    
                    responce.on('end', () => {
                        complete({
                            body: body,
                            statusCode: responce.statusCode,
                            headers: responce.headers,
                            requestHeader: request.getRawHeaderNames(),
                        })
                    });
                })
            })*/
            
        });
    }
    // TODO: try another proxy if current fails 
    
    var proxy = proxies.length == 0 ? null : proxies[Math.floor(Math.random()*proxies.length)]

    if(proxy != null) {
        return await doRequest(args, {
            host: proxy.split(':')[0],
            port: parseInt(proxy.split(':')[1]),
        })
    } else {
        return await doRequest(args);
    }
}

export { httpsRequest as request }