'use strict'

assert = require 'assertive'
{Observable} = require 'rx'

onInterval = require '../lib/interval'

checkError = require './check-error'

LOAD_SUCCESS = {}
loadSuccess = -> Observable.just LOAD_SUCCESS

describe 'onInterval', ->
  it 'is a function', ->
    assert.hasType Function, onInterval

  describe 'interval < 1s', ->
    it 'fails', ->
      checkError onInterval(999, loadSuccess), (err) ->
        assert.equal '''
          Interval has to be at least 1s: 999ms
        ''', err.message

  describe 'interval is falsey', ->
    verifyOne = (observable) ->
      observable.toArray().toPromise().then (values) ->
        assert.equal 1, values.length
        assert.equal LOAD_SUCCESS, values[0]

    it 'returns one value only for interval = 0', ->
      verifyOne onInterval(0, loadSuccess)

    it 'returns one value for negative interval', ->
      verifyOne onInterval(-1, loadSuccess)

    it 'returns one value for interval = false', ->
      verifyOne onInterval(false, loadSuccess)

    it 'returns one value for interval = undefined', ->
      verifyOne onInterval(undefined, loadSuccess)

  describe 'interval >= 1s', ->
    loadIncremental = ->
      current = 0
      -> Observable.just current++

    it 'loads the first value immediately', ->
      start = Date.now()
      onInterval(1000, loadIncremental())
        .take(1).toPromise().then (value) ->
          assert.equal 0, value
          assert.truthy '''
           took <<< 1s
          ''', (Date.now() - start < 50)

    it 'loads one value per second', ->
      @timeout 2100
      @slow 2050
      start = Date.now()
      onInterval(1000, loadIncremental())
        .take(3).toArray()
        .toPromise().then (values) ->
          assert.deepEqual [ 0, 1, 2 ], values
          # 1st: immediate, 2nd: 1s, 3rd: 2s
          assert.truthy '''
            took >= 2s'
          ''', (Date.now() - start >= 2000)
