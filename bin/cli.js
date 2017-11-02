#!/usr/bin/env node
'use strict'
;(function () { // wrapper in case we're in module_context mode
  // windows: running "npm blah" in this folder will invoke WSH, not node.
  /* global WScript */
  if (typeof WScript !== 'undefined') {
    WScript.echo(
      'npm does not work when run\n' +
        'with the Windows Scripting Host\n\n' +
        "'cd' to a different directory,\n" +
        "or type 'npm.cmd <args>',\n" +
        "or type 'node npm <args>'."
    )
    WScript.quit(1)
    return
  }

  process.title = 'npm'

  const pkg = require('../package.json')
  const log = require('npmlog')
  const path = require('path')
  const npm = require('npm')
  const npmconf = require('npm/lib/config/core.js')
  const errorHandler = require('npm/lib/utils/error-handler.js')

  let configDefs = npmconf.defs
  let shorthands = configDefs.shorthands
  let types = configDefs.types
  let nopt = require('nopt')

  log.pause()
  log.info('it worked if it ends with', 'ok')

  // if npm is called as "npmg" or "npm_g", then
  // run in global mode.
  if (path.basename(process.argv[1]).slice(-1) === 'g') {
    process.argv.splice(1, 1, 'npm', '-g')
  }

  log.verbose('cli', process.argv)

  let conf = nopt(types, shorthands)
  npm.argv = conf.argv.remain
  if (npm.deref(npm.argv[0])) npm.command = npm.argv.shift()
  else conf.usage = true

  if (npm.command === 'version') {
    console.log(pkg.version)
    return errorHandler.exit(0)
  }

  if (conf.versions) {
    npm.command = 'version'
    conf.usage = false
    npm.argv = []
  }

  log.info('using', 'npm@%s', npm.version)
  log.info('using', 'node@%s', process.version)

  process.on('uncaughtException', errorHandler)

  if (conf.usage && npm.command !== 'help') {
    npm.argv.unshift(npm.command)
    npm.command = 'help'
  }

  // now actually fire up npm and run the command.
  // this is how to use npm programmatically:
  conf._exit = true
  npm.load(conf, function (er) {
    // this log is different from the one required by npm
    log.level = npm.config.get('loglevel')
    log.resume()
    if (er) return errorHandler(er)

    Object.defineProperties(npm.commands, {
      'install': {
        get: () => require('../src/commands/install.js')
      },
      'link': {
        get: () => require('../src/commands/link.js')
      },
      'unlink': {
        get: () => require('../src/commands/unlink.js')
      }
    })

    log.verbose('command:', npm.command)
    npm.commands[npm.command](npm.argv, errorHandler, conf)
  })
})()
