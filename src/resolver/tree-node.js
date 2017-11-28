'use strict'
const error = require('../utils/error.js')
const fs = require('fs-extra')
const Promise = require('bluebird')
const assert = require('assert')
const treePrinter = require('tree-printer')
const Package = require('../package.js')
const log = require('npmlog')
const Version = require('./version.js')
const npm = require('../utils/npm.js')
const _ = require('lodash')
const catchNoEntry = require('../utils/fs.js').catchNoEntry

function TreeNode (pkg) {
  assert(pkg.name, 'package name is required')
  this.name = pkg.name
  this.parents = {}
  this.isRoot = false
  this.saved = false
  this.children = {}
  this.referenceCount = 0
  this.setPackage(pkg)
  if (!pkg.placeholder) {
    TreeNode.nodes[this.name] = this
  }
  log.silly(`${this} created`)
}

TreeNode.nodes = {}
TreeNode.dependencyLocks = {}

TreeNode.loadLockfile = function (filepath) {
  log.verbose(`loading lock file from ${filepath}`)
  return fs.readJson(filepath)
    .then(lock => (TreeNode.dependencyLocks = lock.dependencies))
    .catch(catchNoEntry)
    .catch(e => {
      throw error.createFrom(e, `failed to load lockfile ${filepath}`)
    })
}

TreeNode.prototype.toPlainTree = function () {
  let obj = {
    name: this.toString(),
    children: _.map(this.children, child => child.toPlainTree())
  }
  if (this.pkg.status) {
    obj.name += ` (${this.pkg.status})`
  }
  return obj
}

TreeNode.prototype.printTree = function () {
  let tree = this.toPlainTree()
  let str = this.toString()
  let children = treePrinter(tree.children, {format: {root: ''}}).trim()
  if (children) {
    str += '\n' + children
  }
  console.log(str)
}

TreeNode.prototype.updateOrInstallDependency = function (name, semver, save) {
  log.silly(`update or install dependency ${name}@${semver}`)
  if (this.children[name]) {
    this.children[name].remove(this)
  }
  return this.addDependency(name, semver, {update: true, saved: save})
}

TreeNode.prototype.installDependency = function (name, semver, save) {
  log.silly(`install dependency ${name}@${semver}`)
  if (this.children[name]) {
    this.children[name].remove(this)
  }
  return this.addDependency(name, semver, {listed: true, saved: save})
}

TreeNode.prototype.tryCreateLocalNode = function (name, semver) {
  log.silly(`creating local node for ${name}@${semver}`)
  return Package.loadModule(name)
    .then(pkg => {
      if (Version.satisfies(pkg.version, semver)) {
        log.silly(`local node created ${pkg}`)
        return new TreeNode(pkg)
      }
      log.silly(`local node ${pkg} version not match ${name}@${semver}`)
      return null
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        log.silly(`local node for ${name}@${semver} not found`)
        return null
      }
      log.error(`reading local node error: ${name}@${semver}`)
      throw err
    })
}

TreeNode.prototype.createRemoteNode = function (name, semver) {
  log.silly(`creating remote node for ${name}@${semver}`)
  return npm
    .getPackageMeta(name, this.pkg)
    .then(info => {
      let version = Version.maxSatisfying(_.keys(info.versions), semver || '*')
      if (!version) {
        let msg = `package ${name}${semver && ('@' + semver)} not available, required by ${this}`
        throw new error.UnmetDependency(msg)
      }
      let pkg = new Package(info.versions[version])
      return new TreeNode(pkg)
    })
}

function fetchSource (satisfies, options) {
  if (options.update) {
    return 'remote'
  }
  if (options.listed) {
    return satisfies ? 'installed' : 'remote'
  }
  return satisfies ? 'installed' : 'fail'
}

TreeNode.prototype.addDependency = function (name, semver, options) {
  options = options || {}
  log.silly(`add dependency: ${name}@${semver} with options:`, options)
  return enque(name, () => {
    let installed = TreeNode.nodes[name]

    if (installed) {
      let satisfies = installed.checkConformance(semver, this)
      switch (fetchSource(satisfies, options)) {
        case 'installed':
          this.appendChild(installed)
          if (options.saved) {
            installed.saved = true
          }
          return Promise.resolve(installed)
        case 'fail':
          let node = new TreeNode({name: name, version: semver, placeholder: true})
          node.pkg.status = 'not installed'
          this.appendChild(node)
          return Promise.resolve(node)
      }
    }

    return Promise.resolve()
    .then(() => {
      if (options.update || semver === 'latest') {
        return null
      }
      return this.tryCreateLocalNode(name, semver)
    })
    .then(node => node || this.createRemoteNode(name, semver))
    .then(node => {
      node.listed = options.listed
      this.appendChild(node)
      if (installed) {
        installed.pkg.status = 'removed'
      }
      if (options.saved) {
        node.saved = options.saved
      }
      return node.populateChildren().then(() => node)
    })
  })
}

TreeNode.prototype.checkConformance = function (semver, parent) {
  log.silly('checking comformance between', `${this} and ${semver}`)
  if (Version.satisfies(this.version, semver)) {
    return true
  }
  let name = this.name
  let parentInstalled = _.sample(this.parents)
  let parentRequired = parentInstalled.pkg.dependencies[name]
  let msg = 'version conflict: '
  if (Version.ltr(this.version, semver)) {
    msg += `upgrade ${name}@${parentRequired} (required by ${parentInstalled}) to match ${semver} (required by ${parent})`
  } else {
    let semverInstalled = parentInstalled.pkg.dependencies[name]
    msg += `upgrade ${name}@${semver} (required by ${parent}) to match ${semverInstalled} (required by ${parentInstalled})`
  }
  log.error(msg)
  return false
}

TreeNode.prototype.populateChildren = function (options) {
  options = options || {}
  log.silly(`populating children for ${this}:`, _.keys(this.pkg.dependencies))

  return Promise
  .all(_.map(this.pkg.dependencies, (semver, name) => {
    var lock = TreeNode.dependencyLocks[name]

    if (!options.update && lock && Version.satisfies(lock.version, semver)) {
      semver = lock.version
    }
    return this.addDependency(name, semver, {saved: this.saved, update: options.update})
  }))
  .then(() => this)
}

TreeNode.prototype.toString = function () {
  return Package.prototype.toString.call(this)
}

TreeNode.prototype.setPackage = function (pkg) {
  log.silly('setPackage', pkg.toString())
  this.pkg = pkg
  this.version = pkg.version
}

TreeNode.prototype.appendChild = function (child) {
  log.silly('appending child', child.toString(), 'to', this.toString())

  child.parents[this.name] = this
  this.children[child.name] = child

  child.referenceCount++
  return this
}

TreeNode.prototype.destroy = function () {
  log.silly('destroying node', this.toString())
  _.forEach(this.children, child => child.remove(this))
  delete TreeNode.nodes[this.name]
}

TreeNode.prototype.remove = function (parent) {
  log.silly(`removing ${this} from ${parent}`)
  delete this.parents[parent.name].children[this.name]
  delete this.parents[parent.name]

  this.referenceCount--
  if (this.referenceCount <= 0) {
    this.destroy()
  }
}

TreeNode.pending = {}

function enque (name, fn) {
  if (!TreeNode.pending[name]) {
    TreeNode.pending[name] = Promise.resolve()
  }
  TreeNode.pending[name] = TreeNode.pending[name].then(fn)
  return TreeNode.pending[name]
}

module.exports = TreeNode
