'use strict'
const registry = require('../registry.js')
const Promise = require('bluebird')
const PassThrough = require('stream').PassThrough
const error = require('./error.js')
const log = require('npmlog')
const rp = require('request-promise')
const request = require('request')
const debug = require('debug')('apmjs:npm')
const path = require('path')
const npm = require('npm')
const _ = require('lodash')

let metaCache = {}

function downloadPackage (url) {
  log.http('tarball', url)
  return new Promise((resolve, reject) => {
    // response stream is fake (cannot pipe after emitted)
    let fileStream = new PassThrough()
    request({ url, followRedirect: true })
    .on('response', res => res.statusCode >= 400
      ? reject(new error.HTTP(res.statusCode))
      : resolve(fileStream))
    .pipe(fileStream)
  })
}

/**
 * get meta for package `name`
 *
 * @param {Package} parent parent for error promotion
 */
function getPackageMeta (name, parent) {
  if (metaCache[name]) {
    return metaCache[name]
  }
  let metaUrl = registry.packageUrl(name)
  log.http('meta', metaUrl)
  metaCache[name] = rp({
    url: metaUrl,
    json: true
  })
  .promise()
  .catch(e => {
    if (e.statusCode === 404) {
      throw new error.PackageNotFound(name, parent)
    } else {
      throw e
    }
  })
  .tap(desc => {
    if (!_.has(desc, 'versions')) {
      throw new error.InvalidPackageMeta(name, parent)
    }
    let versionList = Object.keys(desc.versions).join(',')
    debug('package meta retrieved:', `${desc.name}@${versionList}`)
  })
  return metaCache[name]
}

function load (conf) {
  let config = {}
  _.assign(config, conf)
  return Promise
  .fromCallback(cb => npm.load(config, cb))
  .tap(() => (log.level = 'silly'))
}

let config = {
  set: function (key, val) {
    return npm.config.set(key, val)
  },
  get: function (key) {
    return npm.config.get(key)
  }
}

let npmDelegate = {downloadPackage, getPackageMeta, load, config}

Object.defineProperties(npmDelegate, {
  'dir': {
    get: () => {
      return path.resolve(npm.dir, '../amd_modules')
    }
  },
  'prefix': {
    get: () => {
      return npm.prefix
    }
  },
  'localPrefix': {
    get: () => {
      return npm.localPrefix
    }
  },
  'globalPrefix': {
    get: () => {
      return npm.globalPrefix
    }
  },
  'globalDir': {
    get: () => {
      return path.resolve(npm.globalDir, '../amd_modules')
    },
    configurable: true
  }
})

module.exports = npmDelegate
