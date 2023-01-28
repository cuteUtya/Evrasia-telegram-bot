import fs from 'fs';
export var proxies: string[] = [];

export function initProxyStorage() {
    try {
        var file = fs.readFileSync('./proxy.json');
        if (file) {
            proxies = JSON.parse(file.toString());
        }
    } catch (e) {
        fs.appendFileSync('./proxy.json', '');
    }
}

export function addProxy(s: string) {
    proxies.push(s);
    save();    
}

function save() {
    fs.writeFileSync('./proxy.json', JSON.stringify(proxies));
}

export function removeProxy(s: string){
    if(proxies.includes(s)) proxies.splice(proxies.indexOf(s), 1);
    save();
}