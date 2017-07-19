const util = require('util')

/**
 * UnusedPackageError Class
 *
 * @param {Package} pkg The package instance
 */
function UnusedPackage (pkg) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = `unused package ${pkg.name}`
  this.pkg = pkg
}
util.inherits(UnusedPackage, Error)

function PackageNotFound (name, parent) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = `package ${name} not found, required by ${parent.name}`
  this.pkgname = name
  this.parent = parent
}
util.inherits(PackageNotFound, Error)

module.exports = {UnusedPackage, PackageNotFound}
