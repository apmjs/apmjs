'use strict'
const crypto = require('crypto')
const registry = require('../registry.js')
const ssri = require('ssri')
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
const PassThrough = require('stream').PassThrough

function checkIntegrity (dataStream, options) {
  if (options.integrity) {
    return ssri.checkStream(dataStream, options.integrity)
  }
  if (options.shasum) {
    let hash = crypto.createHash('sha1')
    return dataStream.then(data => {
      hash.update(data)
      let shasum = hash.digest('hex')
      if (shasum === options.shasum) return shasum
      throw new Error(`integrity checksum failed when using sha1: wanted ${options.shasum} but got ${shasum}`)
    })
  }
}

function writeFileStream (stream, filename) {
  return new Promise((resolve, reject) => {
    stream.on('error', reject)
    stream.on('finish', resolve)
    stream.pipe(fs.createWriteStream(filename))
  })
}

function downloadPackage (url, dir, checksum) {
  let name = path.basename(url)
  let tarfile = path.join(os.tmpdir(), `${name}.tgz`)
  let untardir = path.join(os.tmpdir(), `${name}`)
  let pkgdir = path.join(untardir, 'package')
  // TODO: tarball cache
  log.http('tarball', url)
  return Promise.all([fs.remove(untardir), fs.remove(tarfile)])
    .then(() => new Promise((resolve, reject) => {
      let fileStream = new PassThrough()
      request({ url, followRedirect: true })
      .on('response', res => res.statusCode >= 400
        ? reject(new error.HTTP(res.statusCode))
        : resolve(fileStream))
      .pipe(fileStream)
    }))
    .then(fileStream => {
      let checkStream = new PassThrough()
      let writeStream = new PassThrough()
      fileStream.pipe(checkStream)
      fileStream.pipe(writeStream)
      return Promise.all([
        writeFileStream(writeStream, tarfile),
        checksum && checkIntegrity(checkStream, checksum)
      ])
    })
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
