'use strict'
const registry = require('../registry.js')
const os = require('os')
const error = require('./error.js')
const log = require('npmlog')
const rp = require('request-promise')
const request = require('request')
const Promise = require('bluebird')
const debug = require('debug')('apmjs:npm')
const path = require('path')
const npm = require('npm')
const fs = require('fs-extra')
const tarball = require('tarball-extract')
const _ = require('lodash')

function downloadPackage (url, dir) {
  let name = path.basename(url)
  let tarfile = path.join(os.tmpdir(), `${name}.tgz`)
  let untardir = path.join(os.tmpdir(), `${name}`)
  let pkgdir = path.join(untardir, 'package')
  // TODO: tarball cache
  log.http('tarball', url)
  return Promise.all([fs.remove(untardir), fs.remove(tarfile)])
    .then(() => new Promise((resolve, reject) => {
      let s = request({
        url: url,
        followRedirect: true
      })
      .on('response', res => {
        if (res.statusCode >= 400) {
          reject(new error.HTTP(res.statusCode))
        } else {
          s.on('error', reject)
          .pipe(fs.createWriteStream(tarfile))
          .on('finish', resolve)
        }
      })
    }))
    .then(() => Promise.fromCallback(
      cb => tarball.extractTarball(tarfile, untardir, cb)
    ))
    .then(() => fs.remove(dir)) // move+override doesn't work for symlinks, so remove it first
    .then(() => fs.move(pkgdir, dir))
}

let metaCache = {}

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

let npmDelegate = {downloadPackage, getPackageMeta, load}

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
  'globalDir': {
    get: () => {
      return path.resolve(npm.globalDir, '../amd_modules')
    },
    configurable: true
  }
})

module.exports = npmDelegate
