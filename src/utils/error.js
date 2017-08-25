const util = require('util')
const http = require('http')

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

function InvalidPackageMeta (name, parent) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = `cannot parse package meta for ${name}, which is required by ${parent.name}`
  this.pkgname = name
  this.code = 'EPKGMETA'
  this.parent = parent
}
util.inherits(InvalidPackageMeta, Error)

function HTTP (status) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = status + ' ' + http.STATUS_CODES[status]
  this.code = 'EFETCH'
}
util.inherits(HTTP, Error)

module.exports = {PackageNotFound, UnmetDependency, InvalidPackageName, InvalidPackageMeta, HTTP}
