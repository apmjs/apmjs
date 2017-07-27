const Semver = require('semver')
const Package = require('../package.js')

function maxSatisfyingPackage (versionMap, semver) {
  var versions = Object.keys(versionMap)
  var version = Semver.maxSatisfying(versions, semver)
  return version ? new Package(versionMap[version]) : null
}

function upgradeWarning (installing, installed) {
  var greater = Semver.gtr(installed.version, installing.semver) ? installed : installing
  var less = installing === greater ? installed : installing
  var msg = `WARN: multi versions of ${greater.name}, ` +
    `upgrade ${less.toString(true)} (in ${less.parent.name}) to match ` +
    `${greater.semver} (as required by ${greater.parent})`
  console.warn(msg)
}

function abstract (version) {
  var nums = version.split('.')
  nums[nums.length - 1] = 'x'
  return nums.join('.')
}

module.exports = {
  upgradeWarning, maxSatisfyingPackage, abstract
}
