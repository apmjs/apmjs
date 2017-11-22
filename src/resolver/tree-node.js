'use strict'
const error = require('../utils/error.js')
const Promise = require('bluebird')
const assert = require('assert')
const treePrinter = require('tree-printer')
const Package = require('../package.js')
const log = require('npmlog')
const Version = require('./version.js')
const npm = require('../utils/npm.js')
const _ = require('lodash')

function TreeNode (pkg) {
  assert(pkg.name, 'package name is required')
  this.name = pkg.name
  this.parents = {}
  this.children = {}
  this.referenceCount = 0
  this.setPackage(pkg)
  TreeNode.nodes[this.name] = this
  log.silly(`${this} created`)
}

TreeNode.nodes = {}
TreeNode.referenceCounts = {}

TreeNode.dependencyList = function () {
  return TreeNode.childList().map(node => node.pkg)
}

TreeNode.childList = function () {
  return _.filter(TreeNode.nodes, node => !node.isRoot)
}

TreeNode.prototype.toPlainTree = function () {
  let obj = {
    name: this.toString(),
    children: _.map(this.children, child => child.toPlainTree())
  }
  if (this.pkg.newlyInstalled) {
    obj.name += ' (newly installed)'
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

TreeNode.prototype.updateOrInstallDependency = function (name, semver) {
  log.silly(`update or install dependency ${name}@${semver}`)
  if (this.children[name]) {
    this.children[name].remove(this)
  }
  return this.addDependency(name, semver, true)
}

// This should be side-effect free, race condition happens
TreeNode.prototype.createLocalNode = function (name, semver) {
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

// This should be side-effect free, race condition happens
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

TreeNode.prototype.addDependency = function (name, semver, update) {
  log.silly(`add dependency: ${name}@${semver}`)
  return enque(name, () => {
    let node
    if ((node = TreeNode.nodes[name])) {
      log.silly(`reusing dependency in tree: ${node}`)
      var compatible = node.checkConformance(semver, this)
      if (!update || compatible) {
        this.appendChild(node, semver)
        return Promise.resolve(node)
      }
    }
    return Promise.resolve()
    .then(update => update ? null : this.createLocalNode(name, semver))
    .then(node => node || this.createRemoteNode(name, semver))
    .then(node => {
      node.update = update
      this.appendChild(node, semver)
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

TreeNode.prototype.populateChildren = function () {
  log.silly(`populating children for ${this}:`, _.keys(this.pkg.dependencies))

  return Promise
  .all(_.map(this.pkg.dependencies, (semver, name) => this.addDependency(name, semver)))
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
