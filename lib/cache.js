
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
var Observable, activeLoader, cleanup, crashRecovery, debug, dirContent, fromPromiseFunction, fs, isCacheFile, isEqual, latestCacheFile, latestFile, mkdirp, mkdirpStream, partial, passiveLoader, path, promisify, property, readCacheFile, readFile, ref, sortByMostRecent, timestampName, tryCache, unlink, writeCache, writeFile;

path = require('path');

fs = require('fs');

promisify = require('bluebird').promisify;

Observable = require('rx').Observable;

mkdirp = require('mkdirp');

ref = require('lodash'), isEqual = ref.isEqual, property = ref.property, partial = ref.partial;

debug = require('debug')('shared-store:cache');

fromPromiseFunction = require('./promise').fromPromiseFunction;

dirContent = require('./dir-content');

latestFile = require('./latest-file');

crashRecovery = require('./crash-recovery');

writeFile = promisify(fs.writeFile);

readFile = promisify(fs.readFile);

unlink = promisify(fs.unlink);

mkdirpStream = Observable.fromNodeCallback(mkdirp);

isCacheFile = function(arg) {
  var filename;
  filename = arg.filename;
  return /[\d-]+T[\d]+Z\.json/.test(filename);
};

this.timestampName = timestampName = function() {
  var date;
  date = new Date().toISOString().replace(/[:.]/g, '');
  return date + ".json";
};

sortByMostRecent = function(files) {
  return files.sort(function(a, b) {
    return b.mtime.getTime() - a.mtime.getTime();
  });
};

cleanup = function(tmpDir) {
  return dirContent(tmpDir, {
    watch: false,
    statFiles: true
  }).filter(isCacheFile).toArray().flatMap(sortByMostRecent).skip(5).map(property('absolute')).subscribe(unlink);
};

readCacheFile = function(arg) {
  var absolute;
  absolute = arg.absolute;
  return readFile(absolute).then(JSON.parse).then(function(arg1) {
    var data, time;
    data = arg1.data, time = arg1.time;
    return {
      data: data,
      time: time,
      source: absolute,
      usingCache: true
    };
  });
};

latestCacheFile = function(tmpDir, watch) {
  var options;
  if (watch == null) {
    watch = false;
  }
  options = {
    watch: watch,
    filter: isCacheFile
  };
  return latestFile(tmpDir, options).flatMap(readCacheFile);
};

writeCache = function(tmpDir, changed) {
  var writeIfChanged;
  writeIfChanged = function(latest) {
    var filename, serialized;
    if ((latest != null) && isEqual(changed.data, latest.data)) {
      debug('Latest cache file matches');
      return Observable.just(latest);
    } else {
      filename = path.join(tmpDir, timestampName());
      debug('Writing new cache file', filename);
      serialized = JSON.stringify(changed, null, 2);
      return fromPromiseFunction(function() {
        return writeFile(filename, serialized);
      }).map(function() {
        return changed;
      });
    }
  };
  return mkdirpStream(tmpDir).flatMap(function() {
    return tryCache(tmpDir);
  }).defaultIfEmpty().flatMap(writeIfChanged)["finally"](function() {
    return cleanup(tmpDir);
  });
};

tryCache = function(tmpDir) {
  return latestCacheFile(tmpDir, false)["catch"](function(error) {
    if (error.code === 'ENOENT') {
      debug('No cache file found');
      return Observable.empty();
    } else if (error instanceof SyntaxError) {
      debug("Invalid cache file found: " + error.message);
      return Observable.empty();
    } else {
      return Observable["throw"](error);
    }
  });
};

activeLoader = function(meta, loader, tmpDir) {
  var data, fromCache, onDataLoaded, rawData, ref1, tearDownCrashHandler;
  rawData = meta.flatMapLatest(loader).map(function(otherData) {
    otherData.usingCache = false;
    return otherData;
  });
  ref1 = crashRecovery(tmpDir), onDataLoaded = ref1.onDataLoaded, tearDownCrashHandler = ref1.tearDownCrashHandler;
  data = rawData.tap(onDataLoaded, tearDownCrashHandler, tearDownCrashHandler);
  fromCache = tryCache(tmpDir);
  return fromCache.takeUntil(data).merge(data).distinctUntilChanged(property('data'), isEqual).flatMapLatest(partial(writeCache, tmpDir)).publish();
};

passiveLoader = function(tmpDir) {
  return latestCacheFile(tmpDir, true).publish();
};

this.cachedLoader = function(meta, loader, tmpDir, active) {
  debug('cachedLoader(%j)', active);
  loader = active ? activeLoader(meta, loader, tmpDir) : passiveLoader(tmpDir);
  return Observable.create(function(observer) {
    loader.subscribe(observer);
    loader.connect();
  });
};

this.latestCacheFile = latestCacheFile;
