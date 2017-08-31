const assert = require('assert')
const _ = require('lodash')
const Version = require('./resolver/version.js')
const fs = require('fs-extra')
const debug = require('debug')('apmjs:package')
const changeCase = require('change-case')
const path = require('path')
const Promise = require('bluebird')

function Package (descriptor, pathname) {
  assert(descriptor.name, 'package name not defined for ' + pathname)

  this.version = descriptor.version || '0.0.0'
  this.name = descriptor.name
  this.dependencies = descriptor.amdDependencies || {}
  this.descriptor = descriptor
  if (pathname) {
    this.setPathname(pathname)
  }
}

Package.load = function (pathname) {
  return Promise
    .resolve(path.resolve(pathname, 'package.json'))
    .tap(file => debug('loading package from', file))
    .then(filepath => fs.readJson(filepath))
    .then(descriptor => new Package(descriptor, pathname))
    .catch(e => {
      if (e.code === 'ENOENT') {
        return new Package({name: 'tmp'})
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
  var mod = normalizeAMDPath(this.filepath)
  return fs.writeFile(
    this.amdpath,
    `define('${this.name}', ['${mod}'], function (mod) { return mod; })`
  )
}

Package.prototype.toString = function () {
  return this.name + '@' + this.version
}

Package.maxSatisfying = function (versionMap, semver) {
  var descriptor = Version.maxSatisfying(versionMap, semver)
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
  this.filepath = path.join(this.name, index)
  this.fullpath = path.resolve(pathname, index)
  this.amdpath = pathname + '.js'
  this.pathname = pathname
  this.descriptorPath = path.resolve(pathname, 'package.json')
  return this
}

Package.prototype.saveDependencies = function () {
  var file = this.descriptorPath
  if (!file) {
    console.warn('package.json not exist, skip saving...')
    return Promise.resolve()
  }

  debug('saving dependencies to', file)
  return fs
    .readJson(file)
    .then(pkg => {
      pkg.amdDependencies = this.dependencies
      return fs.writeJson(file, pkg, {spaces: 2})
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
  return this.name + '@' + this.version
}

function normalizeAMDPath (filepath) {
  return './' + _.trimEnd(filepath, '.js').replace(/\\/g, '/')
}

Package.normalizeAMDPath = normalizeAMDPath

module.exports = Package
