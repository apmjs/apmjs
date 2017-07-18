const fs = require('fs-extra')
const Package = require('./package.js')
const Promise = require('bluebird')
const path = require('path')
const _ = require('lodash')
const debug = require('debug')('apmjs:extract')

function extractDependencies (pathname) {
  debug('extracting dependencies for', pathname)
  return Promise.resolve(path.resolve(pathname, 'node_modules'))
    .then(path => fs
      .readdir(path)
      .catch(e => {
        if (e.code !== 'ENOENT') {
          throw e
        }
        return []
      })
    )
    .map(filename => path.resolve(pathname, 'node_modules', filename))
    .map(extractTree)
}

/**
 * Extract modules from the given project
 *
 * @param {string} pathname The root path of your project
 * @return {Promise<Array<Module>>} An array containing all modules, recursively
 */
function extractTree (pathname) {
  debug('extractTree for', pathname)
  return Promise
    .all([extractCurrent(pathname), extractDependencies(pathname)])
    .spread((module, dependencies) => {
      module.dependencies = _.mapKeys(
        dependencies,
        dep => dep.descriptor.name)
      return module
    })
}

function extractCurrent (pathname) {
  return Promise.resolve(path.resolve(pathname, 'package.json'))
    .then(filename => fs.readJson(filename))
    .then(descriptor => new Package(descriptor, pathname))
}

function flatten (root) {
  var pkgs = _.chain(root.dependencies).map(flatten).flatten().value()
  pkgs.push(root)
  return pkgs
}

function writeFiles (packages, dir) {
  debug(`writing ${packages.length} packages to ${dir}`)
  return Promise.resolve(packages)
    .map(pkg => pkg.read())
    .map(pkg => {
      var targetPath = pkg.distname(dir)
      return fs.writeFile(targetPath, pkg.content)
    })
}

module.exports = {
  extractTree,
  extractCurrent,
  extractDependencies,
  writeFiles,
  flatten
}
