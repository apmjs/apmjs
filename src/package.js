const assert = require('assert')
const Version = require('./resolver/version.js')
const fs = require('fs-extra')
const debug = require('debug')('apmjs:package')
const changeCase = require('change-case')
const path = require('path')
const Promise = require('bluebird')

function Package (descriptor, pathname) {
  assert(descriptor.name, 'package name not defined for ' + pathname)

  this.version = descriptor.version || '0.0.0'
  this.name = changeCase.camelCase(descriptor.name)
  this.dependencies = descriptor.dependencies
  this.descriptor = descriptor
  if (pathname) {
    this.setPathname(pathname)
  }
}

Package.load = function (pathname) {
  return Promise
    .resolve(path.resolve(pathname, 'package.json'))
    .then(filepath => fs.readJson(filepath))
    .then(descriptor => new Package(descriptor, pathname))
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
  return another && this.name === another.name && this.version === another.version
}

Package.prototype.setPathname = function (pathname) {
  var descriptor = this.descriptor
  var filepath = descriptor.browser || descriptor.index || 'index.js'
  this.filepath = path.resolve(pathname, filepath)
  this.descriptorPath = path.resolve(pathname, 'package.json')
}

Package.prototype.saveDependencies = function () {
  var file = this.descriptorPath
  return fs
    .readJson(file)
    .then(pkg => {
      pkg.dependencies = this.dependencies
      return fs.writeJson(file, pkg)
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

module.exports = Package
