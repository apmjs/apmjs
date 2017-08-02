const util = require('util')

function PackageNotFound (name, parent) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = `package ${name} not found, required by ${parent.name}`
  this.pkgname = name
  this.code = 'ENOTFOUND'
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

function InvalidPackageName (packageName) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.code = 'EPKGNAME'
  this.message = `invalid package name "${packageName}"`
}
util.inherits(InvalidPackageName, Error)

module.exports = {PackageNotFound, UnmetDependency, InvalidPackageName}
