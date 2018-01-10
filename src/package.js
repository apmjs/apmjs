'use strict'
const os = require('os')
const PassThrough = require('stream').PassThrough
const Promise = require('bluebird')
const tarball = require('tarball-extract')
const findUp = require('../src/utils/fs.js').findUp
const integrity = require('./utils/integrity.js')
const writeFileStream = require('./utils/fs.js').writeFileStream
const assert = require('assert')
const npm = require('./utils/npm')
const log = require('npmlog')
const process = require('process')
const error = require('./utils/error.js')
const _ = require('lodash')
const Version = require('./resolver/version.js')
const fs = require('fs-extra')
const debug = require('debug')('apmjs:package')
const changeCase = require('change-case')
const path = require('path')
const SKIP_WRITING_MSG = 'package.json not exist, skip saving...'

function Package (descriptor, pathname) {
  assert(descriptor.name, 'package name not defined for ' + pathname)

  this.version = descriptor.version
  this.name = descriptor.name
  this.dependencies = descriptor.amdDependencies || {}
  this.descriptor = descriptor
  if (pathname) {
    this.setPathname(pathname)
  }
}

Package.loadModule = function (name) {
  return Package.loadByPath(path.resolve(npm.dir, name))
}

Package.loadByPath = function (pathname) {
  return Promise.resolve(path.resolve(pathname, 'package.json'))
    .then(file => fs.readJson(file))
    .then(descriptor => new Package(descriptor, pathname))
}

Package.load = function (pathname) {
  return findUp('package.json', pathname)
    .then(filepath => path.dirname(filepath))
    .then(dirpath => Package.loadByPath(dirpath))
}

Package.createByDirectory = function (dir) {
  var pkg = new Package({name: 'root'}, dir || process.cwd())
  pkg.noPackageJSON = true
  return pkg
}

Package.loadOrCreate = function (pathname) {
  return Package.load(pathname)
    .catch(err => {
      if (err.code === 'ENOENT') {
        return Package.createByDirectory()
      }
      throw err
    })
}

/**
 * Get latest package object from meta info
 *
 * @param {String} [semver="*"] required semver
 * @param {String} [tracing=undefined] tracing info printed on error
 */
Package.createMaxSatisfying = function (info, semver, tracing) {
  semver = semver || '*'
  var name = info.name
  var maxSatisfiying = Package.maxSatisfying(info.versions, semver)

  if (!maxSatisfiying) {
    var msg = `package ${name}@${semver} not available`
    if (tracing) {
      msg += ', ' + tracing
    }
    throw new error.UnmetDependency(msg)
  }
  return maxSatisfiying
}

/**
 * @param {String} version if not specified, all versions are OK
 */
Package.hasInstalled = function (name, version, pathname) {
  return new Package({name, version}).hasInstalled(pathname)
}

Package.prototype.install = function () {
  let url = this.descriptor.dist.tarball

  return this.queryCache()
  .then(tarfile => tarfile || this.download(url))
  .then(tarfile => this.untar(tarfile))
  .then(() => this.postInstall())
}

Package.prototype.queryCache = function () {
  let tarfile = path.join(this.cacheDir(), 'package.tgz')
  return fs.exists(tarfile)
  .then(exists => {
    if (!exists) {
      return null
    }
    return tarfile
    // TODO check integrity if lock exists
    // return this.checkIntegrity(fs.createReadStream(tarfile))
  })
}

Package.prototype.cacheDir = function () {
  return path.join(npm.config.get('cache'), this.name, this.version)
}

Package.prototype.download = function (url) {
  let cachedir = this.cacheDir()
  let tarfile = path.join(cachedir, 'package.tgz')
  return fs.emptyDir(cachedir)
    .then(() => npm.downloadPackage(url))
    .then(fileStream => {
      let checkStream = new PassThrough()
      let writeStream = new PassThrough()
      fileStream.pipe(checkStream)
      fileStream.pipe(writeStream)

      return Promise.all([
        writeFileStream(writeStream, tarfile),
        this.checkIntegrity(checkStream)
      ])
    })
    .catch(e => {
      if (e instanceof error.IntegrityError) {
        return fs.remove(cachedir).then(() => {
          throw e
        })
      }
      throw e
    })
    .then(() => tarfile)
}

Package.prototype.untar = function (tarfile) {
  let untardir = path.join(os.tmpdir(), `${this.name}`)

  return fs.remove(untardir)
    .then(() => Promise.fromCallback(
      cb => tarball.extractTarball(tarfile, untardir, cb)
    ))
    // move+override doesn't work for symlinks, remove it anyway
    .then(() => fs.remove(this.pathname))
    .then(() => fs.move(path.join(untardir, 'package'), this.pathname))
}

Package.prototype.checkIntegrity = function (dataStream) {
  let sri = _.get(this, 'descriptor.dist.integrity')
  let sha1 = _.get(this, 'descriptor.dist.shasum')
  if (sri) {
    log.verbose('integrity', `checking ${this} against ${sri}`)
    return integrity.checkSRI(dataStream, sri)
  }
  if (sha1) {
    log.verbose('integrity', `checking ${this} against ${sha1}`)
    return integrity.checkSHA1(dataStream, sha1)
  }
  log.warn('integrity', `no integrity/shasum found for ${this}, skipping check`)
}

