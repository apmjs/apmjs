const defaults = require('npm/lib/config/defaults.js').defaults
const _ = require('lodash')
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
  var cliConfig = npm.config.list[0]
  var userConfig = _.assign({}, defaults, npm.config.list[3])

  if (_.has(cliConfig, 'registry')) {
    return cliConfig.registry
  }

  var scope = parseScope(name)
  return scope
    ? (userConfig[`${scope}:registry`] || userConfig.registry)
    : userConfig.registry
}

function parseScope (name) {
  var match = /^(@.+)\//.exec(name)
  return match && match[1]
}

module.exports = {packageUrl}
