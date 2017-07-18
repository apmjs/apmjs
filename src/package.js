const assert = require('assert')
const fs = require('fs-extra')
const changeCase = require('change-case')
const path = require('path')
const Promise = require('bluebird')

function Package (descriptor, pathname) {
  assert(descriptor.name, 'name not defined:' + descriptor)

  var filepath = descriptor.browser || descriptor.index || 'index.js'
  this.filepath = path.resolve(pathname, filepath)
  this.version = descriptor.version || '0.0.0'
  this.name = changeCase.camelCase(descriptor.name)
  this.descriptor = descriptor
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
  var filename = changeCase.paramCase(this.name) +
    '-' +
    this.version +
    '.js'
  return path.resolve(dirname, filename)
}

module.exports = Package
