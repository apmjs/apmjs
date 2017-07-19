const _ = require('lodash')
const PackageEntry = require('./package-entry.js')
const error = require('./error.js')

/**
 * Check whether all dependencies satisfied, recursively
 * TODO: semantic-based version check
 *
 * @param {Package} package The packages to check
 * @return {boolean} true if satisfied, false otherwise
 */
function checkDependencies (packages) {
  PackageEntry.init()
  packages.forEach(pkg => {
    PackageEntry.findOrCreate(pkg).define(pkg)
    _.forOwn(
      pkg.dependencies, 
      dep => PackageEntry.findOrCreate(dep).require(pkg)
    )
  })
  PackageEntry.check()
}

module.exports = {
  checkDependencies
}
