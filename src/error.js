const util = require('util')

function PackageNotFound (name, parent) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = `package ${name} not found, required by ${parent.name}`
  this.pkgname = name
  this.parent = parent
}
util.inherits(PackageNotFound, Error)

function UnmetDependency (node, target) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.code = 'ENOTCOM'
  this.message = `${target.name} not compliant with ${node.name}`
  this.target = target
}
util.inherits(PackageNotFound, Error)

module.exports = {PackageNotFound, UnmetDependency}