Package.prototype.hasInstalled = function (pathname) {
  return fs.readJson(path.join(pathname, this.name, 'package.json'))
    .then(json => {
      if (json.name !== this.name) {
        return false
      }
      if (this.version && this.version !== json.version) {
        return false
      }
      return true
    })
    .catch(e => {
      if (e.code === 'ENOENT') {
        return false
      }
      throw e
    })
}

Package.prototype.postInstall = function () {
  if (!this.pathname) {
    return Promise.reject(new Error('cannot run post-install, setDirname first'))
  }
  return Promise
  .all([
    this.replaceBrowserFiles(),
    this.populatePackageJson(),
    this.writeAMDEntry()
  ])
  .then(() => {
    this.status = 'installed'
    return this
  })
}

Package.prototype.populatePackageJson = function () {
  let distFields = _.pick(this.descriptor, ['author', 'dist'])
  return fs.readJson(this.descriptorPath)
    .then(json => _.assign(json, distFields))
    .then(json => fs.writeJson(this.descriptorPath, json, {spaces: 2}))
}

Package.prototype.replaceBrowserFiles = function () {
  var browser = this.descriptor.browser
  if (!_.isObject(browser)) {
    return []
  }
  return Promise.map(browser, (replacer, target) => {
    var targetPath = path.resolve(this.pathname, target)
    if (replacer === false) {
      return fs.writeFile(targetPath, 'define(function(){})')
    }
    var replacerPath = path.resolve(this.pathname, replacer)
    return fs.move(replacerPath, targetPath, {overwrite: true}).catch(e => {
      log.warn(`failed to mv ${replacer} to ${target}: ${e.message}`)
    })
  })
}

Package.prototype.writeAMDEntry = function () {
  var mod = this.relativeModuleId()
  return fs.writeFile(
    this.amdpath,
    `define(['${mod}'], function (mod) { return mod; })`
  )
}

Package.prototype.relativeModuleId = function () {
  var finalName = this.name.replace(/.*\//, '')
  var modulePath = path.join(finalName, this.index)

  var moduleId = _.trimEnd(modulePath, '.js')
  moduleId = moduleId.replace(/\\/g, '/') // windows
  moduleId = './' + moduleId
  return moduleId
}

Package.prototype.toString = function () {
  return this.version ? this.name + '@' + this.version : this.name
}

Package.maxSatisfying = function (versionMap, semver) {
  var descriptor = Version.maxSatisfyingDescriptor(versionMap, semver)
  return descriptor && new Package(descriptor)
}

Package.prototype.setDirname = function (dirname) {
  var pathname = path.resolve(dirname, this.name)
  return this.setPathname(pathname)
}

Package.prototype.equalTo = function (another) {
  return another &&
    this.name === another.name &&
    this.version === another.version
}

Package.prototype.setPathname = function (pathname) {
  var descriptor = this.descriptor
  var browser = _.isString(descriptor.browser) ? descriptor.browser : ''
  var index = browser || descriptor.main || 'index.js'
  this.index = index
  this.filepath = path.join(this.name, index)
  this.fullpath = path.resolve(pathname, index)
  this.amdpath = pathname + '.js'
  this.pathname = pathname
  this.descriptorPath = path.resolve(pathname, 'package.json')
  this.modulesPath = path.resolve(pathname, 'amd_modules')
  this.lockfilePath = path.resolve(pathname, 'amd-lock.json')
  return this
}

Package.prototype.saveDependencies = function (nodes, save) {
  if (!this.descriptorPath) {
    log.info(SKIP_WRITING_MSG)
    return Promise.resolve()
  }
  return fs
    .readJson(this.descriptorPath)
    .then(descriptor => {
      /**
       * Whether or not to write amdDependencies?
       *
       * Save Option | Installed |  New
       * ----------- | --------- | -----
       *        save |    yes    |  yes
       *     no-save |    yes    |  no
       */
      let deps = {}
      _.forOwn(nodes, node => {
        if (save || this.dependencies[node.name]) {
          deps[node.name] = node.listed
            ? Version.versionToSave(node.version)
            : this.dependencies[node.name]
        }
      })
      descriptor.amdDependencies = deps
      return fs.writeJson(this.descriptorPath, descriptor, {spaces: 2})
    })
    .catch(e => {
      if (e.code !== 'ENOENT') {
        throw e
      }
      log.info(SKIP_WRITING_MSG)
    })
}

Package.prototype.saveLocks = function (packages, originalLock) {
  var lock = {
    name: this.name,
    version: this.version,
    dependencies: {}
  }
  packages.forEach(pkg => {
    let version = pkg.version
    let integrity = _.get(pkg, 'descriptor.dist.shasum') ||
      _.get(originalLock, `${pkg.name}.integrity`)
    // let integrity = _.get(pkg, 'descriptor.dist.shasum') ||
      // _.get(originalLock, `${pkg.name}.integrity`)
    lock.dependencies[pkg.name] = { version, integrity }
  })
  return fs.writeJson(this.lockfilePath, lock, {spaces: 2})
}

Package.prototype.read = function () {
  return Promise.resolve(this.filepath)
    .then(path => fs.readFile(path, {encoding: 'utf8'}))
    .then(content => {
      this.content = content
      return this
    })
}

Package.prototype.distname = function (dirname) {
  dirname = dirname || ''
  var filename = changeCase.paramCase(this.name) + '.js'
  return path.resolve(dirname, filename)
}

Package.prototype.toString = function () {
  return this.version ? this.name + '@' + this.version : this.name
}

module.exports = Package
