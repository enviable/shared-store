###
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
###

'use strict'

fs = require 'fs'
path = require 'path'

# TODOCK: something here relates to the event emitter leak - find it!
crashRecovery = (tmpDir) ->
  onApplicationCrashed = (exitCode) ->
    return if exitCode == 0
    console.error '''
      Application crashed with current config. Resetting cache.
    '''

    files =
      try fs.readdirSync tmpDir
      catch err
        console.error 'Failed to read config cache directory', err.message
        null

    console.error 'Trying to remove cache files', files
    return unless files?

    files.forEach (filename) ->
      absolute = path.join tmpDir, filename
      try fs.unlinkSync absolute
      catch err
        console.error 'Failed to reset %j', absolute, err.message

    console.error 'Cache reset successful.'

  process.on 'exit', onApplicationCrashed

  tearDownCrashHandler = ->
    process.removeListener 'exit', onApplicationCrashed

  onDataLoaded: ->
    # if the app survives 5s after initial load, we belive it's fine
    setTimeout tearDownCrashHandler, 5000

module.exports = crashRecovery
