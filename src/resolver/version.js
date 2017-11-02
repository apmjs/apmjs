const Semver = require('semver')
const log = require('npmlog')
const error = require('../utils/error.js')
const _ = require('lodash')
const rPlainVersion = /^\d/

Semver.maxSatisfyingDescriptor = function (versionMap, semver) {
  var versions = _.keys(versionMap)
  var version = Semver.maxSatisfying(versions, semver)
  return version ? versionMap[version] : null
}

Semver.versionToSave = function (semver) {
  if (rPlainVersion.test(semver)) {
    return '^' + semver
  }
  return semver
}

Semver.parseDependencyDeclaration = function (decl) {
  var match = /^((?:[@\w-]+\/)?[\w-.]+)(@.*)?$/.exec(decl)
  if (!match) {
    throw new error.InvalidPackageName(decl)
  }
  return {
    name: match[1],
    semver: match[2] ? match[2].slice(1) : ''
  }
}

Semver.derive = function (info) {
  var lastVersion = _.chain(info.versions).keys().sort().last().value()
  if (!lastVersion) {
    return '^1.0.0'
  }
  return '^' + lastVersion
}

module.exports = Semver
