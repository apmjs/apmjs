const TreeNode = require('./tree-node.js')

function loadRoot (pkg) {
  var versionMap = {}
  versionMap[pkg.version] = pkg
  var root = new TreeNode(pkg.name, versionMap)
  return root.populateChildren()
}

module.exports = {loadRoot}
