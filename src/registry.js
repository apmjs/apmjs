'use strict'
const log = require('npmlog')
const debug = require('debug')('apmjs:registry')
const url = require('url')
const npm = require('npm')

function packageUrl (name) {
  let registry = getRegistry(name)
  let namestr = encodeURIComponent(name)
  // npmjs.org insists `@` rather than `%40`
  namestr = namestr.replace(/^%40/, '@')
  return url.resolve(registry, namestr)
}

function getRegistry (name) {
  let scope = parseScope(name)
  let globalConfig = npm.config.get('registry')
  let scopedConfig = npm.config.get(`${scope}:registry`)
  let registry = scope ? (scopedConfig || globalConfig) : globalConfig
  log.verbose('using registry:', registry)
  return registry
}

function parseScope (name) {
  let match = /^(@.+)\//.exec(name)
  return match && match[1]
}

module.exports = {packageUrl}
