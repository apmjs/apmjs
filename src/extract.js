const fs = require('fs-extra')
const Promise = require('bluebird')
const path = require('path')
const changeCase = require('change-case')
const _ = require('lodash')
const debug = require('debug')('apmjs:extract')

function extractDependencies (pathname) {
  debug('extracting dependencies for', pathname)
  return Promise.resolve(path.resolve(pathname, 'node_modules'))
    .then(path => fs
      .readdir(path)
      .catch(e => {
        if (e.code === 'ENOENT') {
          return []
        }
        throw e
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
      module.dependencies = _.mapKeys(dependencies, dep => dep.pkg.name)
      return module
    })
}

function extractCurrent (pathname) {
  return Promise.resolve(path.resolve(pathname, 'package.json'))
    .then(filename => fs.readJson(filename))
    .then(pkg => {
      var filepath = pkg.browser || pkg.index || 'index.js'
      filepath = path.resolve(pathname, filepath)
      return [pkg, filepath, fs.readFile(filepath, {encoding: 'utf8'})]
    })
    .spread((pkg, filepath, content) => {
      var name = changeCase.camelCase(pkg.name)
      return {filepath, content, name, pkg}
    })
}

module.exports = {
  extractTree,
  extractCurrent,
  extractDependencies
}
