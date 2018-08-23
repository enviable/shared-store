
/*
Copyright (c) 2015, Groupon, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

Redistributions of source code must retain the above copyright notice,
this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

Neither the name of GROUPON nor the names of its contributors may be
used to endorse or promote products derived from this software without
specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
'use strict';
var debug, fromPromiseFunction, httpResource, onInterval, partial;

debug = require('debug')('shared-store:http');

partial = require('lodash').partial;

fromPromiseFunction = require('./promise').fromPromiseFunction;

onInterval = require('./interval');

httpResource = function(arg) {
  var checkModified, fetch, interval, lastBody, lastETag, lastModified, load, returnLastKnown, wrap;
  fetch = arg.fetch, interval = arg.interval;
  lastETag = void 0;
  lastModified = void 0;
  lastBody = void 0;
  wrap = function(data, source) {
    if (source == null) {
      source = 'http';
    }
    return {
      data: data,
      time: Date.now(),
      source: source
    };
  };
  checkModified = function(arg1) {
    var body, headers, response, statusCode, url;
    response = arg1.response, body = arg1.body, url = arg1.url;
    headers = response.headers, statusCode = response.statusCode;
    if (statusCode === 304) {
      debug('cache headers match');
      response.resume();
    } else {
      debug('cache header mismatch');
      lastBody = wrap(body, url);
      lastETag = headers.etag;
      lastModified = headers['last-modified'];
    }
    return lastBody;
  };
  returnLastKnown = function(error) {
    if (lastBody != null) {
      debug('Failed, return last known', error);
      return lastBody;
    } else {
      return Promise.reject(error);
    }
  };
  load = partial(fromPromiseFunction, function() {
    return fetch({
      'If-None-Match': lastETag,
      'If-Modified-Since': lastModified
    }).then(checkModified, returnLastKnown);
  });
  return onInterval(interval, load).distinctUntilChanged(null, function(a, b) {
    return a === b;
  });
};

module.exports = httpResource;
