const Semver = require('semver')
const _ = require('lodash')
const Package = require('../package.js')

function filterVersions (versionMap, semver) {
  var versions = versionMap
  return _
    .filter(versions,
      (descriptor, version) => Semver.satisfies(version, semver)
    )
    .map(descriptor => new Package(descriptor))
}

function check (installing, installed) {
  var greater = Semver.gtr(installed.version, installing.semver) ? installed : installing
  var less = installing === greater ? installed : installing
  var msg = `WARN: multi versions of ${greater.name}, ` +
    `upgrade ${less.toString(true)} (in ${less.parent.name}) to match ` +
    `${greater.semver} (as required by ${greater.parent})`
  console.warn(msg)
}

module.exports = {
  check, filterVersions
}
