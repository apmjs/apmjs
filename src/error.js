const util = require('util')

function PackageNotFound (name, parent) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = `package ${name} not found, required by ${parent.name}`
  this.pkgname = name
  this.parent = parent
}
util.inherits(PackageNotFound, Error)

function UnmetDependency (message) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.code = 'EUNMET'
  this.message = message || `unmet dependency`
}
util.inherits(UnmetDependency, Error)

module.exports = {PackageNotFound, UnmetDependency}
