'use strict'
const PassThrough = require('stream').PassThrough
const Promise = require('bluebird')
const gunzip = require('gunzip-maybe')
const tar = require('tar')
const Lock = require('./resolver/lock.js')
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
  this.integrity = Lock.getIntegrity(this.name, this.version) || _.get(descriptor, 'dist.integrity')
  this.descriptor = descriptor
  if (pathname) {
    this.setPathname(pathname)
  }
}

Package.prototype.dependencyPath = function (name) {
  return path.resolve(this.modulesPath || npm.dir, name)
}

Package.prototype.loadDependency = function (name) {
  return Package.loadByPath(this.dependencyPath(name))
}

Package.prototype.dependencyLinked = function (name) {
  let filepath = this.dependencyPath(name)
  return fs.lstat(filepath).then(stats => stats.isSymbolicLink())
}

Package.loadByPath = function (pathname) {
  let pkgPath = path.resolve(pathname, 'package.json')
  log.verbose('package', 'loading package:', pkgPath)
  return Promise.resolve(pkgPath)
    .then(file => fs.readJson(file))
    .then(descriptor => new Package(descriptor, pathname))
}

Package.createGlobalRoot = function () {
  log.silly('global', npm.globalDir)
  let pathname = path.resolve(npm.globalDir, '..')
  log.silly('pathname', pathname)
  return Package.createInMemory(pathname)
}

Package.createInMemory = function (dir) {
  var pkg = new Package({name: 'root'}, dir || process.cwd())
  pkg.noPackageJSON = true
  return pkg
}

Package.load = function (current) {
  current = current || process.cwd()
  log.silly('finding package from', current, '...')
  var fPackage = path.resolve(current, 'package.json')
  var fModules = path.resolve(current, 'amd_modules')
  return Promise
  .all([fs.pathExists(fPackage), fs.pathExists(fModules)])
  .spread((ePackage, eModules) => {
    if (ePackage || eModules) {
      return ePackage ? Package.loadByPath(current) : Package.createInMemory(current)
    }
    var parentPath = path.resolve(current, '..')
    if (parentPath === current) {
      log.info(`currnet package not found, creating in-memory package`)
      return Package.createInMemory()
    }
    return Package.load(parentPath)
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

Package.prototype.install = function (lock) {
  if (lock) {
    this.lock = lock.dependencies[this.name]
  }

  return this.queryCache()
  .then(tarfile => tarfile || this.download())
  .then(tarfile => this.untar(tarfile))
  .then(() => this.postInstall())
  .catch(e => {
    e.message = `Failed to install package "${this.name}": ${e.message}`
    throw e
  })
}

Package.prototype.queryCache = function () {
  let tarfile = path.join(this.cacheDir(), 'package.tgz')
  log.silly('cache', `querying cache for ${this}`)
  return fs.exists(tarfile)
  .then(exists => {
    if (!exists) {
      throw new error.CacheMiss()
    }
    return this.checkIntegrity(fs.createReadStream(tarfile))
  })
  .then(() => {
    log.verbose('cache', `use cache for ${this}`)
    return tarfile
  })
  .catch(e => {
    if (e.code === 'ECACHEMISS') {
      log.verbose('cache', `cache miss for ${this}`)
      return null
    }
    if (e.code === 'EINTEGRITY') {
      log.verbose('cache', `integrity failed for ${this}`)
      return null
    }
    throw e
  })
}

Package.prototype.cacheDir = function () {
  return path.join(npm.config.get('cache'), this.name, this.version)
}

Package.prototype.download = function () {
  let url = this.descriptor.dist.tarball
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
  let untardir = path.join(npm.tmp, 'modules', `${this.name}`)

  return fs.remove(untardir)
    .then(() => Promise.fromCallback(
      cb => fs.createReadStream(tarfile)
        .pipe(gunzip())
        .pipe(tar.Extract({path: untardir}))
        .on('error', err => cb(err))
        .on('end', () => cb(null))
    ))
    // move+override doesn't work for symlinks, remove it anyway
    .then(() => fs.remove(this.pathname))
    .then(() => fs.move(path.join(untardir, 'package'), this.pathname))
}

Package.prototype.checkIntegrity = function (dataStream) {
  let sri = this.integrity
  let sha1 = _.get(this, 'descriptor.dist.shasum')
  if (sri) {
    log.verbose('integrity', `sri checking ${this} against ${sri}`)
    return integrity.checkSRI(dataStream, sri)
    .then(() => (this.integrity = sri))
  }

  let sParse = new PassThrough()
  let sCheck = new PassThrough()
  dataStream.pipe(sParse)
  dataStream.pipe(sCheck)

  let todo = [
    integrity.getSRI(sParse)
    .then(sri => {
      log.verbose(`integrity generated for ${this}: ${sri}`)
      return sri
    })
  ]
  if (sha1) {
    log.verbose('integrity', `sha1 checking ${this} against ${sha1}`)
    todo.push(integrity.checkSHA1(sCheck, sha1))
  } else {
    log.warn('integrity', `no integrity/shasum found for ${this}, skipping check`)
  }
  return Promise.all(todo).spread(sri => (this.integrity = sri))
}

Package.prototype.dependencyInstalled = function (pkg) {
  return this.loadDependency(pkg.name)
  .then(json => {
    if (json.name !== pkg.name) {
      return false
    }
    if (pkg.version) {
      return pkg.version === json.version
    }
    return json
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

Package.prototype.removeAMDEntry = function () {
  return fs.remove(this.amdpath)
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
  this.modulesPath = path.resolve(pathname, descriptor.amdPrefix || 'amd_modules')
  this.lockfilePath = path.resolve(pathname, 'amd-lock.json')
  return this
}

Package.prototype.dependencyNotChanged = function (deps) {
  let keys1 = Object.keys(this.dependencies).sort()
  let keys2 = Object.keys(deps).sort()
  if (keys1.join(',') !== keys2.join(',')) {
    return false
  }
  for (let i = 0; i < keys1.length; i++) {
    let key = keys1[i]
    if (this.dependencies[key] !== deps[key]) return false
  }
  return true
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
      if (this.dependencyNotChanged(deps)) return
      descriptor.amdDependencies = _.chain(deps).toPairs().sort().fromPairs()
      return fs.writeJson(this.descriptorPath, descriptor, {spaces: 2})
    })
    .catch(e => {
      if (e.code !== 'ENOENT') {
        throw e
      }
      log.info(SKIP_WRITING_MSG)
    })
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
