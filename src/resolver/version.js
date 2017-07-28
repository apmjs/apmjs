const Semver = require('semver')
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

function abstract (version) {
  var nums = version.split('.')
  nums[nums.length - 1] = 'x'
  return nums.join('.')
}

module.exports = {
  upgradeWarning, maxSatisfying, abstract
}
