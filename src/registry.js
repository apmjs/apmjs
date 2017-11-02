const log = require('npmlog')
const debug = require('debug')('apmjs:registry')
const url = require('url')
const npm = require('npm')

function packageUrl (name) {
  var registry = getRegistry(name)
  var namestr = encodeURIComponent(name)
  // npmjs.org insists `@` rather than `%40`
  namestr = namestr.replace(/^%40/, '@')
  return url.resolve(registry, namestr)
}

function getRegistry (name) {
  var scope = parseScope(name)
  var configKey = scope ? `${scope}:registry` : 'registry'
  var registry = npm.config.get(configKey)
  log.verbose('using registry:', registry)
  return registry
}

function parseScope (name) {
  var match = /^(@.+)\//.exec(name)
  return match && match[1]
}

module.exports = {packageUrl}
