'use strict'

assert = require 'assertive'
Bluebird = require 'bluebird'
{Observable} = require 'rx'
tmp = require 'tmp'

SharedStore = require '../../'

tmpDir = Bluebird.promisify tmp.dir, tmp

describe 'SharedStore (with data already in cache)', ->
  cacheTmpDir = null

  beforeEach ->
    tmpDir(unsafeCleanup: true).then (createdDir) ->
      cacheTmpDir = createdDir
      store = new SharedStore
        temp: cacheTmpDir
        loader: Observable.just {data: 'some data'}
      store.init()

  describe 'taking a long time to load data', ->
    notSoCurrent = store = null

    beforeEach ->
      store = new SharedStore
        temp: cacheTmpDir
        loader: Observable
          .just {data: 'other data'}
          .delay 500
      store.init().then (current) ->
        notSoCurrent = current

    beforeEach ->
      Bluebird.delay 1000

    it 'should return cached data immediately in callback', ->
      assert.equal 'some data', notSoCurrent

    it 'should return latest data in getCurrent', ->
      assert.equal 'other data', store.getCurrent()

  describe 'having cache data = loaded data', ->
    store = null

    beforeEach ->
      store = new SharedStore
        temp: cacheTmpDir
        loader: Observable.just {data: 'some data'}

    it "should resolve the promise even if there's a long period between construction & initialization", ->
      Bluebird
        .delay 1000
        .then ->
          store.init()
        .then (data) ->
          assert.equal 'some data', data

  describe 'throwing a load error & then producing a value', ->
    store = thrownError = null

    beforeEach ->
      thrownError = false
      loader = ->
        Observable.create (observer) ->
          Bluebird.delay(250).then ->
            unless thrownError
              observer.onError new Error 'kaboom!'
              thrownError = true
              return
            observer.onNext data: '2nd value'

      store = new SharedStore
        temp: cacheTmpDir
        loader: loader

      store.init()

    it 'will throw an error first', ->
      store.on 'err', (err) ->
        assert.equal 'kaboom!', err.message

    it 'will keep on streaming after an error is thrown', ->
      Bluebird.delay(1500).then ->
        assert.equal '2nd value', store.getCurrent()
