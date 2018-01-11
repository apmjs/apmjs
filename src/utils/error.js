const util = require('util')
const http = require('http')

function createFrom (err, msg) {
  msg = msg || err.message || 'Unkwown Error'
  var error = new Error(msg)
  error.stack = `${error.stack}
From previous error:
${err.stack}`
  return error
}

function PackageNotFound (name, parent) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = `package ${name} not found`
  this.pkgname = name
  this.code = 'ENOTFOUND'
  if (parent) {
    this.message += `, required by ${parent.name}`
    this.parent = parent
  }
}
util.inherits(PackageNotFound, Error)

function CacheMiss (message) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.code = 'ECACHEMISS'
  this.message = message || `cache miss`
}
util.inherits(CacheMiss, Error)

function IntegrityError (message) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.code = 'EINTEGRITY'
  this.message = message || `integrity check failed`
}
util.inherits(IntegrityError, Error)

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
  this.message = `cannot parse package meta for ${name}`
  this.pkgname = name
  this.code = 'EPKGMETA'
  if (parent) {
    this.message += `, which is required by ${parent.name}`
    this.parent = parent
  }
}
util.inherits(InvalidPackageMeta, Error)

function HTTP (status) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = status + ' ' + http.STATUS_CODES[status]
  this.code = 'EFETCH'
}
util.inherits(HTTP, Error)

module.exports = {PackageNotFound, UnmetDependency, InvalidPackageName, InvalidPackageMeta, HTTP, createFrom, IntegrityError, CacheMiss}
