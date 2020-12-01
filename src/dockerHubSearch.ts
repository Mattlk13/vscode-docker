/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import https = require('https');
import { localize } from './localize';
import { httpsRequest } from './utils/httpRequest';

export function tagsForImage(image: IHubSearchResponseResult): string {
    let tags: string[] = [];
    if (image.is_automated) {
        tags.push('Automated');
    } else if (image.is_trusted) {
        tags.push('Trusted');
    } else if (image.is_official) {
        tags.push('Official');
    }
    if (tags.length > 0) {
        return '[' + tags.join('] [') + ']';
    }
    return '';
}

/* eslint-disable-next-line @typescript-eslint/promise-function-async */ // Grandfathered in
export function searchImageInRegistryHub(imageName: string, cache: boolean): Promise<IHubSearchResponseResult | undefined> {
    return invokeHubSearch(imageName, 1, cache).then((data) => {
        if ((<IHubSearchResponseResult[]>data.results).length === 0) {
            return undefined;
        }
        return data.results[0];
    });
}

let popular = [
    { "is_automated": false, "name": "redis", "is_trusted": false, "is_official": true, "star_count": 1300, "description": localize('vscode-docker.dockerHubSearch.redis', 'Redis is an open source key-value store that functions as a data structure server.') },
    { "is_automated": false, "name": "ubuntu", "is_trusted": false, "is_official": true, "star_count": 2600, "description": localize('vscode-docker.dockerHubSearch.ubuntu', 'Ubuntu is a Debian-based Linux operating system based on free software.') },
    { "is_automated": false, "name": "wordpress", "is_trusted": false, "is_official": true, "star_count": 582, "description": localize('vscode-docker.dockerHubSearch.wordPress', 'The WordPress rich content management system can utilize plugins, widgets, and themes.') },
    { "is_automated": false, "name": "mysql", "is_trusted": false, "is_official": true, "star_count": 1300, "description": localize('vscode-docker.dockerHubSearch.mysql', 'MySQL is a widely used, open-source relational database management system (RDBMS).') },
    { "is_automated": false, "name": "mongo", "is_trusted": false, "is_official": true, "star_count": 1100, "description": localize('vscode-docker.dockerHubSearch.mongodb', 'MongoDB document databases provide high availability and easy scalability.') },
    { "is_automated": false, "name": "centos", "is_trusted": false, "is_official": true, "star_count": 1600, "description": localize('vscode-docker.dockerHubSearch.centos', 'The official build of CentOS.') },
    { "is_automated": false, "name": "node", "is_trusted": false, "is_official": true, "star_count": 1200, "description": localize('vscode-docker.dockerHubSearch.node', 'Node.js is a JavaScript-based platform for server-side and networking applications.') },
    { "is_automated": false, "name": "nginx", "is_trusted": false, "is_official": true, "star_count": 1600, "description": localize('vscode-docker.dockerHubSearch.nginx', 'Official build of Nginx.') },
    { "is_automated": false, "name": "postgres", "is_trusted": false, "is_official": true, "star_count": 1200, "description": localize('vscode-docker.dockerHubSearch.postgres', 'The PostgreSQL object-relational database system provides reliability and data integrity.') },
    { "is_automated": true, "name": "microsoft/aspnet", "is_trusted": true, "is_official": false, "star_count": 277, "description": localize('vscode-docker.dockerHubSearch.aspNet', 'ASP.NET is an open source server-side Web application framework') }
];

/* eslint-disable-next-line @typescript-eslint/promise-function-async */ // Grandfathered in
export function searchImagesInRegistryHub(prefix: string, cache: boolean): Promise<IHubSearchResponseResult[]> {
    if (prefix.length === 0) {
        // return the popular images if user invoked intellisense
        // right after typing the keyword and ':' (e.g. 'image:').
        return Promise.resolve(popular.slice(0));
    }

    // Do an image search on Docker hub and return the results
    return invokeHubSearch(prefix, 100, cache).then((data) => {
        return data.results;
    });
}

// https://registry.hub.docker.com/v1/search?q=redis&n=1
// {
//     "num_pages": 10,
//     "num_results": 10,
//     "results": [
//         {
//             "is_automated": false,
//             "name": "redis",
//             "is_trusted": false,
//             "is_official": true,
//             "star_count": 830,
//             "description": "Redis is an open source key-value store that functions as a data structure server."
//         }
//     ],
//     "page_size": 1,
//     "query": "redis",
//     "page": 1
// }
/* eslint-disable-next-line @typescript-eslint/promise-function-async */ // Grandfathered in
function invokeHubSearch(imageName: string, count: number, cache: boolean): Promise<IHubSearchResponse> {
    // https://registry.hub.docker.com/v1/search?q=redis&n=1
    return fetchHttpsJson<IHubSearchResponse>(
        {
            hostname: 'registry.hub.docker.com',
            port: 443,
            path: '/v1/search?q=' + encodeURIComponent(imageName) + '&n=' + count,
            method: 'GET',
        },
        cache);
}
export interface IHubSearchResponse {
    /* eslint-disable-next-line camelcase */
    num_pages: number;
    /* eslint-disable-next-line camelcase */
    num_results: number;
    results: [IHubSearchResponseResult];
    /* eslint-disable-next-line camelcase */
    page_size: number;
    query: string;
    page: number;
}
export interface IHubSearchResponseResult {
    /* eslint-disable-next-line camelcase */
    is_automated: boolean;
    name: string;
    /* eslint-disable-next-line camelcase */
    is_trusted: boolean;
    /* eslint-disable-next-line camelcase */
    is_official: boolean;
    /* eslint-disable-next-line camelcase */
    star_count: number;
    description: string;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
let JSON_CACHE: { [key: string]: Promise<any> } = {};

/* eslint-disable-next-line @typescript-eslint/promise-function-async */ // Grandfathered in
function fetchHttpsJson<T>(opts: https.RequestOptions, cache: boolean): Promise<T> {
    if (!cache) {
        return doFetchHttpsJson(opts);
    }

    let cacheKey = (opts.method + ' ' + opts.hostname + ' ' + opts.path);
    if (!JSON_CACHE[cacheKey]) {
        JSON_CACHE[cacheKey] = doFetchHttpsJson(opts);
    }

    // new promise to avoid cancelling
    return new Promise<T>((resolve, reject) => {
        JSON_CACHE[cacheKey].then(resolve, reject);
    });
}

/* eslint-disable-next-line , @typescript-eslint/promise-function-async */ // Grandfathered in
function doFetchHttpsJson<T>(opts: https.RequestOptions): Promise<T> {
    opts.headers = opts.headers || {};
    opts.headers.Accept = 'application/json';
    return httpsRequest(opts).then((data) => {
        return JSON.parse(data);
    })
}
