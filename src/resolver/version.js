const Semver = require('semver')
const error = require('../error.js')
const _ = require('lodash')

function maxSatisfying (versionMap, semver) {
  var versions = _.keys(versionMap)
  var version = Semver.maxSatisfying(versions, semver)
  return version ? versionMap[version] : null
}

function upgradeWarning (name, lhs, rhs) {
  var greater = Semver.gt(lhs.version, rhs.version) ? lhs : rhs
  var less = lhs === greater ? rhs : lhs
  var msg = `WARN: multi versions of ${name}, ` +
    `upgrade ${name}@${less.required} (in ${less.parent}) to match ` +
    `${greater.required} (as required by ${greater.parent})`
  console.warn(msg)
}

function parsePackageName (decl) {
  var match = /^([\w-.]+)(@.*)?$/.exec(decl)
  if (!match) {
    throw new error.InvalidPackageName(decl)
  }
  return {
    name: match[1],
    semver: match[2] && match[2].slice(1)
  }
}

function derive (info) {
  var lastVersion = _.chain(info.versions).keys().sort().last().value()
  if (!lastVersion) {
    return '1.0.x'
  }
  var nums = lastVersion.split('.')
  nums[nums.length - 1] = 'x'
  return nums.join('.')
}

module.exports = {
  upgradeWarning, maxSatisfying, derive, parsePackageName
}
