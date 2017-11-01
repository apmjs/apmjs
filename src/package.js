const assert = require('assert')
const log = require('npmlog')
const process = require('process')
const error = require('./utils/error.js')
const findUp = require('./utils/fs.js').findUp
const _ = require('lodash')
const Version = require('./resolver/version.js')
const fs = require('fs-extra')
const debug = require('debug')('apmjs:package')
const changeCase = require('change-case')
const path = require('path')
const Promise = require('bluebird')

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

Package.load = function (pathname) {
  return findUp('package.json', pathname)
    .tap(file => {
      debug('loading package from', file)
      pathname = path.dirname(file)
    })
    .then(file => fs.readJson(file))
    .then(descriptor => new Package(descriptor, pathname))
}

Package.loadOrCreate = function (pathname) {
  return Package.load(pathname)
    .catch(err => {
      if (err.code === 'ENOENT') {
        return new Package({name: 'root'}, process.cwd())
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
  var maxSatisfiying = Package.maxSatisfyingVersion(info.versions, semver)

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
  var ps = this.respectBrowser()
  ps.push(this.writeAMDEntry())
  return Promise.all(ps)
}

Package.prototype.respectBrowser = function () {
  var browser = this.descriptor.browser
  if (!_.isObject(browser)) {
    return []
  }
  return _.map(browser, (replacer, target) => {
    var targetPath = path.resolve(this.pathname, target)
    if (replacer === false) {
      return fs.writeFile(targetPath, 'define(function(){})')
    }
    var replacerPath = path.resolve(this.pathname, replacer)
    return fs.move(replacerPath, targetPath, {overwrite: true}).catch(e => {
      console.warn(`failed to mv ${replacer} to ${target}: ${e.message}`)
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

Package.maxSatisfyingVersion = function (versionMap, semver) {
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
  return this
}

Package.prototype.savePackages = function (conf) {
  var save = conf['save']
  return Promise.all([this.saveDependencies(save), this.savePackageLocks()])
}

Package.prototype.savePackageLocks = function () {
  // TODO impl
  return Promise.resolve()
}

Package.prototype.saveDependencies = function (save) {
  var file = this.descriptorPath
  if (!file) {
    console.warn('package.json not exist, skip saving...')
    return Promise.resolve()
  }

  return fs
    .readJson(file)
    .then(descriptor => {
      var deps = descriptor.amdDependencies
      _.forOwn(this.dependencies, (semver, name) => {
        if (save || deps[name]) {
          deps[name] = semver
        }
      })
      _.forOwn(deps, (semver, name) => {
        if (!this.dependencies[name]) {
          delete deps[name]
        }
      })
      this.amdDependencies = deps
      return fs.writeJson(file, descriptor, {spaces: 2})
    })
    .catch(e => {
      if (e.code !== 'ENOENT') {
        throw e
      }
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
